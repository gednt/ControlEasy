# Milestones

## v2.2 UI Parity & Operational Closeout (Shipped: 2026-09-26)

**Phases completed:** 4 phases, 15 plans, 0 tasks

**Key accomplishments:**

- 22-01 — visits/vehicles component adoption + visual/a11y regression specs for login/dashboard/visits/vehicles (UI-01)
- 22-02 — Forgot-password toast parity + login 401/busy unit tests (UI-02)
- 22-03 — Rewrite gatehouse-workflow E2E + fix module-pages stale labels (TEST-01)
- 22-04 — Finalize 22-VALIDATION.md + cross-phase audit (TEST-02)

---

## v2.5 Real Vendor Hardware Integration — Control iD, Intelbras, Hikvision (Defined: 2026-09-23)

**Phases:** 31, 32, 33, 34
**Status:** Planning (requirements + roadmap defined; phases not started; executes after v2.3's simulator foundation ships)

**Scope:** Three first-party vendor drivers implementing the v2.3 `IDoorController`/`IDeviceHandler` abstractions — Control iD (public Access API + device-push webhooks), Intelbras (connect-and-subscribe, doc V1.3), Hikvision (ISAPI, VLAN-isolated, digest auth) — plus the **edge agent** (outbound-only WSS on-site runtime, forced into scope by the two we-dial-them vendors; all three drivers ride it), vendor contract-test simulators (zero physical hardware in CI), real-device provisioning with vendor profiles, security-bar parity, and the on-site pilot (DOOR-R3). Second hardware wave (Henry, Shelly relay tier for gate motors, TopData) deferred to the v2.5-REQUIREMENTS.md pool.

**Key decisions:**

- Felipe's vendor pick (2026-09-23): Control iD, Hikvision, Intelbras — all from the research gold-signal list (Condfy cross-validation); Henry/TopData/Shelly deferred to the second wave
- Edge agent forced into scope: two of three vendors are we-dial-the-device surfaces behind CGNAT; direct cloud→LAN exposure rejected; all drivers ride one channel
- Driver order: Control iD (DOOR-R1) → Intelbras (second proves the abstraction, DOOR-R2) → Hikvision (partner-gated docs; access requested in Phase 31 to unblock Phase 34)
- Zero physical hardware in CI — vendor simulators per surface; real-device verification only at the pilot
- Research-flagged UNVERIFIED items (Control iD HTTPS, Intelbras V1.3 firmware quirks, Hikvision endpoint paths) become per-driver verification tasks

**Specs:** `.specs/door-integration/` (original spec — hardware layer concretized by this milestone)
**Roadmap:** `.planning/ROADMAP.md` (v2.5 section) · **Requirements:** `.planning/milestones/v2.5-REQUIREMENTS.md`
**Origin:** party-mode hardware-research session (2026-09-23), concretizing DOOR-R1..R3

---

## v2.4 Resident Self-Service & Visitor Experience (Started: 2026-09-23)

**Phases:** 27, 28, 29, 30
**Status:** Planning (requirements + roadmap defined; phases not started)

**Scope:** Turn the resident into a first-class platform user — resident portal access (new credential class, apartment-scoped isolation), visitor pre-registration with validity windows and per-tenant purpose codes, visitor self check-in riding the unified `VisitorArrivalHandler` write path (no second door into the Visits data model), apartment-scoped visit history, in-app arrival notifications, and printable badges via browser print (no printer hardware). Planned in BMAD party-mode session 6.

**Specs:** TBD per phase
**Roadmap:** `.planning/ROADMAP.md` (v2.4 section) · **Requirements:** `.planning/REQUIREMENTS.md`
**Origin:** party-mode session 6 (2026-09-23), sourced from the v2.1 deferred requirements pool

---

## v2.3 Door Integration & Hardware Access — Simulator-First (Shipped: 2026-10-11)

**Phases completed:** 4 phases (23–26), 4 plans, 26 atomic commits, 179 files changed (+15,894/−58 LOC)
**Status:** ✅ Shipped (audit `passed` — 15/15 DOOR-* requirements, 9/9 cross-phase integration checks verified, 0 constitutional regressions)
**Git range:** `4b9d5dd`..`a42087c` on `feat/milestone-v2.3` (2026-10-10 → 2026-10-11)
**Tag:** `v2.3` (local; not pushed per AGENTS.WORKTREES.md)

**Scope:** The complete hardware-independent portion of the door-integration spec (`.specs/door-integration/`), re-scoped simulator-first: `IDoorController`/`IDeviceHandler` abstractions, the full security machinery (HMAC-SHA256 per-tenant keys, nonce+timestamp replay window, rate limiting, append-only tamper-evident audit, AES-256-GCM-encrypted connection params, porteiro-role authorization), device-event normalization feeding the ledger, device health monitoring, and the admin/porteiro UI — all integration-tested against a simulated/loopback device adapter. Real vendor driver work and on-site hardware verification are deferred to DOOR-R1..R3 (gated on real condominium hardware); swapping the simulator for a real adapter later is a driver-implementation task, not a redesign.

**Delivered:**

- **Phase 23 — Device Foundation & Simulator Harness:** `IDoorController` + `SimulatedDoorController` with HMAC-SHA256 unlock (HKDF per-tenant key), nonce + timestamp replay window, per-device rate limiter (1 unlock / 3s), append-only `DeviceUnlockAudit` (DB triggers reject UPDATE/DELETE with signal 45000), AES-256-GCM connection-params encryption, dev-only simulator inspector endpoint. 29 new tests (15 integration + 14 unit)
- **Phase 24 — Device Administration & Tenant Opt-In:** TenantAdmin opt-in flag (`Tenants.DoorIntegrationEnabled`) + device register/edit/activate/remove admin UI, AES-256-GCM-encrypted connection params (never displayed in plaintext), cross-tenant 404 (not 403), soft-delete with 24h quiet-period guard. Angular `/administration` Door Integration section + standalone `DeviceFormModalComponent`. 39 new tests (15 integration + 12 Angular + 9 Playwright + 3 a11y)
- **Phase 25 — Reader Events & Ledger Integration:** `device_events` append-only ledger + idempotency 4-tuple UNIQUE `(tenant_id, device_id, sequence_number, external_event_id)` translated from MySQL errno 1062 to `DuplicateIdempotencyKeyException`. `IDeviceHandler.Normalize(...)` vendor-agnostic abstraction. Single-write-path doctrine enforced by code grep — every Visit / AccessEvent / RefusedScanAttempt write flows through `RecordAccessScanHandler` / `RecordRefusedScanHandler` / `VisitorArrivalHandler`. 11 new integration tests across ingestion / idempotency / cross-tenant
- **Phase 26 — Device Health Monitoring:** `device_heartbeats` one-row-per-device upsert with derived online/offline/degraded status (per-device thresholds default 60s/10%); Angular `DeviceHealthService` singleton shared between `/devices` and `/gatehouse-panel` — 30s polling + 60s back-off after 3 errors + transition detection; `/devices` standalone dashboard page; gatehouse-panel inline ce-toast on offline transition edges. 13 new integration tests + 24 new Angular specs + 3 Playwright visual + a11y specs

**Verification:** All 4 phases have `*-VERIFICATION.md` with `status: passed`. Milestone audit `passed` — 9/9 cross-phase integration checks verified, 15/15 DOOR-* requirements covered, 0 constitutional regressions (`.planning/milestones/v2.3-MILESTONE-AUDIT.md`).

**Tests:** 269/269 unit + 20/20 architecture + 54/54 Devices integration + 24/24 device-health Angular specs — all green on the milestone closeout worktree. Per-phase Web SPA gates green.

**Known tech debt (forward-compatible shims, accepted at closeout):**

- Per-device threshold override UI on `/devices` (Configure button) — disabled with tooltip; defaults 60s/10% suffice for the simulator path
- OpenAPI client regeneration drift — handwritten `DevicesApiService` covers Phase 24/25/26 endpoints; regeneration deferred to v2.5 Phase 31 cleanup
- Windows-host Web production Docker build skip — Phase 26 ran `ng test` via `ChromeHeadlessNoSandbox` on Windows instead of the canonical Gitea runner
- Subquery flake in `RunInitScripts` (pre-existing) — per-collection runs (Devices, AccessControl, etc.) are green; canonical CI gate runs the `--filter Devices` partition; v2.4 will fix by per-collection DBs

**Key decisions:**

- Simulator-first re-scope (2026-09-22): the original Phases 14–15 reservations assumed real hardware that does not exist; reservations retired, phase numbering continues from 23
- Remote unlock is security-sensitive — full constitutional security bar applies (rate limiting, HMAC-SHA256, replay protection, tamper-evident audit, encrypted connection params, porteiro-role authorization)
- Ledger integration (Phase 25) builds on the post-cleanup entry-log contract (`feat/unified-visits-flow-cleanup` — PR #11 merged to `main` 2026-09-26, `7a5eb35`)
- Single-write-path doctrine (Phase 25): Devices never instantiates Visit / AccessEvent / RefusedScanAttempt entities; every ledger write flows through the canonical AccessControl/Visits handlers. Enforced by code grep in the audit
- Idempotency 4-tuple UNIQUE (Phase 25): survives disconnect-during-firmware-crash replay use case
- DeviceStatus derived at heartbeat ingestion, no background sweep (Phase 26); v2.5 edge agent introduces periodic poll on its own clock
- Milestone v2.2 (Phases 19–22) is planned and unexecuted; lineage unified with v2.3/v2.4 on `feat/planning-lineage-unification` (2026-09-23); no phase overlap

**Specs:** `.specs/door-integration/` (original spec — re-scoped by this milestone)
**Roadmap:** `.planning/milestones/v2.3-ROADMAP.md` (archive) · **Requirements:** `.planning/milestones/v2.3-REQUIREMENTS.md` · **Audit:** `.planning/milestones/v2.3-MILESTONE-AUDIT.md`
**Origin:** v2.3 planning session (2026-09-22), re-scope of the 2026-08-23 party-mode door-integration spec

---

## v2.2 UI Parity & Operational Closeout (Started: 2026-09-22 — planning lineage unified 2026-09-23)

**Phases:** 19, 20, 21, 22
**Status:** Planned (per-phase planning complete 2026-09-24 via GSD plan-phase: 15 PLAN.md files + per-phase CONTEXT/RESEARCH/VALIDATION; plan-checker verified, all blockers resolved; requirements coverage 17/17; not yet executed)

**Scope:** Software-only closeout — finish the ledger (day-bucketing, filter vocabulary, search scope, condominium-level package drops, X-Total-Count), complete pending UI surfaces (TenantAdmin password reset, consent audit review, photo capture), advance mockup parity, and refresh the test suite. Derived from `.planning/milestones/v2.1-MILESTONE-AUDIT.md` carryovers and v2.0/v2.1 partial requirements.

**Phases:**

- Phase 19: Ledger & Reports Polish (`LEDGER-01..05`)
- Phase 20: Account Operations & Consent Audit UI (`ACCNT-01..02`, `CONSU-01..03`)
- Phase 21: Photo Capture & Display UI (`PCAP-01..03`)
- Phase 22: Mockup Parity & Test Closeout (`UI-01`, `UI-02`, `TEST-01`, `TEST-02`)

**Roadmap:** `.planning/milestones/v2.2-ROADMAP.md` (snapshot; live phase detail + plan lists in `.planning/ROADMAP.md` Phase Details + `.planning/phases/19-*`…`22-*` plan files) · **Requirements:** `.planning/milestones/v2.2-REQUIREMENTS.md`
**Origin:** Party-mode planning session (2026-09-22)

---

## v2.1 Integrated Visits & Account Operations (Shipped: 2026-09-20)

**Phases completed:** 3 phases (16–18), 9 plans

**Delivered:** The gatehouse visit record is single-sourced — every visitor arrival (QR scan, manual lookup, walk-in) produces or advances a Visit row, the backend serves one honest chronological ledger, administrators get a real `/reports` page, and password recovery covers administrators and gatekeepers.

**Key accomplishments:**

- Unified visitor write path: single `VisitorArrivalHandler` serves QR scan, manual lookup, and walk-in (`CheckInNow: true`); AccessEvent→VisitId durable links (migrations 14, 0011, 0012); entry-log re-scoped to privacy-consent role
- Package drops as first-class AccessEvents with free-text description + structured carrier codes (apartment-bound and condominium-level), filterable in the ledger
- One honest unified ledger: `GET /api/v1/reports/history` single UNION (Visits + visitor AccessEvents + legacy entry-log segment) with native state stamps, `kind` discriminator, per-branch tenant predication, X-Total-Count pagination
- Consolidated `/gatehouse` operator panel (QR scan, manual lookup, walk-in, open visits tabs) with deep-link parity; `/visits` demoted to admin register; QR camera facingMode persisted per device
- `/reports` page: Today/7d/30d/custom ranges, visit counts by day, residents per apartment, server-side ledger search/filter, millisecond-precision CSV export (dead dashboard link fixed)
- Complete password management: enumeration-safe forgot-password (constant-cost decoy verify + partitioned rate limiter), platform/tenant admin resets with refresh-token revocation, BCrypt work factor pinned ≥ 11, MailKit SMTP + Mailpit dev catch-all, redaction arch tests

**Verification:** All 3 phases have `*-VERIFICATION.md` with `status: passed`; runtime local CI gate green (unit + integration + architecture + Angular tests). Milestone audit `tech_debt` — no blockers (`.planning/milestones/v2.1-MILESTONE-AUDIT.md`).

**Known gaps (audit tech_debt, accepted at closeout):**

- INFRA-02 partial: `GetVisitCountsByDayAsync` buckets by raw UTC (ledger uses TenantDayBoundary) — daily summary card can disagree with ledger near the São Paulo day boundary
- PASS-03 partial: TenantAdmin reset path complete backend-side; no TenantAdmin-reachable UI invokes the reset endpoint yet
- PANEL-05: ledger status filter "Recorded"/"Refused" options match no backend NativeState values (inert); search placeholder promises document/destination but backend `q` covers PackageDescription/SubjectName/Purpose only
- Stale E2E suite (`e2e/gatehouse-workflow.spec.ts`) tests removed dashboard buttons/tiles; not run by CI gate
- Frontend remnant: entry-workflow "Gatehouse only" tile dead wiring (posts rejected `gatehouse_only` state; unreachable)
- X-Total-Count not in WithExposedHeaders (same-origin only); package-drop UI lacks condominium-level destination trigger
- IMemoryCache-based idempotent forgot-password resend is per-process (single-instance assumption)
- Nyquist coverage missing: no `*-VALIDATION.md` for Phases 16–18 (validate-phase never run; coverage TODO)

**Known verification overrides:** 1 newly acknowledged todo (`integrated-visits-flow.md`, superseded by Phases 16–17 shipped work), 0 carried forward from a prior close (see STATE.md Deferred Items).

**Git range:** `eeebe37`..`2134fcc` (2026-09-19 → 2026-09-20); 121 files, +11,143/−1,018 lines

**What's next:** ~~v2.2 Door Integration~~ → superseded: v2.2 became UI Parity & Operational Closeout; Door Integration re-scoped simulator-first as v2.3 (2026-09-22). Multi-arch Docker/CI as fast-cycle work.

---

## v1.0 Reborn MVP (Shipped: 2026-07-13)

**Phases completed:** 11 phases, 11 plans, 0 tasks

**Delivered:** A tenant-isolated ASP.NET Core and Angular access-control platform with core condominium modules, canonical Docker runtime, hardened design system, demo environment, and continuous engineering gates.

**Key accomplishments:**

- Shipped the modular monolith and tenant-aware Residents, Visits, Vehicles, ServiceProviders, Apartments, Security, Administration, and Reports slices.
- Migrated persistence to the official DBTools 1.4.3 NuGet package and added a DBTools-backed runtime health check.
- Hardened the Angular design system with canonical tokens, reusable `ce-*` components, accessibility coverage, and visual regression snapshots.
- Added deterministic demo mode, first-boot administration, and tenant-switching flows.
- Added GitHub Actions, generated OpenAPI artifacts with drift enforcement, tenant-isolation guards, and token contract tests.

**Verification:** 79 unit, 55 integration, 6 architecture, and 203 Angular tests passed; Docker API/web rebuilt and `/health` returned `Healthy`.

**Known debt:** Generated OpenAPI artifacts are drift-checked but handwritten Angular services do not consume them yet.

**What's next:** v1.1 UI parity, dashboard live data, and vehicle editing.

---

## v1.1 UI & Dashboard (Defined: 2026-08-23 — Shipped without GSD artifacts 2026-09-12)

**Phases:** 9, 10
**Status:** Shipped (no GSD artifacts)

**Scope:** Complete the deferred UI parity, functional fixes, dashboard live data, and vehicle editing work from the v1.0-era user experience surface.

**Phases:**

- Phase 9: UI Parity & Functional Fixes (`UI-03`, `UI-04`) — residents page rebuilt with `ce-*` components (commit `0976037`); other pages not yet rebuilt
- Phase 10: Dashboard Live Stats & Vehicle Edit (`DASH-01`, `DASH-02`, `DASH-04`) — shipped: `GET /api/v1/dashboard/stats`, dashboard UI with live stat tiles, vehicle edit modal + `update()` in VehiclesApiService

**Roadmap:** `.planning/ROADMAP.md`
**Note:** Phase 9 and 10 shipped without GSD artifacts (PLAN/SUMMARY/VERIFICATION). Backfill is optional — same pattern as v1.0 Phases 1–6 + 11.

---

## v2.0 Gatehouse Photo & Consent Ledger (Defined: 2026-08-23 — Shipped 2026-09-13)

**Phases:** 11, 12, 13
**Status:** ✅ Shipped (all 3 phases complete)

**Scope:** Browser-based photo capture for residents, visitors, vehicles, and service providers with per-tenant per-category consent policy. The porteiro captures a photo in under 3 seconds. The condominium sets whether photo consent is required per category. Every entry is logged with millisecond-precision timestamps cross-referenceable with the condominium's external CCTV. No hardware framework — the camera is the browser's. No server-side image processing — all compression, EXIF stripping, and thumbnailing is client-side.

**Phases:**

- Phase 11: Photos & Consent Schema Infrastructure (`PHOTO-01`) — ✅ Shipped (commit `d895c01`): `IStorageProvider` (local + S3/MinIO + Amazon S3), `photos` table, `consent_audit_log` table (append-only triggers), `tenant_consent_policy` table, `photos.read/write/delete` permissions, upload/retrieve/soft-delete endpoints, 118 unit + 73 integration tests
- Phase 12: Photo Capture & Display (`PHOTO-02`) — ✅ Shipped (commit range `1e9d2cc`..`21f879e` on `feat/planning-reconcile-v2`): `ce-photo-capture` (camera + upload), `ce-photo`, `ce-photo-gallery`, `ce-photo-lightbox`, `PhotosApiService`, `photo-utils` (compressImage 0.8→0.6→0.3 ladder, generateThumbnail, uploadWithRetry 3× backoff), integration into residents/visits/vehicles/service-providers, 247 Angular unit tests + 5 Playwright E2E tests with exifr EXIF verification
- Phase 13: Consent Policy & Gatehouse Workflow (`CONSENT-01`, `CONSENT-02`, `CONSENT-03`) — ✅ Shipped (backend in commit `d895c01`; UI in commit range `0bbc788`..`b8d94a1` on `feat/planning-reconcile-v2`): `EntryLogService` + `ConsentPolicyService`, `ce-entry-workflow` (4-tile modal with auto-camera), `ce-override-reason` (Emergency/Vouched), `ce-entry-state-badge` (5 states), `ce-audit-filters` + `ce-audit-row` + `/audit` page (filterable + CSV export with ms timestamps), `/admin/consent-policy` page (4 toggles), 3 role guards, 8 unit tests + 12 Playwright E2E tests

**Verification:** Milestone audit `passed` (`.planning/v2.0-MILESTONE-AUDIT.md`); all 3 phases have `*-VERIFICATION.md` with `status: passed`; 5/5 requirements validated (PHOTO-01, PHOTO-02, CONSENT-01, CONSENT-02, CONSENT-03).

**Known tech debt (forward-compatible shims):**

- Photos entity binding via localStorage cache (backend lacks `entity_type`/`entity_id` columns)
- Thumbnails via CSS object-fit cover (backend lacks `/api/v1/photos/{id}/thumbnail` route)
- Consent policy list via 4× parallel category calls (backend lacks `/consent-policy` list endpoint)
- Pagination total via entries.length (backend lacks X-Total-Count header)

All shims are documented inline and in each phase VERIFICATION.md. Future backend work can remove them without component changes.

**Design principles:**

1. Logging is faster than skipping — 3-second workflow is the honesty enforcement
2. CCTV is the external backstop — ControlEasy carries timestamps, not footage
3. ControlEasy enables, doesn't enforce — policy is the condominium's
4. Client-side only for image processing — no server-side compression/thumbnailing/EXIF
5. No approval workflow, no anomaly detection — ship visibility

**Specs:** `.specs/photo-capture/`, `.specs/consent-gatehouse/`
**Roadmap:** `.planning/milestones/v2-ROADMAP.md`
**Origin:** Party-mode design session (2026-08-23)

---

## v2.2 Door Integration — Superseded (Defined: 2026-08-23; renumbered v2.1 → v2.2 on 2026-09-19; re-scoped simulator-first into milestone v2.3 on 2026-09-22)

> This original definition assumed real condominium hardware (Phases 14–15). Hardware access
> does not exist yet; the hardware-independent portion is now milestone **v2.3 (simulator-first)**
> above, with real vendor drivers deferred to DOOR-R1..R3. Kept for design-decision history.

**Phases:** 14, 15
**Status:** Defined (gated on real condominium with hardware)

**Scope:** Condominiums that opt in can integrate ControlEasy with their door relay and card/biometric readers. The API triggers the relay with HMAC-signed commands; reader events create entry log records automatically. The door opens independently of ControlEasy — the API is a participant, not a gatekeeper. `IDeviceHandler` abstraction emerges from the second real integration, not speculatively.

**Phases:**

- Phase 14: Door Relay & Unlock Commands (`DOOR-01`) — `IDoorController`, HMAC-SHA256 signed unlock, rate-limited, audit-logged, hardware fallback, threat model
- Phase 15: Reader Events & Device Health (`DOOR-02`, `DOOR-03`) — `IDeviceHandler` (from 2 real integrations), `DeviceEvent` normalization, enforced ledger, device health monitoring

**Design principles:**

1. ControlEasy is a participant, not a gatekeeper — door opens independently; API observes + triggers
2. No speculative abstractions — `IDeviceHandler` from 2nd integration, not before
3. Security-sensitive — remote unlock is a new attack surface; own threat model, own adversarial review
4. Cameras are external — ControlEasy does not deploy/manage/proxy cameras

**Specs:** `.specs/door-integration/`
**Roadmap:** `.planning/milestones/v2-ROADMAP.md`
**Origin:** Party-mode design session (2026-08-23)

---

## Fast-Cycle: Multi-Arch Docker/CI (No Milestone)

**Status:** Defined (~1 week, no ceremony)

**Scope:** Multi-arch Docker builds (linux/amd64 + linux/arm64), GitHub Actions native-runner matrix, GHCR multi-arch manifest with cosign signing, `DOCKER_PLATFORM` opt-in env var. Pulled out of v2 milestones — low-risk DevOps hygiene.

**Specs:** `.specs/1 - modernization-roadmap-arm64/`
**Requirements:** `ARCH-01`, `ARCH-02`

---
