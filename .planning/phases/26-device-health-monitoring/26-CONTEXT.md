# Phase 26: Device Health Monitoring - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous mode — decisions sourced from `.planning/milestones/v2.3-REQUIREMENTS.md`, Phase 23/24/25 CONTEXT.md, the existing dashboard (`/gatehouse-panel`) toast patterns, `.specs/door-integration/requirements.md`, constitution v1.7.0)

<domain>
## Phase Boundary

Phase 26 surfaces device health so hardware problems are visible before they become gatehouse workflow failures. After 26 ships:
- Simulated heartbeats update `device_heartbeats` (one row per device) with `last_heartbeat_at`, `status` (`online`/`offline`/`degraded`), `error_count` — DOOR-12.
- Per-device alert thresholds: `offline_after_seconds` (default 60), `error_rate_threshold` (default 10%) — DOOR-12.
- A device-health dashboard at `/devices` (new route) shows per-device status, last heartbeat, error rate, alert badges — visible to TenantAdmin and Porteiro — DOOR-13.
- A device crossing its offline threshold triggers an alert toast in the porteiro UI — DOOR-14.
- A device that recovers (heartbeats resume) returns to online/degraded and clears the alert state without operator intervention — DOOR-12 + DOOR-13.

**Scope split:**
- DOOR-12: `device_heartbeats` table + `IDeviceHeartbeatRepository` + heartbeat ingestion via `IDeviceHandler.HandleEventAsync` (Phase 25's handler routes `EventType=Heartbeat` to a new `IngestHeartbeatHandler`).
- DOOR-13: `GET /api/v1/devices/health` (admin/porteiro) + Angular dashboard page at `/devices` showing per-device status with auto-refresh polling.
- DOOR-14: Polling-based alert toast in the gatehouse panel page (`/gatehouse-panel`) — when a device crosses its offline threshold, the gatehouse panel's existing `<ce-toast>` shows a transient "Device X is offline — use manual entry" message. Polling every 30s (not real-time — real-time is Phase 31's edge-agent problem).

**Out of scope:**
- DOOR-01..07/15 → Phase 23
- DOOR-05/06 → Phase 24
- DOOR-08..11 → Phase 25
- Real vendor drivers → v2.5

</domain>

<decisions>
## Implementation Decisions

### `device_heartbeats` table
- Columns: `DeviceId CHAR(36) PK`, `TenantId CHAR(36) NOT NULL`, `LastHeartbeatAtUtc DATETIME(6) NOT NULL`, `Status TINYINT NOT NULL` (`0=online`, `1=offline`, `2=degraded`), `ErrorCount INT NOT NULL DEFAULT 0`, `OfflineAfterSeconds INT NOT NULL DEFAULT 60`, `ErrorRateThresholdPercent DECIMAL(5,2) NOT NULL DEFAULT 10.00`, `UpdatedAtUtc DATETIME(6) NOT NULL`, `tenant_id CHAR(36) NOT NULL`.
- One row per device (DeviceId is the PK). The two threshold columns live on the row itself (not a separate config table) because the spec says "per-device thresholds" and `default 60 / default 10%` are the defaults until a TenantAdmin overrides them in a future phase (Phase 26 ships the row with defaults; a future phase adds per-device threshold override UI).
- Index `ix_device_heartbeats_tenant_status (tenant_id, status)`.

### `IDeviceHeartbeatRepository`
- `GetAsync(tenantId, deviceId) → DeviceHeartbeat?` — returns the row.
- `UpsertAsync(heartbeat)` — INSERT ... ON DUPLICATE KEY UPDATE pattern. No Update/Delete methods on the abstraction (the absence is intentional; the row is managed by the heartbeat pipeline).
- `ListAsync(tenantId) → IReadOnlyList<DeviceHeartbeat>` — for the dashboard.

### Heartbeat ingestion pipeline
- Phase 25's `IngestDeviceEventHandler` already routes `EventType=Heartbeat` to a 400 (NOT a Phase-25 event). Phase 26 REPLACES that 400 with a call to `IngestHeartbeatHandler.HandleAsync(tenantId, deviceId, payload, ct)`.
- The new `IngestHeartbeatHandler` computes the heartbeat-derived status:
  - If the heartbeat is the FIRST for the device → status=online.
  - If the gap between `now` and `LastHeartbeatAtUtc` exceeds `offline_after_seconds` of the device's current row → status=offline.
  - Else if `error_count / max(events_since_last_success, 1) > error_rate_threshold_percent / 100` → status=degraded.
  - Else → status=online.
- The handler upserts the `DeviceHeartbeat` row in a single transaction. Writes a structured Serilog line `device.heartbeat.{status}` with the four outcome fields.
- The status recalculation is per-event — Phase 26 does NOT run a background re-evaluator that flips a device from "online (last seen 5min ago)" to "offline (now > 60s threshold)" until the NEXT heartbeat arrives. The background sweep is a v2.5 concern (Phase 31 + 32 land background polling).

