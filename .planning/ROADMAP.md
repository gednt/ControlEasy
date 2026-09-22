# Roadmap: ControlEasy Reborn

## Milestones

- 🚧 **v2.3 — Door Integration & Hardware Access (simulator-first)** — Phases 23-26 (planning 2026-09-22)
- 🚧 **v2.2 — UI Parity & Operational Closeout** — Phases 19-22 (started 2026-09-22, in flight on `feat/v2-2-milestone-planning`)
- ✅ **v2.1 — Integrated Visits & Account Operations** — Phases 16-18 (shipped 2026-09-20)
- ✅ **v2.0 — Gatehouse Photo & Consent Ledger** — Phases 11-13 (shipped 2026-09-13)
- ✅ **v1.1 — UI & Dashboard** — Phases 9-10 (shipped 2026-09-12, no GSD artifacts)
- ✅ **v1.0 — Modular Monolith MVP** — Phases 1-8 (shipped 2026-07-13)

## Phases

<details>
<summary>🚧 v2.3 Door Integration & Hardware Access — simulator-first (Phases 23-26) — PLANNING 2026-09-22</summary>

- [ ] **Phase 23: Device Foundation & Simulator Harness** - `IDoorController`/`IDeviceHandler` abstractions, simulated device adapter, `devices` table with AES-256-GCM-encrypted connection params, secure unlock endpoint with HMAC/replay/rate-limit security bar, append-only tamper-evident unlock audit
- [ ] **Phase 24: Device Administration & Tenant Opt-In** - `door_integration_enabled` tenant opt-in flag with admin UI, device registration/management UI (register, edit, activate/deactivate, remove)
- [ ] **Phase 25: Reader Events & Ledger Integration** - `device_events` table, event ingestion → `DeviceEvent` normalization, ledger entries from card-match events, denied-attempt logging, idempotent replay-on-reconnect
- [ ] **Phase 26: Device Health Monitoring** - `device_heartbeats` tracking with per-device alert thresholds, health dashboard UI, offline alert toast in porteiro UI

Full details in Phase Details below · requirements: [REQUIREMENTS.md](REQUIREMENTS.md)

</details>

<details>
<summary>🚧 v2.2 UI Parity & Operational Closeout (Phases 19-22) — IN FLIGHT (started 2026-09-22)</summary>

- [ ] **Phase 19: Ledger & Reports Polish** - Summary day-bucketing, honest filter vocabulary and search scope, condominium-level package drops, X-Total-Count exposure
- [ ] **Phase 20: Account Operations & Consent Audit UI** - TenantAdmin password-reset surface and consent-audit review with evidence rendering + CSV export
- [ ] **Phase 21: Photo Capture & Display UI** - Browser photo capture (camera/file-picker) with compression, display integration across record pages, resilient uploads
- [ ] **Phase 22: Mockup Parity & Test Closeout** - Mockup parity/functional fixes for high-traffic screens, stale E2E refresh, Nyquist validation coverage

Full details: [milestones/v2.2-ROADMAP.md](milestones/v2.2-ROADMAP.md) · [requirements](milestones/v2.2-REQUIREMENTS.md) — v2.2 is being executed in parallel on `feat/v2-2-milestone-planning`; no phase overlap with v2.3 (Phases 19–22 vs 23–26).

</details>

<details>
<summary>✅ v2.1 Integrated Visits & Account Operations (Phases 16-18) — SHIPPED 2026-09-20</summary>

- [x] Phase 16: Visits Unification Backend (3/3 plans) — completed 2026-09-19
- [x] Phase 17: Gatehouse Panel + Reports Page (3/3 plans) — completed 2026-09-19
- [x] Phase 18: Password Management (3/3 plans) — completed 2026-09-19

