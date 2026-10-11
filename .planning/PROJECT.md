# ControlEasy Reborn

## What This Is

ControlEasy Reborn is the web-based modernization of ControlEasy 5 — a condominium access-control platform used by gatehouse staff (porteiro), tenant administrators, and platform operators to manage residents, visitors, vehicles, service providers, apartments, and gatehouse flow. The new stack is an ASP.NET Core 8 modular monolith with an Angular 18 SPA, MySQL 8, and Docker Compose, replacing the legacy WPF desktop app via a Strangler Fig migration.

## Core Value

Gatehouse staff can reliably register and control access for residents, visitors, and vehicles through a fast, tenant-isolated web UI backed by a secure multi-tenant API.

## Current State

**v2.3 Door Integration & Hardware Access (Simulator-First) shipped 2026-10-11.** 4 phases (23–26), 4 plans, 15/15 DOOR-* requirements (DOOR-01..07 + DOOR-08..11 + DOOR-12..15) covered with full constitutional security bar applied. 26 atomic commits on `feat/milestone-v2.3` (4b9d5dd..a42087c, 179 files, +15,894/−58 LOC). All 4 phase VERIFICATION.md files carry `status: passed`. Milestone audit `passed` — 9/9 cross-phase integration checks verified (tenant opt-in flips unlock reachability, deactivated device rejects unlock, reader events flow through canonical handlers, idempotent replay on reconnect, heartbeat → status → gatehouse toast, 3 cross-tenant integration classes green, single-write-path doctrine enforced, append-only invariants on `device_unlock_audit`, zero EF Core / no MediatR / no MVC controllers) (`.planning/milestones/v2.3-MILESTONE-AUDIT.md`).

**v2.1 Integrated Visits & Account Operations shipped 2026-09-20.** 3 phases (16–18), 9 plans, 19/19 requirements checked off (2 partial: INFRA-02 day-bucketing, PASS-03 TenantAdmin reset UI). All phase verifications passed with the full local CI gate green. Milestone audit: `tech_debt` — no blockers (`.planning/milestones/v2.1-MILESTONE-AUDIT.md`).

**v1.0 Reborn MVP shipped 2026-07-13.** The founding milestone delivered 32/32 requirements across 11 phases. The standard Docker Compose runtime is healthy and demo mode remains isolated to its opt-in overlay.

**v1.1 (2026-09-12) and v2.0 (2026-09-13) shipped earlier:**
- v1.1 Phase 10 (dashboard + vehicle edit) shipped without GSD artifacts; Phase 9 (residents page) partial
- v2.0 Phases 11–13 (Photos & Consent: schema, browser capture, policy + entry workflow backend) shipped — 118 unit + 73 integration tests at Phase 11, 247 Angular unit + 17 E2E tests at Phases 12–13
- Gatehouse Access & Visit Destinations (`qr-entrance-exit-access`) shipped 2026-09-16 on `feat/qr-entrance-exit-access`

**v2.1 shipped (Phases 16–18, commit range `eeebe37..2134fcc`, +11,143/−1,018 lines):**
- Visitor write-path fold: single `VisitorArrivalHandler` for QR/manual/walk-in; `CheckInNow: true` walk-ins land directly `CheckedIn`; durable AccessEvent→VisitId links (migrations 14, 0011, 0012)
- Unified honest ledger: `GET /api/v1/reports/history` single UNION with native state stamps, `kind` discriminator, per-branch tenant predication, X-Total-Count pagination; entry-log re-scoped to privacy-consent role; package drops as AccessEvents with description + carrier codes
- Gatehouse operator panel: consolidated `/gatehouse` tabs (QR, manual lookup, walk-in, open visits) with deep-link parity; `/visits` demoted to admin register; QR camera facingMode per-device persistence
- Reports page: `/reports` (Today/7d/30d/custom, visit counts by day, residents per apartment, server-side filtering, millisecond-precision CSV export) — dead dashboard link fixed
- Password management: enumeration-safe forgot-password (decoy verify + partitioned rate limiter), platform/tenant admin resets with token revocation, BCrypt cost ≥ 11 pinned, MailKit SMTP + Mailpit dev catch-all, redaction arch tests

