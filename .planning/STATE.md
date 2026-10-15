---
gsd_state_version: "1.0"
milestone: v2.4
milestone_name: Resident Self-Service & Visitor Experience
status: planning
last_updated: "2026-10-15T22:14:03.537Z"
last_activity: 2026-10-15
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-11)

**Core value:** Gatehouse staff can reliably register and control access through a fast, tenant-isolated web UI.
**Current focus:** v2.3 Door Integration & Hardware Access (Simulator-First) ✅ **archived 2026-10-11**. Requirements + roadmap defined 2026-09-22 on `feat/planning-lineage-unification` (15 DOOR-* requirements, Phases 23–26 with success criteria in `.planning/ROADMAP.md`); all 4 phases shipped with SUMMARY + VERIFICATION + audit `passed`; archive + tag `v2.3` in place. Next milestone: v2.4 (Resident Self-Service & Visitor Experience, Phases 27–30) via `/gsd-new-milestone`. v2.5 (Phases 31–34, real hardware) remains defined.

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-10-15 — Milestone v2.4 started

## Performance Metrics

**Velocity:**

- Total plans completed (cumulative): 52 (11 v1.0 + 1 v1.1 + 3 v2.0 + 9 v2.1 + 4 v2.3 phases 23–26 + 8 from v2.0 photo-capture/consent shipped via `.specs/photo-capture/` + `.specs/consent-gatehouse/` + 15 v2.2 Phases 19/20/21/22; v2.4 = 0)
- v2.1 milestone: 9 plans, 9 summaries, 3 verifications, full local CI verification passing
- v2.2 milestone: 15 plans across Phases 19/20/21/22 (4 + 4 + 3 + 4); all four phases have `*-VALIDATION.md` + `*-VERIFICATION.md`; full local CI verification passing on the final state
- v2.3 milestone: 4 plans, 4 summaries, 4 verifications, audit `passed`, archived 2026-10-11 (15 DOOR-* requirements across Phases 23–26)
- Average duration per plan: ~5-15 min (autonomous execution); v2.3 Phases 23/24/25/26 ran ~90-120 min each (new module + UI + Playwright specs)

**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 16 P01 | 35 min | 3 tasks | 16 files |
| Phase 16 P02 | 25 min | 2 tasks | 8 files |
| Phase 16 P03 | 30 min | 2 tasks | 26+ files |
| Phase 17 P01 | 20 min | 3 tasks | 7 files |
| Phase 17 P02 | 15 min | 2 tasks | 3 files |
| Phase 17 P03 | 25 min | 4 tasks | 7 files |
| Phase 18 P01 | 25 min | 4 tasks | 16 files |
| Phase 18 P02 | 25 min | 5 tasks | 12 files |
| Phase 18 P03 | 30 min | 5 tasks | 22 files |
| Phase 21 P01 | 20 min | 2 tasks | 5 files |
| Phase 21 P02 | 12 min | 2 tasks | 5 files |
| Phase 21 P03 | 35 min | 3 tasks | 8 files |
| Phase 22 P01 (UI-01) | ~25 min | 3 tasks | 14 files |
| Phase 22 P02 (UI-02) | ~10 min | 1 task | 2 files |
| Phase 22 P03 (TEST-01) | ~15 min | 2 tasks | 3 files |
| Phase 22 P04 (TEST-02) | ~5 min | 2 tasks | 2 files |
| Phase 23 P01 | ~90 min | 8 tasks | 30+ files |
| Phase 24 P01 | ~120 min | 10 tasks | 39 files |
| Phase 25 P01 | ~90 min | 7 tasks | 32 files |
| Phase 26 P01 | ~90 min | 9 tasks | 42 files |