Full details: [milestones/v2.1-ROADMAP.md](milestones/v2.1-ROADMAP.md) · [requirements](milestones/v2.1-REQUIREMENTS.md) · [audit](milestones/v2.1-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v2.0 Gatehouse Photo & Consent Ledger (Phases 11-13) — SHIPPED 2026-09-13</summary>

- [x] Phase 11: Photos & Consent Schema Infrastructure (1/1 plan) — completed 2026-08-30
- [x] Phase 12: Photo Capture & Display — shipped via `.specs/photo-capture/`
- [x] Phase 13: Consent Policy & Gatehouse Workflow — backend shipped with Phase 11; UI via `.specs/consent-gatehouse/`

Full details: [milestones/v2.0-ROADMAP.md](milestones/v2.0-ROADMAP.md) · [requirements](milestones/v2.0-REQUIREMENTS.md) · [audit](milestones/v2.0-MILESTONE-AUDIT.md)

</details>

<details>
<summary>✅ v1.1 UI & Dashboard (Phases 9-10) — SHIPPED 2026-09-12</summary>

- [x] Phase 9: UI Parity & Functional Fixes (residents page) — shipped without GSD artifacts
- [x] Phase 10: Dashboard Live Stats & Vehicle Edit — shipped without GSD artifacts

Included in the v1.0 archive (Phase 9 partial + Phase 10 shipped): [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

<details>
<summary>✅ v1.0 Modular Monolith MVP (Phases 1-8) — SHIPPED 2026-07-13</summary>

- [x] Phases 1-8: modular monolith foundation, strangler pilot, module migrations, design system, demo mode, continuous engineering baseline

Full details: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)

</details>

## Next Milestone: v2.3 — Door Integration & Hardware Access (simulator-first)

**Started:** 2026-09-22

**Goal:** Build the complete door-integration software, security, and UI surface against a simulated device adapter, so that swapping the simulator for a real vendor adapter later is a driver-implementation task, not a redesign. The original door-integration spec (`.specs/door-integration/`, Phases 14–15) assumed real hardware that does not exist yet; v2.3 delivers everything that is hardware-independent and retires the Phase 14–15 reservations (phase numbering continues from 23).

**Scope principle:** Real vendor driver work and any on-site hardware verification stay OUT OF SCOPE (deferred to DOOR-R1..R3). All software, security, and UI work is integration-tested against a Docker-hosted mock device service / in-memory test double wired behind the same `IDoorController`/`IDeviceHandler` interfaces.

**Sequencing note (worktrees in flight):** `feat/unified-visits-flow-cleanup` (entry-log write-path retirement, dead widget deletion) and `fix/gatehouse-direction-persistence` (direction persistence) must land on `main` first; Phase 25 ledger integration builds on the post-cleanup contract and does NOT re-scope items fixed on those branches. Milestone v2.2 (Phases 19–22) executes in parallel on `feat/v2-2-milestone-planning` — no phase overlap with v2.3.

- [ ] **Phase 23: Device Foundation & Simulator Harness** - `IDoorController`/`IDeviceHandler` abstractions + simulated device adapter, encrypted `devices` table, HMAC-signed rate-limited unlock endpoint, tamper-evident unlock audit log
- [ ] **Phase 24: Device Administration & Tenant Opt-In** - `door_integration_enabled` opt-in flag with admin enablement UI; device registration/management UI for TenantAdmins
- [ ] **Phase 25: Reader Events & Ledger Integration** - Event ingestion + `DeviceEvent` normalization, `device_events` persistence, card-match events create ledger entries, idempotent replay-on-reconnect
- [ ] **Phase 26: Device Health Monitoring** - Heartbeat ingestion with per-device thresholds, health dashboard UI, offline alert toast in the porteiro UI

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 23. Device Foundation & Simulator Harness | 0/TBD | Not started | - |
| 24. Device Administration & Tenant Opt-In | 0/TBD | Not started | - |
| 25. Reader Events & Ledger Integration | 0/TBD | Not started | - |
| 26. Device Health Monitoring | 0/TBD | Not started | - |

## Phase Details

### Phase 23: Device Foundation & Simulator Harness
**Goal**: A gatehouse attendant can trigger a verified, fully-audited, cryptographically protected unlock through the same abstraction a real vendor device will implement — proven end-to-end against a simulated device adapter.
**Depends on**: Nothing within v2.3 (new Devices surface in the modular monolith). External: `feat/unified-visits-flow-cleanup` lands first (entry-log area contract referenced by Phase 25).
**Requirements**: DOOR-01, DOOR-02, DOOR-03, DOOR-04, DOOR-07, DOOR-15
**Success Criteria** (what must be TRUE):
  1. `POST /api/v1/devices/{deviceId}/unlock` sends an HMAC-SHA256-signed command through `IDoorController` to the simulated device adapter and returns observable success/failure; a Docker-hosted mock device service (or in-memory test double) behind the same interfaces is exercised by the integration-test suite (DOOR-01, DOOR-15)
  2. A replayed unlock command (captured nonce + signature reused after the timestamp window) is rejected; a non-porteiro caller receives a ProblemDetails denial; a request when the tenant flag is off gets 404 — all verified by integration tests (DOOR-02)
  3. Exceeding the per-device rate limit (max 1 unlock per 3 seconds) returns 429 ProblemDetails, the attempt is audit-logged, and a legitimate retry after the window succeeds (DOOR-07)
  4. Every unlock command writes an append-only, tamper-evident audit row (requesting user, device ID, timestamp, command hash, response status); an integration test proves UPDATE/DELETE on the audit table is rejected by DB triggers (DOOR-03)
  5. Device connection params are stored AES-256-GCM-encrypted per tenant in the `devices` table and never appear in plaintext in persistence, logs, or API responses (DOOR-04)
**Plans**: TBD

### Phase 24: Device Administration & Tenant Opt-In
**Goal**: Condominium administrators control their own door-integration surface — turning the feature on for their condominium and managing their devices — without platform-admin intervention and without carrying the feature's risk when off.
**Depends on**: Phase 23 (devices table, unlock surface, simulator harness must exist to administer).
**Requirements**: DOOR-05, DOOR-06
**Success Criteria** (what must be TRUE):
  1. A condominium with `door_integration_enabled = false` (the default) exposes no door endpoints (404), renders no unlock UI, and carries none of the feature's surface; a TenantAdmin can flip the flag on from an administration screen and the door endpoints become reachable for that tenant only (DOOR-05)
  2. A TenantAdmin can register a new device (type, vendor, gatehouse binding, connection params) from the device management UI and see it in their condominium's device list (DOOR-06)
  3. A TenantAdmin can edit, activate/deactivate, and remove a device, and a deactivated/removed device immediately rejects unlock and event ingestion (DOOR-06)
  4. Connection params entered in the UI are accepted once and never displayed back in plaintext on any screen or API response (DOOR-06)
  5. A TenantAdmin of condominium A cannot see, register, or operate devices of condominium B (tenant isolation enforced via `ITenantAwareLinqFactory`, covered by cross-tenant tests) (DOOR-05, DOOR-06)
**Plans**: TBD
**UI hint**: yes

### Phase 25: Reader Events & Ledger Integration
**Goal**: Reader activity flows into the platform's honest ledger without manual entry — simulated reader events are normalized vendor-agnostically, persisted, turned into ledger entries when credentials match, and survive disconnects via idempotent replay.
**Depends on**: Phase 23 (device abstractions, `devices` table, simulator harness). External: post-cleanup entry-log contract (`feat/unified-visits-flow-cleanup`).
**Requirements**: DOOR-08, DOOR-09, DOOR-10, DOOR-11
**Success Criteria** (what must be TRUE):
  1. A simulated reader event is ingested and normalized into the unified `DeviceEvent` model (`device_id`, `event_type`, `payload_json`, `occurred_at`) through `IDeviceHandler`, with business logic unaware of the adapter behind it (DOOR-08)
  2. Every ingested event is persisted in `device_events` with tenant scoping (via `ITenantAwareLinqFactory`) recording both `occurred_at` and `processed_at` (DOOR-09)
  3. A card-match event creates the corresponding entry-log/ledger record automatically on the post-cleanup contract; an unknown-card event is logged as a denied attempt and creates no ledger entry (DOOR-10)
  4. Events queued during downtime are replayed when the simulated device reconnects — no event is lost, no event is processed twice (idempotent replay verified by integration test with connection interruption) (DOOR-11)
**Plans**: TBD

### Phase 26: Device Health Monitoring
**Goal**: Gatehouse staff and administrators see device health at a glance and are warned the moment a device stops responding — so hardware problems surface before they become gatehouse workflow failures.
**Depends on**: Phase 23 (devices, simulator), Phase 25 (event pipeline — heartbeats ride the same ingestion path).
**Requirements**: DOOR-12, DOOR-13, DOOR-14
**Success Criteria** (what must be TRUE):
  1. Simulated heartbeats update `device_heartbeats` (`last_heartbeat_at`, `status` online/offline/degraded, `error_count`) with per-device thresholds (`offline_after_seconds` default 60, `error_rate_threshold` default 10%) (DOOR-12)
  2. The health dashboard shows per-device status, last heartbeat, error rate, and alert badges, visible to TenantAdmin and porteiro; a device crossing its offline threshold flips to offline in the dashboard (DOOR-13)
  3. A device crossing its offline threshold triggers an alert toast in the porteiro UI telling gatehouse staff to use manual entry (DOOR-14)
  4. A device that recovers (heartbeats resume) returns to online/degraded status and clears the alert state without operator intervention (DOOR-12, DOOR-13)
**Plans**: TBD
**UI hint**: yes

## Future Milestones

- 📋 **Real hardware integration (post-v2.3)** — DOOR-R1..R3: real vendor relay/reader drivers implementing `IDoorController`/`IDeviceHandler`, on-site hardware fallback verification (gated on real condominium hardware)
- 📋 **Facial biometrics** — FUT-01, requires separate approved specification
- 📋 Multi-arch Docker/CI (fast-cycle, no milestone)