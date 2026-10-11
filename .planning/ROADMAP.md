# Roadmap: ControlEasy Reborn

## Milestones

- 🚧 **v2.5 — Real Vendor Hardware Integration (Control iD, Intelbras, Hikvision)** — Phases 31-34 (planning 2026-09-23)
- 🚧 **v2.4 — Resident Self-Service & Visitor Experience** — Phases 27-30 (planning 2026-09-23)
- ✅ **v2.3 — Door Integration & Hardware Access (simulator-first)** — Phases 23-26 (shipped 2026-10-11) — [archived](milestones/v2.3-ROADMAP.md) · [requirements](milestones/v2.3-REQUIREMENTS.md) · [audit](milestones/v2.3-MILESTONE-AUDIT.md)
- 🚧 **v2.2 — UI Parity & Operational Closeout** — Phases 19-22 (started 2026-09-22, planning artifacts complete)
- ✅ **v2.1 — Integrated Visits & Account Operations** — Phases 16-18 (shipped 2026-09-20)
- ✅ **v2.0 — Gatehouse Photo & Consent Ledger** — Phases 11-13 (shipped 2026-09-13)
- ✅ **v1.1 — UI & Dashboard** — Phases 9-10 (shipped 2026-09-12, no GSD artifacts)
- ✅ **v1.0 — Modular Monolith MVP** — Phases 1-8 (shipped 2026-07-13)

## Phases

<details>
<summary>🚧 v2.5 Real Vendor Hardware Integration — Control iD, Intelbras, Hikvision (Phases 31-34) — PLANNING 2026-09-23</summary>

- [ ] **Phase 31: Edge Agent & Driver Foundation** - Outbound-only WSS edge agent (per-agent credentials, agent health rides `device_heartbeats`), local event queue with idempotent replay, vendor contract-test simulators (zero hardware in CI), real-device provisioning with vendor profiles, Hikvision partner-doc access request
- [ ] **Phase 32: Control iD Driver (DOOR-R1)** - Unlock via public Access API; access-log/turnstile/heartbeat webhooks normalized to `DeviceEvent`; ledger + denied-attempt paths; HTTPS verification task (UNVERIFIED in research)
- [ ] **Phase 33: Intelbras Driver (DOOR-R2 — abstraction proven)** - Edge-agent-resident connect-and-subscribe ingestion (API doc V1.3), relay unlock, firmware-quirk verification against the actual device
- [ ] **Phase 34: Hikvision Driver & On-Site Pilot (DOOR-R3)** - ISAPI door commands with digest auth, alert-stream events, mandatory VLAN isolation; on-site pilot at a real condominium (fallback verification, replay, latency, health dashboard) + pilot report

Full details in Phase Details below · requirements: [milestones/v2.5-REQUIREMENTS.md](milestones/v2.5-REQUIREMENTS.md)

</details>

<details>
<summary>🚧 v2.4 Resident Self-Service & Visitor Experience (Phases 27-30) — PLANNING 2026-09-23</summary>

- [ ] **Phase 27: Resident Access Foundation** - TenantAdmin resident-credential provisioning (activate/suspend/revoke), resident role login with BCrypt ≥ 11 + enumeration-safe responses, apartment-scoped isolation with cross-apartment integration tests
- [ ] **Phase 28: Visitor Pre-Registration & Purpose Codes** - Resident pre-registration CRUD with validity windows, edit/cancel lifecycle with read-only consumed history, per-tenant purpose codes stamped on visits
- [ ] **Phase 29: Visitor Self Check-In** - Pre-authorized self check-in through the unified `VisitorArrivalHandler` write path, denied-path security (uniform ProblemDetails, rate limiting, audit), printable badge at check-in
- [ ] **Phase 30: Resident Visibility, Notifications & Gatehouse Panel Integration** - Apartment-scoped visit history, in-app arrival notifications, gatehouse panel pending pre-registrations with document matching + badge print trigger

Full details in Phase Details below · requirements: [REQUIREMENTS.md](REQUIREMENTS.md)

</details>

<details>
<summary>✅ v2.3 Door Integration & Hardware Access — simulator-first (Phases 23-26) — SHIPPED 2026-10-11</summary>