## Current Milestone

**v2.3 — Door Integration & Hardware Access (Simulator-First)** ✅ shipped 2026-10-11

<details>
<summary>v2.3 closeout summary (shipped)</summary>

**Goal:** Deliver the complete hardware-independent portion of door integration — `IDoorController`/`IDeviceHandler` abstractions, full security machinery (HMAC-SHA256 unlock, nonce+timestamp replay window, rate limiting, append-only tamper-evident audit, AES-256-GCM connection params), device-event normalization feeding the ledger, device health monitoring, and admin/porteiro UI — all integration-tested against a simulated/loopback device adapter. Real vendor drivers stay out until hardware exists (DOOR-R1..R3 concretized as v2.5).

**Delivered (4 phases / 4 plans / 26 atomic commits / +15,894/−58 LOC / 179 files):**
- Phase 23 — Device Foundation & Simulator Harness: `IDoorController`, simulated door controller, HMAC-SHA256 unlock security bar, append-only `DeviceUnlockAudit` (DB triggers), AES-256-GCM connection-params encryption, dev-only simulator inspector (DOOR-01..04, DOOR-07, DOOR-15)
- Phase 24 — Device Administration & Tenant Opt-In: tenant `door_integration_enabled` opt-in toggle + device register/edit/activate/remove admin UI + cross-tenant isolation (DOOR-05, DOOR-06)
- Phase 25 — Reader Events & Ledger Integration: `device_events` ingest + idempotent replay, single-write-path doctrine (zero ledger writes in Devices module), 4-tuple idempotency UNIQUE (DOOR-08..11)
- Phase 26 — Device Health Monitoring: `device_heartbeats` upsert with online/offline/degraded status, `/devices` dashboard, gatehouse-panel offline toast on transition edges (DOOR-12..14)

**Tests:** 269/269 unit + 20/20 architecture + 54/54 Devices integration + 24/24 device-health page Angular specs — all green on this worktree. Per-phase Web SPA gates green.

**Audit:** [v2.3-MILESTONE-AUDIT.md](milestones/v2.3-MILESTONE-AUDIT.md) — `status: passed`, 15/15 DOOR-* requirements, 9/9 cross-phase integration checks verified, 0 tech-debt blockers.

**Archive:** [v2.3-ROADMAP.md](milestones/v2.3-ROADMAP.md) · [v2.3-REQUIREMENTS.md](milestones/v2.3-REQUIREMENTS.md) · [v2.3-MILESTONE-AUDIT.md](milestones/v2.3-MILESTONE-AUDIT.md)

</details>