**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 16 P01 | 35 min | 3 tasks | 16 files |
| Phase 16 P02 | 25 min | 2 tasks | 8 files |
| Phase 16 P03 | 30 min | 2 tasks | 26+ files |
| Phase 17 P01 | 20 min | 3 tasks | 7 files |
| Phase 17 P02 | 15 min | 2 tasks | 3 files |
| Phase 17 P03 | 25 min | 4 tasks | 7 files |
| Phase 18 P01 | 25 min | 4 tasks | 16 files |
| Phase 18 P02 | 25 min | 5 tasks | 12 files |
| Phase 18 P03 | 30 min | 5 tasks | 22 files |
| Phase 21 P01 | 20 min | 2 tasks | 5 files |
| Phase 21 P02 | 12 min | 2 tasks | 5 files |
| Phase 21 P03 | 35 min | 3 tasks | 8 files |
| Phase 22 P01 (UI-01) | ~25 min | 3 tasks | 14 files |
| Phase 22 P02 (UI-02) | ~10 min | 1 task | 2 files |
| Phase 22 P03 (TEST-01) | ~15 min | 2 tasks | 3 files |
| Phase 22 P04 (TEST-02) | ~5 min | 2 tasks | 2 files |

## Accumulated Context

### Decisions

- Service providers are soft-disabled through a tenant-scoped, idempotent action; the `/service-providers` screen now supports full detail editing, search/filtering, and confirmed disable without erasing the record (2026-09-20, `.specs/service-provider-management/`)
- v2.1 visits unification: one data model (Visits), visitor-only QR→Visit, walk-ins land directly `CheckedIn`; AccessEvents stays security audit trail; ConsentAuditLog reverts to privacy-consent role (settled in gsd-explore 2026-09-19, `.planning/notes/integrated-visits-flow.md`)
- v2.1 write-path fold + read-model rewrite MUST land in the same phase (Phase 16) — a double-counting window between phases is the trap (dashboard already double-adds ConsentAuditLog rows today)
- Unified ledger read model: single SQL UNION in `ReportReadRepository` with explicit `tenant_id = @p0` per branch (never let `TenantFilterInterceptor` splice into a UNION); two-query C# merge only for small bounded sets
- Entry-log re-scoped, not deleted — no dual-write, no backfill mutation (append-only triggers); ledger cutoff constant for the legacy read-only segment
- v2.1 password reset: SMTP self-service for admins only (gatekeeper self-reset deferred); temp passwords one-time + `MustChangePassword` re-armed + refresh-token revoke-all; enumeration-safe uniform response + decoy verify; durable `PasswordResetRequest` table doubles as rate-limit counter (consolidated single-table design to settle in Phase 18 planning)
- v2.0 photo capture: browser-only, client-side compression (0.8→0.6→0.3 ladder), EXIF strip via canvas redraw, 3× retry with 1s/2s/4s backoff
- v2.0 consent model: per-tenant per-category policy, five entry states, append-only audit log, hardcoded override reason codes
- v2.2 PCAP-02 lazy list thumbnails: `ce-photo` gains an opt-in `lazy` input that defers the authenticated `GET /api/v1/photos/{id}` blob fetch via IntersectionObserver (200px rootMargin) — the inner `<img loading="lazy">` only defers decode, not the authenticated HTTP request. Default off so gallery/panel/lightbox stay regression-safe. New `ce-photo-thumb` primitive resolves entity → most-recent photo id via `photosApi.list(0, 1, { entityType, entityId })` then delegates the blob fetch to `ce-photo`.
- v2.2 PCAP-01/PCAP-03 stay green via the existing capture/compression/EXIF/retry suites — Phase 21 is a gap-closeout, not a re-implementation. Dead v2.0 shims (PhotoBindingCacheService localStorage + generateThumbnail) removed; ce-photo-panel refactored to a single authoritative `photosApi.list()` source (closes T-21-07 stale localStorage metadata).
- (superseded 2026-09-22) v2.2 Door Integration (Phases 14–15, renumbered from v2.1 on 2026-09-19) gated on real condominium hardware — see next entries
- v2.2 milestone is software-only closeout (party-mode planning session 2026-09-22); Door Integration renumbered to v2.3, Phases 14–15 stay reserved
- v2.3 door integration is simulator-first (2026-09-22): `IDoorController`/`IDeviceHandler` abstractions, HMAC-SHA256 unlock security, event normalization, ledger integration, health monitoring, and admin UI are all built and verified against a simulated/loopback device adapter; real vendor drivers stay out of scope until hardware exists; Phases 14–15 reservations retired, v2.3 phases start at 23
- v2.5 real hardware milestone defined (2026-09-23): Control iD (DOOR-R1, Phase 32) → Intelbras (DOOR-R2, Phase 33) → Hikvision (Phase 34) + edge agent (outbound-only WSS, all drivers ride it — forced by the two we-dial-them vendors) + vendor simulators (zero hardware in CI) + on-site pilot (DOOR-R3, Phase 34); second wave (Henry, Shelly relay tier, TopData) parked in the v2.5 deferred pool
- v2.3 Phase 23 (Device Foundation & Simulator Harness): ships HMAC-SHA256 unlock security bar (per-tenant HKDF key, nonce cache, replay window, rate limiter), AES-256-GCM connection-params encryption per tenant, append-only `DeviceUnlockAudit` table with DB BEFORE UPDATE/DELETE triggers, in-process door simulator with dev-only inspector endpoint, and the full `/api/v1/devices/{id}/unlock` endpoint. 29 new tests (15 integration + 14 unit). Phase 24 consumes the IDeviceConnectionCryptoService and the Device entity's IsActive flag (no entity mutation required).
- v2.3 Phase 24 (Device Administration & Tenant Opt-In): `Tenants.DoorIntegrationEnabled` toggle endpoint with audit columns (mirrors v2.1 MustChangePassword audit pattern); `POST/PATCH/PUT/DELETE /api/v1/devices` admin endpoints + GET redaction; cross-tenant gatehouse-id check returns 404 (not 403, so other tenants' gatehouse existence cannot be probed); soft-delete via `Devices.RemovedAtUtc` (24h quiet-period guard returns 409 if a `DeviceUnlockAudit` row exists in the last 24h); Angular `/administration` page extended with Door Integration section (ce-switch opt-in toggle + ce-table device list + disabled card); standalone `DeviceFormModalComponent` for register/edit flows (live JSON validity, vendor dropdown, gatehouse dropdown); handwritten `DevicesApiService` (bypasses generated OpenAPI client — kept commit surface minimal). 39 new tests (15 integration + 12 Angular component + 9 Playwright + 3 a11y/visual). Atomic commits: `feat(sql)`, `feat(devices)`, `feat(web)`, `docs(phase-24)`.
- v2.3 Phase 25 (Reader Events & Ledger Integration): `device_events` append-only ledger table with idempotency UNIQUE `(tenant_id, device_id, sequence_number, external_event_id)` (DOOR-09 + DOOR-11); `POST /api/v1/devices/{deviceId}/events` ingest endpoint + `GET` admin list endpoint; `IDeviceHandler.Normalize()` vendor-agnostic abstraction with the in-process simulator shortcut for the test harness; single-write-path doctrine enforced by code grep — every Visit / AccessEvent / RefusedScanAttempt write flows through the existing `VisitorArrivalHandler` + `RecordAccessScanHandler` + new public `RecordRefusedScanHandler` (DOOR-10); idempotency-race race translated from MySqlException errno 1062 → `DuplicateIdempotencyKeyException`; SHA-256 verifier-byte lookup via new `IAccessCredentialRepository.FindByHashAsync(tenantId, sha256Hash)`; simulator inspector extended with `enqueue-offline` + `queue-peek` for the DOOR-11 disconnection-replay test; extended `RefusalCodes` with `UnknownCard` / `CredentialExpired` / `TamperDetected` / `CredentialMissingDestination`. 11 new integration tests across ingestion / idempotency / cross-tenant. Atomic commits: `feat(sql)`, `feat(accesscontrol)`, `feat(devices)` x2 (simulator handler/queue vs reader events), `feat(web)`, `test(devices)`, `chore(sql)` (backfill marker), `docs(phase-25)` x2 (SUMMARY + VERIFICATION).
- v2.3 Phase 26 (Device Health Monitoring): `device_heartbeats` one-row-per-device table with `online/offline/degraded` status (DOOR-12), per-device thresholds `offline_after_seconds=60` + `error_rate_threshold_percent=10.00`; `IngestHeartbeatHandler` derives status from `gap = now - lastHeartbeatAtUtc` (Offline) + `errorRate = errorCount/max(eventsSinceLastSuccess,1) * 100` (Degraded) — per-event at ingestion time, no background sweep; `IDeviceHeartbeatRepository` surface is `GetAsync + UpsertAsync + ListAsync` only (no Update/Delete — matches DOOR-12 design rule); raw ADO `INSERT ... ON DUPLICATE KEY UPDATE` upsert (the Linq abstraction doesn't have a first-class upsert). Phase 25's `IngestDeviceEventHandler` now routes `EventType=Heartbeat` to the new handler BEFORE the idempotency-key check — heartbeats don't write a row to `device_events` (their own `device_heartbeats` row IS the durability marker). New `GET /api/v1/devices/health` (TenantAdmin + Porteiro via existing `devices.read` permission). Angular `DeviceHealthService` singleton (`@Injectable({providedIn:'root'})`) shared between `/devices` and `/gatehouse-panel` pages — 30s polling + 60s back-off after 3 consecutive errors; transition detection via `BehaviorSubject` snapshot diff; `offlineAlerts$` emits on `online -> offline` edges. New `/devices` standalone page with `ce-card` + `ce-table` + `ce-badge` (success/warning/danger) + 30s auto-refresh + Retry button. `GatehousePanelPage` extended with inline ce-toast (warning tone, dismissible, `aria-live="polite"`) above the page header; toast appears ONCE per offline transition; dismiss is local (service retains history). 13 new integration tests (6 ingestion + 4 health endpoint + 3 cross-tenant) + 14 new Angular unit specs (8 service + 6 page) + 3 new gatehouse-panel toast specs + 3 new Playwright visual + a11y specs. Atomic commits: `feat(devices)` (backend), `feat(devices)` (endpoint), `feat(web)` (dashboard page), `feat(web)` (gatehouse toast), `test(devices)` (integration), `test(web)` (Playwright).
- Gatehouse access is software-only validation/audit: QR initial credential + manual lookup fallback; every visit requires a destination; biometrics require separate approved spec
- Phase 26 polling cadence: 30s default for both /devices dashboard and /gatehouse-panel alert subscription — configurable via the service startPolling() arg. Singleton service (providedIn:'root') so both pages share one HTTP request cycle. Pauses for 60s after 3 consecutive HTTP errors (back-off), then resumes.
- Phase 26 toast transition detection: implemented in the service (not the page), so the gatehouse-panel subscribe-and-react pattern works the same as the dashboard subscribe-and-react. Edge events (`online -> offline`, `offline -> online`, `online -> degraded`) flow through one `Subject<DeviceStatusTransition>` with `.kind` discriminator.
- v2.2 Phase 22 closes UI-03/UI-04 parity for the four target pages (login/dashboard/visits/vehicles); remaining parity work for `apartments`, `service-providers`, `administration`, `platform/condominiums` is deferred (mockup-visual-parity UC6 list — future continuation, not silently expanded in Phase 22).
- v2.0/v2.1 `*-VALIDATION.md` backfill (phases 11/12/13 + 16/17/18) is **out of scope** for TEST-02 (strictly 19–22); surfaced in `22-VERIFICATION.md` and `22-VALIDATION.md` cross-phase audit as a separate human decision, default deferred.
- Multi-arch Docker/CI is fast-cycle (no milestone)
- v2.3 milestone archived 2026-10-11: audit `passed` (15/15 DOOR-* requirements, 9/9 cross-phase integration checks verified, 0 constitutional regressions). Archive: `.planning/milestones/v2.3-ROADMAP.md` (full phase details + decisions + tech debt) + `v2.3-REQUIREMENTS.md` + `v2.3-MILESTONE-AUDIT.md`. Tag: `v2.3` (local, on `feat/milestone-v2.3` at `a42087c`, not pushed per AGENTS.WORKTREES.md). PROJECT.md + ROADMAP.md + STATE.md advanced. Next: v2.4 (Resident Self-Service & Visitor Experience, Phases 27–30) via `/gsd-new-milestone`. v2.5 (Phases 31–34, real hardware) remains defined and depends on v2.3's shipped abstractions.

### Blockers/Concerns

- OpenAPI client not yet consumed by handwritten Angular services (carried over from v1.0 tech debt) — Phase 17 consumes generated clients for the new endpoints
- Photo entity binding: existing MySQL databases need the versioned migration once
- Research-flagged decisions to resolve during phase discussion: visitor identity for unmatched QR scans (Phase 16), ledger cutoff build-constant vs config (Phase 16), tenant-local day-boundary timezone setting (Phase 17), single consolidated `PasswordResetRequest` table design (Phase 18), tenant-admin permission string for reset endpoint (Phase 18)
- No `UseForwardedHeaders()` in codebase — behind Traefik, IP-partitioned rate limits collapse to one bucket; partition on normalized email (Phase 18)

## Deferred Items

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| v1.1 | UI Parity & Functional Fixes (Phase 9 partial) | Closed in Phase 22: residents parity already done; login/dashboard/visits/vehicles parity adopted ce-* components; login forgot-password toast + 401/busy unit tests cover UI-02; design-system conformance for dashboard surfaced (no `mockup/dashboard.html` exists; Shift ledger vs stat-grid divergence deferred to human). | 2026-09-13 | v2.2 (resolved 2026-09-26) |
| v2.0 (tech debt) | Backend /api/v1/photos/{id}/thumbnail route | Closed in Phase 21: ce-photo uses object-fit cover on the authenticated source blob; no server-side thumbnailing needed. | 2026-09-13 | v2.2 (resolved 2026-09-26) |
| v2.0 (tech debt) | Backend /api/v1/consent-policy list endpoint | Forward-compatible shim (4× parallel calls) | 2026-09-13 | v2.2 candidate |
| v2.0 (tech debt) | Backend X-Total-Count header on /api/v1/entry-log | Forward-compatible shim (entries.length approximation) | 2026-09-13 | v2.2 target |
| v2.1 | Webhook/WhatsApp temp-password delivery, photo on packages | Deferred requirements (REQUIREMENTS.md) | 2026-09-19 | v2.1+ |
| v2.1 | CPF pre-reg matching, purpose codes, resident visit history, visitor self-check-in, badge printing | Deferred requirements (REQUIREMENTS.md) — concretely scoped as v2.4 (2026-09-23) | 2026-09-19 | v2.4 |
| v2.3 | Door relay & unlock commands (DOOR-01) | Closed in v2.3 Phase 23 — simulator-first (2026-10-10) | 2026-08-23 | v2.3 (resolved 2026-10-11) |
| v2.3 | Reader events & device health (DOOR-02, DOOR-03) | Closed in v2.3 Phases 25 + 26 — simulator-first (2026-10-11) | 2026-08-23 | v2.3 (resolved 2026-10-11) |
| v2.3 | Real vendor device drivers (relay + reader) | Concretized as milestone v2.5 (Control iD, Intelbras, Hikvision; Phases 31–34) — party-mode hardware-research session 2026-09-23; depends on v2.3's shipped `IDoorController`/`IDeviceHandler` abstractions | 2026-09-22 | v2.5 |
| Future access method | Facial biometrics | Requires separate approved specification | 2026-09-13 | future |
| Fast-cycle | Multi-arch Docker/CI (ARCH-01, ARCH-02) | No milestone, ~1 week | 2026-06-24 | none |
| todos | integrated-visits-flow.md | (presence-only) | 2026-09-20 | v2.1 |

## Session Continuity

Last session: 2026-10-11
Stopped at: v2.3 milestone **archived** on `feat/milestone-v2.3` at `a42087c`. Audit `passed` (15/15 DOOR-* requirements, 9/9 cross-phase integration checks). Archive: `.planning/milestones/v2.3-ROADMAP.md` + `v2.3-REQUIREMENTS.md` + `v2.3-MILESTONE-AUDIT.md`. Tag: `v2.3` (local, not pushed per AGENTS.WORKTREES.md). Branch: `feat/milestone-v2.3`. Commit range: `4b9d5dd..a42087c` (26 atomic commits, 179 files, +15,894/−58 LOC). Next: `/gsd-new-milestone` to start v2.4 (Resident Self-Service & Visitor Experience, Phases 27–30).
Resume file: None

## Operator Next Steps

- v2.3 archived; tag `v2.3` created on `feat/milestone-v2.3` (local — not pushed per AGENTS.WORKTREES.md).
- Merge `feat/milestone-v2.3` → `main` (manual, per AGENTS.WORKTREES.md) before starting v2.4 to keep the `devcontainer` history clean.
- Kick off v2.4 (Resident Self-Service & Visitor Experience, Phases 27–30) via `/gsd-new-milestone`. v2.5 (Phases 31–34, real hardware) follows v2.4.