- [x] **Phase 23: Device Foundation & Simulator Harness** - `IDoorController`/`IDeviceHandler` abstractions, simulated device adapter, `devices` table with AES-256-GCM-encrypted connection params, secure unlock endpoint with HMAC/replay/rate-limit security bar, append-only tamper-evident unlock audit (completed 2026-10-10)
- [x] **Phase 24: Device Administration & Tenant Opt-In** - `door_integration_enabled` tenant opt-in flag with admin UI, device registration/management UI (register, edit, activate/deactivate, remove) (completed 2026-10-11)
- [x] **Phase 25: Reader Events & Ledger Integration** - `device_events` table, event ingestion → `DeviceEvent` normalization, ledger entries from card-match events, denied-attempt logging, idempotent replay-on-reconnect (completed 2026-10-11)
- [x] **Phase 26: Device Health Monitoring** - `device_heartbeats` tracking with per-device alert thresholds, health dashboard UI, offline alert toast in porteiro UI (completed 2026-10-11)

Full details in Phase Details below · requirements: [milestones/v2.3-REQUIREMENTS.md](milestones/v2.3-REQUIREMENTS.md) · audit: [milestones/v2.3-MILESTONE-AUDIT.md](milestones/v2.3-MILESTONE-AUDIT.md)

</details>

<details>
<summary>🚧 v2.2 UI Parity & Operational Closeout (Phases 19-22) — PLANNED (started 2026-09-22)</summary>

- [ ] **Phase 19: Ledger & Reports Polish** - Summary day-bucketing, honest filter vocabulary and search scope, condominium-level package drops, X-Total-Count exposure
- [ ] **Phase 20: Account Operations & Consent Audit UI** - TenantAdmin password-reset surface and consent-audit review with evidence rendering + CSV export
- [ ] **Phase 21: Photo Capture & Display UI** - Browser photo capture (camera/file-picker) with compression, display integration across record pages, resilient uploads
- [ ] **Phase 22: Mockup Parity & Test Closeout** - Mockup parity/functional fixes for high-traffic screens, stale E2E refresh, Nyquist validation coverage

Full details in Phase Details below · archived snapshot: [milestones/v2.2-ROADMAP.md](milestones/v2.2-ROADMAP.md) · [requirements](milestones/v2.2-REQUIREMENTS.md); no phase overlap with v2.3 (Phases 19–22 vs 23–26).

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

## Next Milestone: v2.4 — Resident Self-Service & Visitor Experience

**Started:** 2026-09-23

**Goal:** The resident stops being a row in someone else's table. Residents get portal access scoped to their own apartment, pre-register expected visitors (identity, purpose, validity window), watch arrivals in their visit history, and receive in-app arrival notifications. Visitors self check-in through a pre-authorization against the SAME unified write path the gatehouse uses. The porteiro sees pending pre-registrations at the gatehouse panel and prints badges for pre-authorized arrivals. Scope sourced from the v2.1 deferred requirements pool — zero external dependencies.

**Scope principle:** Resident authentication is the second-biggest credential-surface addition after door unlock — the constitutional security bar applies throughout (BCrypt ≥ 11, enumeration-safe uniform responses, apartment-scoped isolation integration tests mandatory, all tenant-scoped reads/writes via `ITenantAwareLinqFactory`, `ProblemDetails` RFC 7807 everywhere). Self check-in MUST reuse the unified `VisitorArrivalHandler` write path — no second door into the Visits data model. Portal-only notifications (no push/mobile-native), data matching (no ID-scanner hardware), browser print (no badge-printer hardware).