### Dashboard endpoint
- `GET /api/v1/devices/health` — TenantAdmin or Porteiro. Body: `{ devices: [{ deviceId, vendor, type, gatehouseId, lastHeartbeatAtUtc, status, errorCount, offlineAfterSeconds, errorRateThresholdPercent, isOfflineExceeded }] }`. `isOfflineExceeded` is a derived field: `now - lastHeartbeatAtUtc > offlineAfterSeconds`. The dashboard renders the list with auto-refresh polling at 30s.

### Offline-alert toast (DOOR-14)
- A new `DeviceHealthService` Angular service exposes `Observable<DeviceHealthSnapshot>` with polling at 30s. The gatehouse-panel page injects it and shows a `<ce-toast tone="warning" *ngIf="anyOffline()">` at the top of the page when ANY device in the tenant is offline.
- The toast: `title="Device offline"`, body `"{vendor} at {gatehouse} hasn't checked in for {N}m. Entries should still be created manually until the device is online."`, `dismissible="true"`, `aria-live="polite"`. The toast auto-dismisses after 8 seconds (existing `ce-toast` behavior).
- The toast appears ONCE per offline transition — once dismissed, it stays dismissed until the next transition (a device that was offline returns to online, then goes offline again, fires a new toast). The transition detection is in `DeviceHealthService`: it diffs the current snapshot against the previous; the toast fires on `online → offline` edges.

### Dashboard page
- New route `/devices` (separate from `/administration` to keep hardware observability distinct from configuration). The route guard allows TenantAdmin OR Porteiro.
- Page layout (Angular standalone components):
  - Page header: `<ce-page-header>` with the title "Device health" and a `<ce-button variant="secondary" size="sm">Refresh</ce-button>` trigger.
  - The card uses the existing `<ce-card>` primitive. The table uses `<ce-table>` with columns: `Vendor`, `Type`, `Gatehouse`, `Status` (badge), `Last heartbeat`, `Error rate` (`{errorCount}/{events} = {pct}%`), `Offline threshold` (`{offlineAfterSeconds}s`), `Actions` (`<ce-button size="sm" variant="ghost">Configure</ce-button>` — disabled in Phase 26 because per-device threshold override UI is not in scope).
  - Empty state: "No devices registered yet. Devices appear here once you register one from **administration → Door Integration**."
  - Loading state: `<ce-spinner size="md">` with `aria-busy="true"`.
  - Error state: `<ce-alert-error>` with the ProblemDetails `detail` and a Retry button.

### Page placement in the navigation
- The porteiro's left nav gains a new item: `Device health` with `<ce-icon name="activity" />` icon, routed to `/devices`. Placed under the existing `Gatehouse panel` item (so porteiros see it without scrolling).
- For TenantAdmin: the same `/devices` route exists, but the nav rendering for the admin role (verify the nav component) gains the same item — TenantAdmins also need to see device health.
- The admin nav and porteiro nav are typically rendered from a single component that filters by role — add the new item to that filter.

### Design system conformance
- Reuses `ce-page-header`, `ce-card`, `ce-table`, `ce-badge`, `ce-button`, `ce-icon`, `ce-spinner`, `ce-alert-error`. No new components invented.
- New color tones for the Status badge: existing `success` tone for `online`, a new `warning` tone for `degraded` (verify it exists; if not, add to the `CeBadgeTone` enum), existing `danger` tone for `offline`.
- No hand-rolled ce-* CSS in the page `styles`.

### Threshold-override UI (out of scope)
- Per-device `offline_after_seconds` + `error_rate_threshold_percent` columns are present on the table but the UI to override them is NOT in Phase 26. The `Configure` action button in the table is disabled with `<ce-tooltip>Per-device threshold override ships in a future phase.</ce-tooltip>`. A future phase (post-v2.3) will add the override modal.

### Polling cadence
- 30 seconds is the default. The cadence is configurable via `IConfiguration["Devices:Health:PollIntervalSeconds"]` (default 30). The Angular service reads this via a runtime config fetch (`/api/v1/runtime-config` — likely already exists; verify and reuse). On lower-end networks the cadence could be raised to 60s.

### Cross-tenant isolation
- Both the dashboard endpoint and the offline-alert endpoint scope by `ITenantAwareLinqFactory`. A porteiro at condominium A never sees condominium B's devices.
- Integration tests cover: cross-tenant dashboard returns only the actor's tenant's devices; offline alerts from another tenant do NOT trigger the porteiro's toast.

### Auto-clear on recovery (DOOR-12 + DOOR-13)
- When a device's heartbeat resumes (gap returns to < threshold), the next heartbeat ingestion flips `status` back to `online` and the dashboard reflects the new state within 30s of polling.
- The porteiro toast does NOT auto-clear — it stays until the user dismisses it (the toast is transient by design; recovery is visible in the dashboard).

### Heartbeat payload shape
- `DeviceEventPayload` (Phase 25's DTO) already supports `EventType=Heartbeat` and `payload_json` carrying extras. Phase 26 reads `payload_json.error_count` (int) and `payload_json.events_since_last_success` (int). If absent, defaults to 0.

</decisions>