**Next milestone (next to start):** **v2.4 — Resident Self-Service & Visitor Experience** (planned 2026-09-23; Phases 27–30; requirements + roadmap defined). The resident becomes a first-class portal user — apartment-scoped credential provisioning (BCrypt ≥ 11, enumeration-safe), pre-registration CRUD with per-tenant purpose codes, visitor self check-in through the unified `VisitorArrivalHandler` write path, apartment-scoped visit history, in-app arrival notifications, printable badges via browser print. Scope sourced from the v2.1 deferred requirements pool — zero external dependencies. See [v2.4-REQUIREMENTS in planning state](REQUIREMENTS.md) and the [v2.4 Phase Details below](#phase-27-resident-access-foundation).

**Later milestone (defined, blocked):** **v2.5 — Real Vendor Hardware Integration (Control iD, Intelbras, Hikvision)** (defined 2026-09-23; Phases 31–34). Three first-party vendor drivers implementing the v2.3 `IDoorController`/`IDeviceHandler` abstractions, the edge agent (outbound-only WSS on-site runtime, forced into scope by the two we-dial-them vendors), vendor contract-test simulators with zero physical hardware in CI, security-bar parity, and the on-site pilot (DOOR-R3). See `.planning/milestones/v2.5-REQUIREMENTS.md`.

Fast-cycle (no milestone): multi-arch Docker/CI (`ARCH-01`, `ARCH-02`).

## Requirements

### Validated

- ✓ Modular monolith foundation (Tenants, Security, Residents, Docker, JWT, DBTools_SQL) — Phase 1 / `.specs/1 - modernization-roadmap/` tasks 1.0a–1.17
- ✓ Strangler pilot (Security module, login, Residents admin, feature flags) — Phase 2
- ✓ Module migrations (Visits, Vehicles, ServiceProviders, Administration, Reports CQRS-lite, Playwright) — Phase 3
- ✓ Legacy decommission tasks (cancelled — WPF not in repo) — Phase 4
- ✓ Post-login tenant-scoped routing and session endpoint — `.specs/post-login-role-routing/`
- ✓ Tenant administration UI (PlatformAdmin condominiums page) — `.specs/tenant-administration-ui/`
- ✓ PlatformAdmin first-boot login bugfix — `.specs/platform-admin-first-boot/`
- ✓ Apartments module + frontend wiring — `.specs/apartments-and-residents-form/`
- ✓ Apartment edit: manage residents inline — `.specs/apartment-edit-residents/`
- ✓ First-boot operator documentation — `.specs/getting-started/`
- ✓ Verification remediation (Playwright auth, demo integration, spec baseline) — `.specs/6 - verification-remediation/`
- ✓ DBTools_SQL migrated to NuGet DBTools 1.4.3 — `.specs/dbtools-nuget-migration/`
- ✓ Design system hardening and formal design-system contract — `.specs/fix-design-system/`, `.specs/2 - visual-design-system/`
- ✓ Occupied-apartments dashboard count regression fixed with tenant-isolation coverage — `.specs/occupied-apartments-bug/`
- ✓ Demo mode one-command seeded evaluation stack — `.specs/4 - demo-mode/`
- ✓ Continuous engineering baseline (CI, generated OpenAPI client, architecture and token contracts) — `.specs/1 - modernization-roadmap/` C.1–C.7
- ✓ Photo capture & hardware integration spec retired and superseded — `.specs/_retired/3 - photo-capture-hardware-integration/` → `.specs/photo-capture/` + `.specs/consent-gatehouse/` + `.specs/door-integration/`
- ✓ Dashboard live stats endpoint and UI (DASH-01, DASH-02) — Phase 10, shipped 2026-09-12
- ✓ Vehicle edit UI (DASH-04) — Phase 10, shipped 2026-09-12
- ✓ Photo storage infrastructure & API (PHOTO-01) — Phase 11, commit `d895c01`
- ✓ Consent policy config (CONSENT-01) — Phase 13 backend, commit `d895c01`
- ✓ Gatehouse entry workflow backend (CONSENT-02) — Phase 13 backend, commit `d895c01`
- ✓ Tenant staff lifecycle management (unplanned) — commit `55377a0`
- ✓ Gatehouse Access & Visit Destinations (qr-entrance-exit-access — `ACCESS-01..06`) — resident + vehicle QR scans, manual lookup, credential lifecycle, audit, visit destination enforcement, biometric reservation — `.specs/qr-entrance-exit-access/`, shipped 2026-09-16 on `feat/qr-entrance-exit-access`
- ✓ Visits unification: visitor QR/manual/walk-in → Visit rows; write-path fold + read model in same phase (VISIT-01..05) — Phase 16, v2.1 shipped 2026-09-20
- ✓ Unified ledger & package drops: `GET /api/v1/reports/history` UNION stream, package description + carrier codes (VISIT-04..07) — Phase 16, v2.1 shipped 2026-09-20
- ✓ Gatehouse operator panel & reports page (PANEL-01..05) — Phase 17, v2.1 shipped 2026-09-20
- ✓ Password management: forgot-password self-service, admin resets, delivery-state machinery (PASS-01..05, INFRA-01) — Phase 18, v2.1 shipped 2026-09-20
- ✓ Service provider management — edit, search/filter, and soft-disable flow — `.specs/service-provider-management/` (commit `f84aa8f`, full local CI gate passed 2026-09-21)
- ✓ Door integration (v2.3, simulator-first; renumbered from v2.2 on 2026-09-22) — `.specs/door-integration/` — `DOOR-01..15` — Phases 23–26, v2.3 shipped 2026-10-11 (audit `passed`)

### Active

- [~] Mockup visual parity (v1.1, Phase 9) — `UI-03` — residents page done; other pages pending — `.specs/mockup-visual-parity/`
- [~] Mockup functional fixes (v1.1, Phase 9) — `UI-04` — residents page interactions done; login form, toasts, other pages pending — `.specs/2-mockup-functional-fixes/`
- [~] Service provider management — VALIDATED (moved above; commit `f84aa8f`)
- [ ] Photo browser capture & display (v2.0, Phase 12) — `PHOTO-02` — `.specs/photo-capture/` — v2.2 target
- [~] Consent gatehouse workflow UI (v2.0, Phase 13) — `CONSENT-03` — backend done; audit review UI pending — `.specs/consent-gatehouse/` — v2.2 target
- [~] TenantAdmin password reset UI (v2.1 PASS-03 partial) — backend done; UI surface pending — v2.2 target
- [ ] Ledger polish (v2.1 carryover) — day-bucketing INFRA-02, inert status filter options, search scope, condominium-level package-drop trigger, X-Total-Count exposure — v2.2 target
- [ ] Resident self-service & visitor experience (v2.4) — CPF pre-registration matching, purpose codes, resident visit history, visitor self check-in, badge printing, arrival notifications (deferred pool from v2.1 REQUIREMENTS.md) — planning started 2026-09-23
- [ ] Real vendor hardware integration (v2.5) — Control iD, Intelbras, Hikvision drivers + edge agent + vendor simulators + on-site pilot (DOOR-R1..R3 concretized) — defined 2026-09-23, `.planning/milestones/v2.5-REQUIREMENTS.md`
- [ ] Multi-arch Docker/CI (fast-cycle) — `.specs/1 - modernization-roadmap-arm64/`

### Out of Scope

- Legacy WPF coexistence smoke tests — WPF not in repo; macOS dev environment cannot run WPF
- WPF project removal from repo — WPF lives outside `ControlEasyReborn.sln`
- Production cutover checklist — owned by separate DevOps spec
- Legacy data migration from `controlEasyDB.db` — separate data-migration spec
- Mobile-native apps — responsive web / PWA sufficient for v1
- Billing / subscription management — external system
- Resident/vehicle QR scans folded into the Visits table — they remain AccessEvents facts shown as ledger context rows (settled v2.1)
- Reset-token email links — temp-password machinery covers it; avoids a second credential subsystem (settled v2.1)
- Native WhatsApp Business API integration — Meta approval + per-tenant numbers; webhook/WhatsApp temp-password delivery deferred
- Resident-facing mobile app / push notifications — v2.4 delivers in-app portal notifications only; push/mobile-native stays future
- Visitor identity verification hardware / ID scanners — self check-in uses entered + pre-registered data matched against the pending authorization; no scanner hardware

## Next Milestone Goals

**v2.4 — Resident Self-Service & Visitor Experience** (Phases 27–30; ready to start next).

The resident becomes a first-class platform user — credential provisioned by TenantAdmin, logged in with their own password (BCrypt ≥ 11, enumeration-safe), isolated to their own apartment by integration tests (not by convention). Then residents pre-register expected visitors for their apartment (full name, document, optional plate, purpose code, validity window), edit/cancel pending ones, and read-only consumed/cancelled history. An arriving visitor self checks in through a pre-authorization against the SAME unified `VisitorArrivalHandler` write path the gatehouse uses — denied paths return uniform enumeration-safe ProblemDetails, are rate-limited, audit-logged. Residents watch their apartment's visit history and receive in-app arrival notifications. The porteiro sees pending pre-registrations at the gatehouse panel with document-matching and one-click check-in, plus a printable badge at every check-in (browser print, no printer hardware).

**Phase 27 — Resident Access Foundation:** TenantAdmin resident-credential provisioning (activate/suspend/revoke), resident role login (BCrypt ≥ 11 + enumeration-safe uniform responses), apartment-scoped isolation with cross-apartment integration tests (RES-01..03).
**Phase 28 — Visitor Pre-Registration & Purpose Codes:** Resident pre-registration CRUD with validity windows, edit/cancel lifecycle with read-only consumed history, per-tenant purpose codes stamped on visits (RES-04..06).
**Phase 29 — Visitor Self Check-In:** Self check-in via document match or pre-auth code through the unified `VisitorArrivalHandler` write path; denied-path security (uniform ProblemDetails, rate limiting, audit); printable badge via browser print (RES-07, RES-08, RES-12).
**Phase 30 — Resident Visibility, Notifications & Gatehouse Panel Integration:** Apartment-scoped visit history, in-app arrival notifications, gatehouse panel pending pre-registrations with CPF/document matching + one-click check-in + badge print trigger (RES-09..11).

**Scope principle:** BCrypt ≥ 11 for resident credentials; enumeration-safe uniform responses on auth failures; apartment-scoped isolation integration tests mandatory; all tenant-scoped reads/writes via `ITenantAwareLinqFactory`; `ProblemDetails` (RFC 7807) everywhere; no EF Core / no MediatR / minimal API endpoints only. Self check-in MUST reuse the unified `VisitorArrivalHandler` write path — no second door into the Visits data model. Portal-only notifications (no push/mobile-native), data matching (no ID-scanner hardware), browser print (no badge-printer hardware).

**Sequencing:** v2.4 depends on the post-cleanup entry-log contract already landed on `main` 2026-09-26 (PR #11 `7a5eb35` + PR #10 `0d8f96a`); no external prerequisites. Zero dependency on v2.5.

**After v2.4 ships**, v2.5 (Real Vendor Hardware Integration, Phases 31–34) becomes next — Control iD (DOOR-R1, Phase 32) → Intelbras (DOOR-R2 — proves the abstraction, Phase 33) → Hikvision behind VLAN isolation (DOOR-R3, Phase 34) + on-site pilot, all built against the v2.3 `IDoorController` / `IDeviceHandler` / `device_heartbeats` / `device_events` surfaces just shipped.

## Context

Brownfield modernization project. The repository contains ControlEasy Reborn only; legacy ControlEasy5 (WPF) and ControlEasyWeb (Blazor/.NET 5) are referenced in docs but not present in this repo.

Planning is derived from `.specs/` (20+ spec folders). Codebase intelligence lives in `.planning/codebase/`.

Current codebase: ~67,000 LOC (C#/TS/HTML/SCSS) across 12 feature modules (9 original + Photos + AccessControl + Devices). v2.3 added ~16,000 LOC (Devices module backend + Angular surfaces for administration, devices-health page, gatehouse-panel offline toast).

Known concerns from codebase map: dual tenant column patterns, JWT/localStorage defaults, generated OpenAPI client not consumed by handwritten Angular services (tech debt from v1.0 — Phase 17 consumed generated clients for new endpoints; v2.3 Devices module follows the handwritten-service pattern across Phases 24/25/26), test coverage gaps. v2.1 audit flagged: summary endpoint day-bucketing, TenantAdmin reset UI absent, inert ledger filter options, stale E2E specs. v2.3 audit surfaced: OpenAPI client regen TODO for v2.3's 10 new endpoints, subquery flake in `RunInitScripts` on parallel test fixtures, Windows-host Web production Docker build skip.

## Constraints

- **Tech stack**: ASP.NET Core 8, Angular 18+, MySQL 8, DBTools NuGet package (LINQ-first), Docker Compose — per `AGENTS.md`
- **Architecture**: Modular monolith, Clean Architecture per module, multi-tenant shared schema
- **Data access**: No Entity Framework or MySql.Data in Reborn code; all queries via `IAsyncSqlClient` / `Linq<T>`
- **API style**: REST, JSON, kebab-case routes, `/api/v1/*`, ProblemDetails errors
- **Visual contract**: `mockup/` prototype + `docs/penpot/tokens.json` + `.specs/2 - visual-design-system/`

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Strangler Fig migration | Keep legacy running during cutover | ✓ Good — Phases 1–3 complete; WPF coexistence cancelled (not in repo) |
| Modular monolith over microservices | Single deployable today, extract later | ✓ Good — 10 feature modules in place (9 original + Photos) |
| DBTools over EF Core | LINQ-first, multi-provider, matches AGENTS.md | ✓ Good — vendored DBTools_SQL replaced with NuGet 1.4.3 (Phase 7) |
| Multi-tenant shared schema + JWT `tenant_id` | Host many condominiums on one deployment | ✓ Good — TenantFilterInterceptor wired |
| Angular 18 + Tailwind v4 design system | Modern SPA, mockup parity target | ✓ Good — design system hardened (Phase 8); residents page rebuilt with `ce-*` components |
| Spec-driven development via `.specs/` | AGENTS.md mandates spec-first workflow | ✓ Good — source of truth for roadmap |
| v2.0 photo capture: browser-only, client-side compression | No hardware framework; cameras belong to condominium | ✓ Good — party-mode design session 2026-08-23 |
| v2.0 consent: per-tenant per-category policy, no rules engine | ControlEasy enables, doesn't enforce; CCTV is backstop | ✓ Good — party-mode design session 2026-08-23 |
| v2.2 door: participant, not gatekeeper | Door opens independently; API observes + triggers, doesn't block | ✓ Good — hardware fallback required |
| `IDeviceHandler` emerges from 2nd integration, not speculative | Avoid premature abstraction | ✓ Good — party-mode design session 2026-08-23 |
| Phase 11 + Phase 13 backend shipped together | Implementation collapsed the 11/13 boundary; schema + consent backend are co-dependent | ✓ Good — commit `d895c01` |
| S3 storage: dual provider (MinIO-compatible + Amazon S3) | Support both self-hosted MinIO and native AWS S3 | ✓ Good — `S3StorageProvider` + `AmazonS3StorageProvider` |
| Tenant staff lifecycle shipped as unplanned work | Admin/porteiro CRUD was needed for real-world condominium management | ✓ Good — commit `55377a0` |
| QR-first credential method, facial biometric explicitly reserved | QR is the operational path; biometric enrollment/storage/matching requires a separate approved specification covering privacy, storage, enrollment, matching, and liveness | ✓ Good — `.specs/qr-entrance-exit-access/`, `CredentialMethod.FacialBiometricReserved = 99`, arch tests fail the build on any biometric keyword |
| Always identify a visit destination | Resident/vehicle-bound scans auto-resolve the destination apartment; manual lookup requires an explicit selection; legacy `destination_pending` rows are historical only | ✓ Good — `AccessEventDestinationResolver` + `VisitValidator` enforce the rule |
| v2.1 visits: one data model, visitor-only QR→Visit | Visits is the single operational record; AccessEvents stays a security audit trail; ConsentAuditLog reverts to privacy-consent role | ✓ Good — settled in gsd-explore 2026-09-19, implemented Phase 16 |
| v2.1 write-path fold + read model land in the same phase | A double-counting window between phases is the trap (dashboard already double-adds ConsentAuditLog rows) | ✓ Good — both landed in Phase 16 |
| Unified ledger: single SQL UNION with explicit `tenant_id = @p0` per branch | Never let `TenantFilterInterceptor` splice into a UNION; two-query C# merge only for small bounded sets | ✓ Good — Phase 16 `ReportReadRepository` |
| Entry-log re-scoped, not deleted | No dual-write, no backfill mutation (append-only triggers); ledger cutoff constant for legacy read-only segment | ✓ Good — Phase 16 |
| Package drops as AccessEvents, never Visit rows | Packages have no subject/destination Visit semantics; condominium-level drops keep `DestinationApartmentId NOT NULL` | ✓ Good — Phase 16 D-04, `SubjectType=Visitor SubjectId=Guid.Empty` documented |
| v2.1 password reset: SMTP self-service for admins only | Gatekeeper self-reset deferred; temp passwords one-time + `MustChangePassword` re-armed + refresh-token revoke-all | ✓ Good — Phase 18; gatekeeper self-reset deferred (PASS-03 UI partial) |
| Enumeration-safe forgot password: uniform response + constant-cost decoy verify | Prevent user enumeration via timing/response diffing | ✓ Good — Phase 18 `ForgotPasswordHandler` |
| Durable `PasswordResetRequest` table doubles as rate-limit counter | Consolidated single-table design; per-process IMemoryCache idempotent resend is a documented single-instance tradeoff | ⚠️ Revisit — multi-replica deployments lose resend idempotency |
| v2.2 milestone is software-only closeout; Door Integration renumbered to v2.3 | No real condominium hardware available; planning against absent hardware builds on abstractions; completion work delivers user value now | ✓ Good — party-mode planning session 2026-09-22, Phases 14–15 stay reserved for v2.3 |
| v2.3 door integration is simulator-first | The `IDoorController`/`IDeviceHandler` abstractions, security machinery (HMAC-SHA256, nonce+timestamp replay window, rate limiting, tamper-evident audit, AES-256-GCM connection params), event normalization, ledger integration, health monitoring, and admin UI are all verifiable against a simulated/loopback device adapter; swapping in a real vendor driver later is a driver-implementation task, not a redesign. Real vendor drivers stay out of scope until hardware exists | ✓ Good — v2.3 planning session 2026-09-22; Phases 14–15 reservations retired, phases continue from 23; **shipped 2026-10-11** (4 phases, 15/15 DOOR-* requirements, audit `passed`) |
| v2.4 = Resident Self-Service & Visitor Experience | The resident is the forgotten user — the v2.1 deferred pool (CPF pre-reg, purpose codes, visit history, self check-in, badge printing) is a coherent resident-facing theme with zero external dependencies; WhatsApp delivery stays parked (Meta approval) | ✓ Good — party-mode session 6, 2026-09-23 |
| v2.4 self check-in rides the unified `VisitorArrivalHandler` write path | v2.1 unified visits precisely so there is ONE door into the Visits data model; a second self-service write path would fork the state machine | ✓ Good — party-mode session 6, 2026-09-23 (Murat's condition) |
| v2.4 resident auth is apartment-scoped, not tenant-scoped | Residents see only their apartment's visits/authorizations; a resident of 101 seeing 302's data is a cross-tenant failure in miniature — apartment-scoped isolation tests mandatory | ✓ Good — party-mode session 6, 2026-09-23 |
| v2.5 = Real Vendor Hardware Integration; vendors picked from research gold-signal list | Felipe picked Control iD, Intelbras, Hikvision (2026-09-23) — all cross-validated by SaaS portaria-platform integration lists; Henry/TopData/Shelly-relay deferred to the second wave; direct cloud→LAN exposure rejected (CGNAT); OSDP stays reader↔controller (cloud never terminates it); ONVIF A/C rejected (thin adoption) | ✓ Good — party-mode hardware-research session 2026-09-23 |
| v2.5 edge agent is outbound-only and all drivers ride it | Two of three vendors are we-dial-the-device surfaces behind CGNAT — the edge agent is a consequence of the vendor pick, not a speculative platform component; one channel, one credential story, one queue/replay semantic; Control iD relayed through the agent rather than special-cased | ✓ Good — party-mode hardware-research session 2026-09-23 |
| Zero physical hardware in CI, ever | Vendor simulators (Control iD REST/webhook mock, Intelbras connect-and-subscribe mock, Hikvision ISAPI/digest mock) exercise the integration suite; real devices appear only at the on-site pilot — Murat's condition, written as requirement HW-03 | ✓ Good — party-mode hardware-research session 2026-09-23 |
| v2.3 single-write-path doctrine: Devices never instantiates ledger entities | Every Visit / AccessEvent / RefusedScanAttempt write flows through `RecordAccessScanHandler` / `RecordRefusedScanHandler` / `VisitorArrivalHandler`; Devices module owns `device_events` (its own ledger marker) only | ✓ Good — Phases 25/26 audit grep: 0 `new Visit(/INSERT INTO Visits/new AccessEvent(/new RefusedScanAttempt(/...` in `src/Modules/Devices/` |
| v2.3 idempotency 4-tuple UNIQUE `(tenant_id, device_id, sequence_number, external_event_id)` | A 3-tuple would break the disconnect-during-firmware-crash replay use case (the vendor's event-id reset and the local sequence reset must both be honored); 4-tuple survives the redelivery no-op case | ✓ Good — `DeviceEventIdempotentReplayTests` proves replay_after_disconnection returns 5 on first pass and 0 on second |
| v2.3 device_heartbeats status derived at ingestion, no background sweep | Status is a function of (now - LastHeartbeatAtUtc, errorRate); deriving per-event keeps it deterministic and side-effect-free; v2.5 edge agent introduces the periodic poll on its own clock | ✓ Good — Phase 26 audit: per-event derivation, no timer job |
| v2.3 device_heartbeats `INSERT ... ON DUPLICATE KEY UPDATE` (mutable rollup) vs device_events / device_unlock_audit (append-only) | Status tables roll up; ledger tables don't. The same Devices module holds both, by design — different invariants serve different purposes | ✓ Good — Phase 26 audit: `IDeviceHeartbeatRepository` surface has only Get/Upsert/List (no Update/Delete) |
| v2.3 device_events append-only invariant enforced at the API surface (no DB triggers) | `IDeviceEventRepository` exposes only `Insert/Get*`; matches the AccessControl/Visits ledger convention. ConsentAuditLog is the only DB-trigger-protected ledger because it's legally tamper-evident | ✓ Good — Phase 25 audit: 0 Update/Delete methods on the repo, no DB triggers on the table |
| v2.3 Angular `DeviceHealthService` singleton shared across `/devices` + `/gatehouse-panel` | One HTTP poll cycle regardless of how many pages are mounted; transition detection in the service (BehaviorSubject diff), not in the page; offline toast fires once per `online → offline` edge | ✓ Good — Phase 26 unit specs: startPolling idempotent, transition dedup, 60s back-off after 3 errors |
| v2.3 handwritten `DevicesApiService` bypasses generated OpenAPI client | Phase 24/25/26 added 7+2+1 endpoints via handwritten service; keeps commit surface minimal. OpenAPI regeneration is a follow-up — low risk because the handwritten service constructs URL paths + HTTP verbs explicitly | ⚠️ Revisit — Phase 24/25/26 TODO; regenerate in v2.5 Phase 31 cleanup |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-11 — milestone v2.3 (Door Integration simulator-first) **shipped** on `feat/milestone-v2.3` (audit `passed`, 15/15 DOOR-* requirements, 4 phases, 26 atomic commits); v2.4 (Resident Self-Service & Visitor Experience) ready to start next; v2.5 (Real Vendor Hardware Integration) remains defined*