**Sequencing note (satisfied 2026-09-26):** `feat/unified-visits-flow-cleanup` (PR #11, `7a5eb35`) and `fix/gatehouse-direction-persistence` (PR #10, `0d8f96a`) have landed on `origin/main` — Phase 29 self check-in builds on the unified write path's post-cleanup contract and does NOT re-scope items fixed on those branches. Milestones v2.2 (Phases 19–22) and v2.3 (Phases 23–26) are planned/executed in parallel — no phase overlap with v2.4 (Phases 27–30).

- [ ] **Phase 27: Resident Access Foundation** - TenantAdmin resident-credential provisioning (create/activate, suspend/revoke), new resident role + login with BCrypt ≥ 11 and enumeration-safe uniform responses, apartment-scoped data isolation with cross-apartment integration tests
- [ ] **Phase 28: Visitor Pre-Registration & Purpose Codes** - Resident pre-registration CRUD (full name, document, optional plate, purpose code, validity window), edit/cancel lifecycle with read-only cancelled/consumed history, per-tenant configurable purpose codes stamped on the resulting visit
- [ ] **Phase 29: Visitor Self Check-In** - Self check-in via document match or pre-auth code through the unified `VisitorArrivalHandler` write path (same states as gatehouse check-in), denied-path security (uniform enumeration-safe ProblemDetails, per-source rate limits, audit log), printable badge at check-in via browser print
- [ ] **Phase 30: Resident Visibility, Notifications & Gatehouse Panel Integration** - Apartment-scoped visit history from the honest source, in-app arrival notifications, gatehouse panel pending pre-registrations expected today with CPF/document matching, one-click check-in, and badge print trigger

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 27. Resident Access Foundation | 0/TBD | Not started | - |
| 28. Visitor Pre-Registration & Purpose Codes | 0/TBD | Not started | - |
| 29. Visitor Self Check-In | 0/TBD | Not started | - |
| 30. Resident Visibility, Notifications & Gatehouse Panel Integration | 0/TBD | Not started | - |

## Phase Details

### Phase 19: Ledger & Reports Polish

**Goal**: The reports surface tells one honest story — the daily summary, status filters, search, pagination, and package-drop entry all match what the unified ledger backend actually serves.
**Depends on**: Nothing within v2.2. External prerequisite SATISFIED (2026-09-26): `feat/unified-visits-flow-cleanup` (PR #11, `7a5eb35`) and `fix/gatehouse-direction-persistence` (PR #10, `0d8f96a`) landed on `main` (entry-log area contract).
**Requirements**: LEDGER-01, LEDGER-02, LEDGER-03, LEDGER-04, LEDGER-05
**Success Criteria** (what must be TRUE):

  1. The daily visit-count summary card agrees with the unified ledger for events near the condominium's day boundary — both bucketed by the tenant day, not raw UTC
  2. Every status-filter option on the ledger maps to a state the backend can actually return; selecting any option shows matching rows or a correct empty state (inert 'Recorded'/'Refused' options gone)
  3. Ledger search returns what its placeholder promises (PackageDescription/SubjectName/Purpose) — placeholder wording and backend `q` scope agree
  4. From the package-drop UI, an admin can register a condominium-level drop (destination apartment omitted) and see it in the ledger alongside apartment-bound drops
  5. Non-same-origin consumers receive the `X-Total-Count` header (exposed via `WithExposedHeaders`) so ledger pagination totals work beyond the SPA origin

**Plans**: 4 plans
Plans:
**Wave 1**

- [ ] 19-01-PLAN.md — Tenant-day bucketing in the daily visit-count summary (LEDGER-01)
- [ ] 19-02-PLAN.md — Honest status-filter vocabulary + search placeholder alignment (LEDGER-02, LEDGER-03)
- [ ] 19-03-PLAN.md — Condominium-level package-drop trigger (LEDGER-04)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 19-04-PLAN.md — X-Total-Count header exposure via WithExposedHeaders (LEDGER-05)

**UI hint**: yes

### Phase 20: Account Operations & Consent Audit UI

**Goal**: Tenant administrators can run credential operations and review consent-audit evidence from their own tenant-reachable screens, without needing a platform-admin login.
**Depends on**: Nothing within v2.2 (backends shipped in v2.0 Phase 11/13 and v2.1 Phase 18). External prerequisite SATISFIED (2026-09-26): cleanup branches merged (`feat/unified-visits-flow-cleanup` PR #11 `7a5eb35`, `fix/gatehouse-direction-persistence` PR #10 `0d8f96a`) so the audit state vocabulary matches the post-cleanup contract now shipped on `main`.
**Requirements**: ACCNT-01, ACCNT-02, CONSU-01, CONSU-02, CONSU-03
**Success Criteria** (what must be TRUE):

  1. A TenantAdmin can reset another admin's or porteiro's password directly from the condominium management UI, with no platform-admin step
  2. The reset flow shows delivery feedback (temp password dispatched via SMTP) and the reset user is forced to change password at next login (`MustChangePassword`)
  3. An admin can filter the consent audit by date range, category, entry state, and porteiro, and see only matching rows
  4. Audit rows render state-appropriate evidence: `entered_with_consent` photo thumbnail with lightbox, `entered_override` highlighted with reason + porteiro, `gatehouse_only`/`denied` badges
  5. An admin can export the consent audit as CSV with millisecond-precision `recorded_at` timestamps

**Plans**: 4 plans
Plans:
**Wave 1**

- [ ] 20-01-PLAN.md — Security backend: lift porteiro-only reset restriction, add SMTP dispatch + delivery-state, tenant-scoped staff list (ACCNT-01/02)
- [ ] 20-03-PLAN.md — Entry-log porteiro filter (backend) + audit-filters porteiro dropdown (CONSU-01)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 20-02-PLAN.md — TenantAdmin reset surface + staff list on administration page (ACCNT-01/02)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 20-04-PLAN.md — Audit-row porteiro name resolution + badge mapping + CSV ms-precision verify (CONSU-02/03)

**UI hint**: yes

### Phase 21: Photo Capture & Display UI

**Goal**: Gatehouse staff and admins can capture, view, and enlarge photos for residents, visitors, vehicles, and service providers entirely in the browser, with resilient uploads.
**Depends on**: Nothing within v2.2 (photo storage & API shipped in v2.0 Phase 11, commit `d895c01`).
**Requirements**: PCAP-01, PCAP-02, PCAP-03
**Success Criteria** (what must be TRUE):

  1. From a record page, staff can capture a photo via device camera (`getUserMedia`) or file picker; the stored image is client-side compressed (≤1280px, 0.8→0.6→0.3 ladder) with EXIF metadata stripped
  2. Record lists show lazy photo thumbnails, detail views show the source image, and clicking a photo opens an enlarge lightbox — across resident, visitor, vehicle, and service-provider pages
   3. Uploads retry automatically (3 attempts, 1s/2s/4s backoff) and failures show clear, actionable error states for camera-denied, file-too-large, and retries-exhausted

**Plans**: 3 plans

Plans:
**Wave 1**

- [ ] 21-01-PLAN.md — fetch-lazy ce-photo + ce-photo-thumb primitive (PCAP-02 lazy thumbnail foundation)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 21-02-PLAN.md — wire lazy thumbnail column into residents/vehicles/visits/service-providers list tables (PCAP-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 21-03-PLAN.md — list-endpoint integration tests, list-thumbnail E2E, dead-code cleanup (PCAP-01/02/03 closeout)

**UI hint**: yes

### Phase 22: Mockup Parity & Test Closeout

**Goal**: High-traffic screens visually and functionally match the mockup contract, and the automated test suite reflects the product as actually shipped.
**Depends on**: Phase 19, Phase 20, Phase 21 (E2E refresh and Nyquist validation must cover the final surfaces)
**Requirements**: UI-01, UI-02, TEST-01, TEST-02
**Success Criteria** (what must be TRUE):

  1. The login, dashboard, visits, and vehicles screens visually match the mockup in light and dark themes, continuing the residents-page parity
  2. Login form behavior, toast patterns, and page interactions follow the functional-fixes spec (real error paths, submit spinner, auto-dismissing toasts)
  3. The E2E suite exercises the current gatehouse panel and ledger — no specs testing removed dashboard buttons/tiles; stale specs refreshed or removed
  4. Every v2.2 phase has a `*-VALIDATION.md` (Nyquist validation coverage complete for the milestone)

**Plans**: 4 plans
Plans:
**Wave 1**

- [ ] 22-01-PLAN.md — Visits/vehicles component adoption + visual/a11y regression specs for login/dashboard/visits/vehicles (UI-01)
- [ ] 22-02-PLAN.md — Forgot-password toast parity + login 401/busy unit tests (UI-02)
- [ ] 22-04-PLAN.md — Finalize 22-VALIDATION.md + cross-phase 19-22 validation coverage audit (TEST-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 22-03-PLAN.md — Rewrite gatehouse-workflow E2E against tabbed panel + fix module-pages stale labels (TEST-01)

**UI hint**: yes

### Phase 27: Resident Access Foundation

**Goal**: A resident is a first-class authenticated portal user — provisioned by their condominium's administrator, logged in with their own credential, and isolated to their own apartment by integration tests, not by convention.
**Depends on**: Nothing within v2.4 (new Residents-module surface). External prerequisite SATISFIED (2026-09-26): unified write-path contract — `feat/unified-visits-flow-cleanup` (PR #11, `7a5eb35`) and `fix/gatehouse-direction-persistence` (PR #10, `0d8f96a`) landed on `main`.
**Requirements**: RES-01, RES-02, RES-03
**Success Criteria** (what must be TRUE):

  1. A TenantAdmin can provision resident portal access for a resident of an apartment (credential creation/activation) and suspend or revoke it; after revocation the resident's next request is denied — verified by integration test (RES-01)
  2. A provisioned resident can log into the portal with their own credential: passwords hashed with BCrypt ≥ 11, failed logins return uniform enumeration-safe responses, and the resident authenticates with the same JWT machinery as staff under a new resident role (RES-02)
  3. A resident sees ONLY their own apartment's visitors, visits, and pre-registrations; a resident of apartment 101 requesting apartment 302's data is denied — cross-apartment isolation covered by integration tests on every resident-reachable endpoint (RES-03)
  4. All resident-scoped reads/writes flow through `ITenantAwareLinqFactory` (no cross-tenant access) and every error returns `ProblemDetails` (RFC 7807) — verified by architecture and integration tests (RES-01, RES-02, RES-03)

**Plans**: TBD
**UI hint**: yes

### Phase 28: Visitor Pre-Registration & Purpose Codes

**Goal**: A resident manages expected visitors for their own apartment — creating pre-registrations with identity, purpose, and a validity window, editing or cancelling pending ones — with per-tenant purpose codes stamped on the resulting visit records.
**Depends on**: Phase 27 (resident auth and apartment-scoped authorization must exist before residents can create data).
**Requirements**: RES-04, RES-05, RES-06
**Success Criteria** (what must be TRUE):

  1. A resident can create a visitor pre-registration for their OWN apartment with full name, document number, optional vehicle plate, purpose code, and validity window (start/end); creating one for another apartment is denied by integration test (RES-04)
  2. A resident can edit a pending pre-registration or cancel it; cancelled and consumed pre-registrations become read-only history and reject further edits — verified by integration test (RES-05)
  3. A TenantAdmin can manage the per-tenant purpose code list (e.g. Visit, Delivery, Service, Maintenance); the code selected at pre-registration is stamped on the resulting visit record (RES-06)
  4. Pre-registration state transitions (pending → cancelled / consumed) are tenant-scoped via `ITenantAwareLinqFactory` and errors return `ProblemDetails` (RES-05, RES-06)

**Plans**: TBD
**UI hint**: yes

### Phase 29: Visitor Self Check-In

**Goal**: An arriving visitor checks themselves in against a pre-authorization through the SAME unified write path the gatehouse uses — and every denied attempt fails closed: uniform responses, rate-limited, audit-logged.
**Depends on**: Phase 28 (pre-registrations must exist to be consumed).
**Requirements**: RES-07, RES-08, RES-12
**Success Criteria** (what must be TRUE):

  1. An arriving visitor can self check-in with a pre-authorization (document match or pre-auth code); the resulting Visit is created through the unified `VisitorArrivalHandler` write path and lands in the same states as a gatehouse check-in — integration test proves a single write path with no second door into the Visits data model (RES-07)
  2. A pre-registration is consumed on use: an expired validity window, a revoked registration, or an exhausted use is rejected and the registration cannot be reused — verified by integration test (RES-07)
  3. Denied self check-in paths (unknown code, expired window, revoked registration, exhausted use) return uniform enumeration-safe ProblemDetails, are rate-limited per source, and are audit-logged — each denial path verified by integration test (RES-08)
  4. At check-in (self-service or gatehouse), a printable badge is generated (visitor name, apartment, date, validity, QR credential) via browser print — no printer hardware integration (RES-12)

**Plans**: TBD
**UI hint**: yes

### Phase 30: Resident Visibility, Notifications & Gatehouse Panel Integration

**Goal**: The loop closes — residents watch their apartment's visit history and receive in-app arrival notifications, while the porteiro sees pending pre-registrations expected today, matches arriving visitors by document, and checks them in with one click.
**Depends on**: Phase 28 (pre-registrations), Phase 29 (self check-in + badge generation).
**Requirements**: RES-09, RES-10, RES-11
**Success Criteria** (what must be TRUE):

  1. A resident can view their apartment's visit history (past and expected visitors) — read-only, honest data from the same source the porteiro and reports use (RES-09)
  2. When a pre-registered visitor checks in (self or gatehouse), the resident's portal shows an in-app arrival notification — portal-only, no push/mobile-native (RES-10)
  3. The gatehouse panel shows pending pre-registrations expected today, and a porteiro can check a visitor in against a pre-authorization with one click through the same `VisitorArrivalHandler` path (RES-11)
  4. When a visitor arrives, CPF/document matching surfaces the pending pre-registration in the gatehouse panel (RES-11)
  5. From the gatehouse check-in, the porteiro can trigger the badge print for the checked-in visitor (RES-11, RES-12)

**Plans**: TBD
**UI hint**: yes

### Phase 23: Device Foundation & Simulator Harness

**Goal**: A gatehouse attendant can trigger a verified, fully-audited, cryptographically protected unlock through the same abstraction a real vendor device will implement — proven end-to-end against a simulated device adapter.
**Depends on**: Nothing within v2.3 (new Devices surface in the modular monolith). External prerequisite SATISFIED (2026-09-26): `feat/unified-visits-flow-cleanup` landed on `main` (PR #11, `7a5eb35`; entry-log area contract referenced by Phase 25).
**Requirements**: DOOR-01, DOOR-02, DOOR-03, DOOR-04, DOOR-07, DOOR-15
**Success Criteria** (what must be TRUE):

  1. `POST /api/v1/devices/{deviceId}/unlock` sends an HMAC-SHA256-signed command through `IDoorController` to the simulated device adapter and returns observable success/failure; a Docker-hosted mock device service (or in-memory test double) behind the same interfaces is exercised by the integration-test suite (DOOR-01, DOOR-15)
  2. A replayed unlock command (captured nonce + signature reused after the timestamp window) is rejected; a non-porteiro caller receives a ProblemDetails denial; a request when the tenant flag is off gets 404 — all verified by integration tests (DOOR-02)
  3. Exceeding the per-device rate limit (max 1 unlock per 3 seconds) returns 429 ProblemDetails, the attempt is audit-logged, and a legitimate retry after the window succeeds (DOOR-07)
  4. Every unlock command writes an append-only, tamper-evident audit row (requesting user, device ID, timestamp, command hash, response status); an integration test proves UPDATE/DELETE on the audit table is rejected by DB triggers (DOOR-03)
  5. Device connection params are stored AES-256-GCM-encrypted per tenant in the `devices` table and never appear in plaintext in persistence, logs, or API responses (DOOR-04)

**Plans**: 1 plan executed (1/1)

Plans:

- [x] 23-01-PLAN.md — Device Foundation & Simulator Harness

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

**Plans**: 1 plan executed (1/1)

Plans:

- [x] 24-01-PLAN.md — Device Administration & Tenant Opt-In

**UI hint**: yes

### Phase 25: Reader Events & Ledger Integration

**Goal**: Reader activity flows into the platform's honest ledger without manual entry — simulated reader events are normalized vendor-agnostically, persisted, turned into ledger entries when credentials match, and survive disconnects via idempotent replay.
**Depends on**: Phase 23 (device abstractions, `devices` table, simulator harness). External prerequisite SATISFIED (2026-09-26): post-cleanup entry-log contract (`feat/unified-visits-flow-cleanup`, PR #11, `7a5eb35` landed on `main`).
**Requirements**: DOOR-08, DOOR-09, DOOR-10, DOOR-11
**Success Criteria** (what must be TRUE):

  1. A simulated reader event is ingested and normalized into the unified `DeviceEvent` model (`device_id`, `event_type`, `payload_json`, `occurred_at`) through `IDeviceHandler`, with business logic unaware of the adapter behind it (DOOR-08)
  2. Every ingested event is persisted in `device_events` with tenant scoping (via `ITenantAwareLinqFactory`) recording both `occurred_at` and `processed_at` (DOOR-09)
  3. A card-match event creates the corresponding entry-log/ledger record automatically on the post-cleanup contract; an unknown-card event is logged as a denied attempt and creates no ledger entry (DOOR-10)
  4. Events queued during downtime are replayed when the simulated device reconnects — no event is lost, no event is processed twice (idempotent replay verified by integration test with connection interruption) (DOOR-11)

**Plans**: 1 plan executed (1/1)

Plans:

- [x] 25-01-PLAN.md — Reader Events & Ledger Integration

### Phase 26: Device Health Monitoring

**Goal**: Gatehouse staff and administrators see device health at a glance and are warned the moment a device stops responding — so hardware problems surface before they become gatehouse workflow failures.
**Depends on**: Phase 23 (devices, simulator), Phase 25 (event pipeline — heartbeats ride the same ingestion path).
**Requirements**: DOOR-12, DOOR-13, DOOR-14
**Success Criteria** (what must be TRUE):

  1. Simulated heartbeats update `device_heartbeats` (`last_heartbeat_at`, `status` online/offline/degraded, `error_count`) with per-device thresholds (`offline_after_seconds` default 60, `error_rate_threshold` default 10%) (DOOR-12)
  2. The health dashboard shows per-device status, last heartbeat, error rate, and alert badges, visible to TenantAdmin and porteiro; a device crossing its offline threshold flips to offline in the dashboard (DOOR-13)
  3. A device crossing its offline threshold triggers an alert toast in the porteiro UI telling gatehouse staff to use manual entry (DOOR-14)
  4. A device that recovers (heartbeats resume) returns to online/degraded status and clears the alert state without operator intervention (DOOR-12, DOOR-13)

**Plans**: 1 plan executed (1/1)

Plans:

- [x] 26-01-PLAN.md — Device Health Monitoring

**UI hint**: yes

### Phase 31: Edge Agent & Driver Foundation

**Goal**: A small on-site runtime connects the condominium's real hardware to the platform over one outbound-only channel — authenticating per-agent, queueing events through outages, and letting the integration suite exercise vendor simulators with zero physical hardware.
**Depends on**: v2.3 Phases 23–26 (device abstractions, `devices`/`device_events`/`device_heartbeats` tables, unlock security machinery, simulator harness, device admin UI must exist and be shipped).
**Requirements**: HW-01, HW-02, HW-03, HW-04, HW-08
**Success Criteria** (what must be TRUE):

  1. The edge agent connects to the cloud API via a single outbound WSS channel — no inbound ports opened on the condominium network (CGNAT-compatible); each agent authenticates with a per-agent credential issued at provisioning, and a revoked agent's next connection is rejected (HW-01)
  2. Agent link status surfaces in the existing health dashboard via `device_heartbeats` — a dead agent flips its devices to offline, firing the porteiro offline toast (HW-01, rides DOOR-13/DOOR-14)
  3. Events from we-dial-them devices queue locally with per-device sequence numbers and replay on reconnect; replay is idempotent (no event lost, none double-processed) — verified by integration test with connection interruption (HW-02, extends DOOR-11)
  4. Simulators for Control iD (REST + webhook mock), Intelbras (connect-and-subscribe mock), and Hikvision (ISAPI mock with digest auth + alert stream) are exercised by the integration suite with zero physical hardware (HW-03)
  5. The v2.3 unlock/event integration suites run unchanged against each vendor simulator — the security bar (HMAC, replay window, rate limit, tamper-evident audit, encrypted connection params) is vendor-agnostic, proven not assumed (HW-08)
  6. A TenantAdmin registers a real device choosing vendor + model profile; per-vendor connection params are validated and AES-256-GCM-encrypted (riding DOOR-04/DOOR-06), we-dial-them devices are bound to an agent (HW-04)
  7. Hikvision partner-portal doc access requested (unblocks Phase 34) (HW-07 dependency)

**Plans**: TBD

### Phase 32: Control iD Driver (DOOR-R1)

**Goal**: The first real integration — a porteiro's unlock click opens a real Control iD door/turnstile, and real card events flow into the ledger through the same abstractions the simulator proved.
**Depends on**: Phase 31 (agent foundation, contract harness, provisioning).
**Requirements**: HW-05, HW-08
**Success Criteria** (what must be TRUE):

  1. `POST /api/v1/devices/{deviceId}/unlock` reaches a real Control iD device through the Access API (remote door/turnstile release) and returns observable success/failure — verified end-to-end against the Control iD simulator and the pilot device (HW-05, DOOR-R1)
  2. Device-push notifications (access logs, catraca turn confirmations, `device_is_alive` heartbeats) are ingested and normalized to `DeviceEvent`; a card-match event creates the ledger entry, an unknown card logs a denied attempt — riding the DOOR-08..10 pipeline (HW-05)
  3. Control iD's HTTPS support for device callbacks is verified against the actual device; if absent, the callback path is documented as agent-relayed with the residual risk stated (research-flagged UNVERIFIED) (HW-05)
  4. The v2.3 security suite passes against the Control iD simulator unchanged (HW-08)

**Plans**: TBD

### Phase 33: Intelbras Driver (DOOR-R2 — the abstraction is proven)

**Goal**: The second real integration — Intelbras events and unlock ride the SAME seams Control iD used, with only a driver swap; any change to the shared abstraction is the signal the abstraction was wrong.
**Depends on**: Phase 32 (first driver; the abstraction now has one real implementation to be proven by a second).
**Requirements**: HW-06, HW-08
**Success Criteria** (what must be TRUE):

  1. The Intelbras driver ingests events via connect-and-subscribe (official integration API, doc V1.3, 2020 — no webhook push) as an edge-agent-resident adapter; relay actuation performs unlock (HW-06)
  2. Every endpoint used is verified against the actual device or vendor-confirmed documentation before sign-off; firmware-generation quirks (doc V1.3 is 2020-era) are recorded in the driver docs (HW-06)
  3. The driver swap adds no changes to `IDoorController`/`IDeviceHandler` shared contracts beyond additive model needs — the second integration proves the abstraction (DOOR-R2); any non-additive change is escalated as a redesign finding, not absorbed silently
  4. The v2.3 security suite passes against the Intelbras simulator unchanged (HW-08)

**Plans**: TBD

### Phase 34: Hikvision Driver & On-Site Pilot (DOOR-R3)

**Goal**: The third driver lands behind VLAN isolation with digest auth — and the milestone ends where the hardware lives: a real condominium where the door opens without us, the events arrive when we return, and the porteiro's day is unchanged.
**Depends on**: Phase 31 (doc access requested), Phase 33 (abstraction proven by two drivers).
**Requirements**: HW-07, HW-09
**Success Criteria** (what must be TRUE):

  1. Unlock executes via the ISAPI door-command family with digest auth; events arrive via the alert-stream subscription — edge-agent-resident, exact endpoints verified against vendor-confirmed docs (partner access from Phase 31) (HW-07)
  2. Hikvision deployment documentation mandates VLAN isolation and forbids internet exposure — enforced by a deployment checklist, not convention (CVE history) (HW-07)
  3. At the pilot condominium with real hardware of at least one supported vendor: card reader + manual release operate with the API down (participant, not gatekeeper), missed events replay on reconnect, unlock latency is acceptable, and the health dashboard reflects the real devices (HW-09, DOOR-R3)
  4. Pilot findings are recorded in a pilot report (latency, reliability, installer friction, doc-vs-reality gaps) feeding the second-wave driver decisions (HW-09)

**Plans**: TBD
**UI hint**: yes

## Future Milestones

- 📋 **Second hardware wave (post-v2.5)** — Henry catraca driver (community-reverse-engineered TCP protocol), Shelly relay tier (gate motors: Nice, Garen, Peccinin, Rozzi), TopData driver (WebSocket online mode) — see `milestones/v2.5-REQUIREMENTS.md` deferred pool; DOOR-R1..R3 themselves concretized as v2.5
- 📋 **Facial biometrics** — FUT-01, requires separate approved specification
- 📋 Multi-arch Docker/CI (fast-cycle, no milestone)
