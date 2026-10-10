# Phase 24: Device Administration & Tenant Opt-In - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous mode — decisions sourced from `.planning/milestones/v2.3-REQUIREMENTS.md`, Phase 23 CONTEXT.md, constitution v1.7.0, AGENTS.POLICY.md, existing administration-page patterns)

<domain>
## Phase Boundary

Phase 24 makes Phase 23's backend surface **administratable** by tenant administrators. After 24 ships:
- A TenantAdmin can flip the `DoorIntegrationEnabled` flag on their condominium from a new section on the existing administration page.
- A TenantAdmin can register a new device (type, vendor, gatehouse binding, connection params), see it in a condominium-scoped device list, edit/activate-deactivate/remove it.
- A deactivated/removed device immediately rejects unlock and event ingestion (the existing `IsActive` flag on the `Device` entity is already enforced by Phase 23's handler — Phase 24 wires the admin-side mutations).
- Connection params are entered once and never displayed back in plaintext.
- All read/write paths remain tenant-isolated via `ITenantAwareLinqFactory`.
- A TenantAdmin of condominium A cannot see, register, or operate devices of condominium B (cross-tenant tests prove this).

**Scope split:**
- DOOR-05: `DoorIntegrationEnabled` flag — flip endpoint + admin toggle UI; 404-on-disabled behavior already wired in Phase 23.
- DOOR-06: Device management — register / list / get / edit / activate-deactivate / remove endpoints + admin device-list page + register/edit modal.

**Out of scope (deferred to later phases):**
- DOOR-01/02/03/04/07/15 (unlock machinery) → Phase 23 (done)
- DOOR-08..11 (reader events + ledger) → Phase 25
- DOOR-12..14 (heartbeats + health dashboard + offline toast) → Phase 26
- Real vendor drivers → v2.5 Phases 32–34

</domain>

<decisions>
## Implementation Decisions

### API surface
- `PUT /api/v1/tenants/current/door-integration` — body: `{ doorIntegrationEnabled: boolean }`. Requires `TenantAdmin` role. Returns the updated tenant flag state. Idempotent. Audit-logged to the existing `Tenants` audit trail.
- `POST /api/v1/devices` — register a device. Body: `{ deviceType: "reader" | "controller", vendor, gatehouseId, connectionParams: { ... } }`. Requires `TenantAdmin`. Returns `DeviceDetail` with the persisted device id and a one-time `redaction.oncePlaintext` flag so the client knows it was just-entered (the server still never returns it again).
- `PATCH /api/v1/devices/{deviceId}` — edit. Body: optional fields `vendor`, `gatehouseId`, `connectionParams` (if present, replaces the ciphertext atomically). TenantAdmin only.
- `PUT /api/v1/devices/{deviceId}/activation` — body: `{ isActive: boolean }`. TenantAdmin only.
- `DELETE /api/v1/devices/{deviceId}` — soft delete via `IsActive=false` + `RemovedAtUtc` column. TenantAdmin only. (The hard-delete approach is rejected because audit history references device ids.)
- `GET /api/v1/devices` (list) + `GET /api/v1/devices/{deviceId}` — both gated to TenantAdmin or Porteiro (porteiro needs read access for the eventual porteiro panel). Connection params are returned as `{ redacted: true, last4: "abcd" }` always.

### Persistence additions
- Add a `RemovedAtUtc DATETIME(6) NULL` column to `Devices` via the existing migration script. Default `NULL` means "not removed". Soft-delete sets it to the deletion timestamp.
- Add `DoorIntegrationChangedAtUtc DATETIME(6) NULL` and `DoorIntegrationChangedByProfileId CHAR(36) NULL` columns to `Tenants` for audit-trail symmetry with other tenant-flag flips (matching the pattern used for `Tenants.MustChangePassword` columns in v2.1 Phase 18).
- No new trigger needed — `Devices` is not append-only (only `DeviceUnlockAudit` is).

### Tenant-flag mutation handler
- New `ToggleDoorIntegrationHandler` (Application/Handlers) — handler takes `(tenantId, enabled, actorProfileId, correlationId)`. Validates the actor is a TenantAdmin of `tenantId`. Updates the flag + the two new audit columns. Logs `tenant.door_integration.{enabled|disabled}` with structured fields. Returns the updated tenant flag state.
- The handler does NOT require the door-integration flag itself to be enabled (you can flip the flag from any state — including the disabled state to enable it). This is the bootstrap case.

### Device mutation handlers
- `RegisterDeviceHandler` — encrypts `connectionParams` via `IDeviceConnectionCryptoService` (Phase 23's service), inserts the `Device` entity, returns the new id. Validates: `deviceType` is in the enum, `vendor` is a non-empty string ≤ 64 chars, `gatehouseId` references an existing gatehouse in the same tenant (FK lookup), `connectionParams` shape matches the device type (e.g., a `controller` needs `{ endpoint: string, secret?: string, vendorSpecific?: Record<string, string> }`, a `reader` needs `{ endpoint: string, vendorSpecific?: Record<string, string> }`).
- `EditDeviceHandler` — partial update; same validation as register for whichever fields are present.
- `ActivateDeactivateDeviceHandler` — sets `IsActive`. The flip is atomic and writes a structured log.
- `RemoveDeviceHandler` — sets `IsActive=false` and `RemovedAtUtc=now`. The handler refuses to remove a device with active `DoorUnlockAudit` rows in the last 24 hours (returns 409 Conflict with `title="device-remove-recent-activity"` and a link to the audit page — protects against accidental destruction of audit context). Tests cover both the allowed and blocked paths.

### Permission model
- `Devices.Unlock` (from Phase 23) — porteiro role.
- `Devices.Read` — porteiro AND tenant-admin roles (porteiros need to read the list for the future panel).
- `Devices.Write` — tenant-admin only.
- `Tenants.ToggleDoorIntegration` — tenant-admin only.

### Validation
- `RegisterDeviceRequest` and `EditDeviceRequest` validators (FluentValidation). `Vendor` is non-empty and ≤ 64 chars. `ConnectionParams` shape validated by a custom validator that branches on `deviceType`. `GatehouseId` is a valid UUID; the cross-tenant gatehouse existence check happens in the handler (after the validator), not in the validator, to keep validators pure.

### Angular UI: page placement
- Extend the existing `/administration` page with a new section **"Door Integration"** (visible only when the actor has `Devices.Write` or `Tenants.ToggleDoorIntegration` permission). The section sits below the existing "Staff Management" section.
- The section has two parts:
  1. **Opt-in toggle** (DOOR-05): a `ce-card` with a heading, a short description, and a `<ce-switch>` control bound to the `DoorIntegrationEnabled` flag. Toggling sends the `PUT /tenants/current/door-integration` request and shows a transient toast on success/failure.
  2. **Device list + register button** (DOOR-06): another `ce-card` containing a `<ce-table>` of devices with columns `Vendor`, `Type`, `Gatehouse`, `Status` (active badge), `Last Modified`, `Actions` (Edit / Activate-Deactivate / Remove). A `<ce-button variant="primary">+ Register device</ce-button>` in the card header opens a modal.
- The device list section is hidden when `DoorIntegrationEnabled=false` (matches the "no door endpoints / no UI when off" requirement). When hidden, a one-line `<ce-alert-note>Quote — turn on door integration above to manage devices</ce-alert-note>` replaces it.
- New route `/administration/devices` is **NOT created** — the device list lives inside `/administration` to keep "tenant configuration" surfaces in one place (matches the existing staff management grouping).
- No mockup page exists for `/administration` (mockup/ only has index/app/login/showcase). The plan is design-system conformance only — mirrors the residents page (which is the design-system reference for admin-style pages per Phase 22's UI-01 decision).

### Angular UI: register/edit modal
- New standalone component `device-form-modal.component.ts` (placed in `src/app/features/devices/components/`). Used for both register and edit flows — a single `@Input() device?: DeviceDetail` makes it switch modes (register when undefined, edit when present).
- Form fields (Angular reactive forms with `Validators`):
  - `deviceType` — `<ce-select>` with options `reader` / `controller` (locked to existing value when editing; cannot change type after registration because the encrypted connection-params shape is type-specific).
  - `vendor` — `<ce-input>` text field, max 64 chars.
  - `gatehouseId` — `<ce-select>` populated from a new `GET /api/v1/gatehouses?tenantId=current` endpoint (already exists — reuse, do NOT add a new endpoint). Required.
  - `connectionParams` — `<ce-textarea>` (multi-line JSON editor) with `<ce-alert-note>` saying "Entered once. Cannot be retrieved. Re-enter to change." On submit, the JSON is parsed via `JSON.parse` inside the component; parse errors surface as a form-level error.
- The modal uses the existing `ce-modal` primitive (already used by `visit-create-modal` and `qr-pass-modal`).
- Submit button label: "Register device" (register) / "Save changes" (edit). Loading state via `<ce-button [loading]="saving()">`.

### Routing & guards
- `/administration` already has a route guard for the tenant-admin role (verify by reading the existing route definition). No new routes. The new section is rendered conditionally based on the tenant flag state — no separate guard needed.
- The `devices-api.service.ts` from Phase 23 is extended with: `toggleDoorIntegration(enabled)`, `register(request)`, `update(deviceId, request)`, `setActivation(deviceId, isActive)`, `remove(deviceId)`.

### Soft-delete semantics
- The list endpoint excludes devices where `RemovedAtUtc IS NOT NULL` (the standard soft-delete pattern). A TenantAdmin who wants to "undelete" a device must re-register it as a new device — no undelete endpoint (out of scope).
- Soft-deleted devices still appear in `DeviceUnlockAudit` rows for historical accuracy; the audit-row FK to device is non-restrictive.

### Cross-tenant isolation tests
- Add 5 cross-tenant tests to the integration suite in `DeviceAdminEndpointTests`:
  1. `RegisterDevice_AsTenantB_Fails` — tenant A's admin tries to register a device with `gatehouseId` belonging to tenant B. Assert 404 (the gatehouse lookup is the leak, not the device table).
  2. `ListDevices_DoesNotReturnOtherTenantsDevices` — seed devices in both tenants A and B; tenant A's list returns only A's devices.
  3. `EditDevice_AsOtherTenant_Returns404` — tenant B admin edits tenant A's device id. 404.
  4. `RemoveDevice_AsOtherTenant_Returns404` — same with DELETE.
  5. `ToggleDoorIntegration_AffectsOnlyOwnTenant` — tenant B's flag flip does NOT change tenant A's flag (verified via GET).

### Test data discipline
- Every new test uses synthetic UUIDs for `deviceId`, `gatehouseId`, `tenantId`. No real vendor names like "Control iD" are hard-coded as device data — only the well-known enum literal `"controlid"` / `"intelbras"` / `"hikvision"` / `"generic"` is allowed in the `vendor` field. Synthetic-only.

</decisions>