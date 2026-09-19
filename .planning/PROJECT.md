# ControlEasy Reborn

## What This Is

ControlEasy Reborn is the web-based modernization of ControlEasy 5 — a condominium access-control platform used by gatehouse staff (porteiro), tenant administrators, and platform operators to manage residents, visitors, vehicles, service providers, apartments, and gatehouse flow. The new stack is an ASP.NET Core 8 modular monolith with an Angular 18 SPA, MySQL 8, and Docker Compose, replacing the legacy WPF desktop app via a Strangler Fig migration.

## Core Value

Gatehouse staff can reliably register and control access for residents, visitors, and vehicles through a fast, tenant-isolated web UI backed by a secure multi-tenant API.

## Current State

**v1.0 Reborn MVP shipped 2026-07-13.** The active milestone delivered 32/32 requirements across 11 phases. The standard Docker Compose runtime is healthy and demo mode remains isolated to its opt-in overlay.

**Post-v1.0 work shipped 2026-09-12:**
- v1.1 Phase 10 (dashboard + vehicle edit) shipped without GSD artifacts
- v1.1 Phase 9 (residents page rebuild) partially shipped without GSD artifacts
- v2.0 Phase 11 (Photos & Consent Schema) shipped — full Photos module, storage abstraction, consent audit log, append-only triggers, 118 unit + 73 integration tests
- v2.0 Phase 13 backend (consent policy + entry log + CSV export) shipped in same commit
- Unplanned: tenant staff lifecycle management, bootstrap race fix, Traefik TLS, worktree script fixes

**Gatehouse Access & Visit Destinations (qr-entrance-exit-access) shipped 2026-09-16 on `feat/qr-entrance-exit-access`:**
- New AccessControl module (Domain / Application / Infrastructure / Api) under `src/Modules/AccessControl/`
- Resident + vehicle QR scans, manual lookup by CPF / document / name / apartment / block, credential issue / replace / revoke, access event & refused-scan audit, immutable destination snapshot
- Visit destination required at create/update; auto-resolved for residents and associated vehicles; legacy destination-pending rows treated as historical
- Biometric path reserved (`CredentialMethod.FacialBiometricReserved = 99`) but never produced, persisted, or transmitted; arch tests fail the build on any biometric keyword
- Architecture-wide AccessControl constitution compliance test (18/18 arch tests pass)
- Serilog structured logging for AccessControl flows (`TenantId`, `ProfileId`, `ScanAttemptId`, `Decision`, `DurationMs`) with a redaction arch test
- Angular entry-workflow a11y + i18n audit (live region, roving-tab radiogroup, keyboard navigation, category translation table)

## Current Milestone

**v2.1 Integrated Visits & Account Operations** (started 2026-09-19)

**v2.2 Door Integration** (defined 2026-08-23, renumbered from v2.1 on 2026-09-19) — gated on real condominium hardware

Goal: Make the gatehouse visit record single-sourced and complete — one data model, one operator panel, one honest ledger — then round out account operations: a reports & history page (fixing the dead `/reports` dashboard link) and password recovery for administrators and gatekeepers.

Target features:
- **Integrated visits flow** (priority): one data model (Visits), visitor-only QR→Visit creation/check-in, entry-log walk-ins folded into Visits, one consolidated gatehouse operator panel, unified-stream Shift ledger (Visits + AccessEvents as one chronological activity view) — see `.planning/notes/integrated-visits-flow.md` and `.planning/todos/pending/integrated-visits-flow.md`
- **Reports & history page**: build `/reports` (visit counts by day, residents per apartment, unified history), fix the dead dashboard handover link (dashboard.page.ts:178 → `**` wildcard → login), add nav placement, consume the idle generated OpenAPI report clients
- **Password management**: self-service "Forgot my password" on login (admins only, temporary password via SMTP), platform-admin reset for any user, tenant-admin reset for own gatekeepers; one-time temp passwords, `MustChangePassword` re-armed, enumeration-safe, rate-limited, BCrypt cost pinned ≥ 11
- Door Relay & Unlock Commands (v2.2 Phase 14 — `DOOR-01`): optional, gated on real hardware, HMAC-signed unlock, hardware fallback
- Reader Events & Device Health (v2.2 Phase 15 — `DOOR-02`, `DOOR-03`): card reader event ingestion, enforced ledger, device health monitoring
- **QR Access & Visit Destinations (qr-entrance-exit-access — `ACCESS-01..06`): resident + vehicle QR scans, manual lookup fallback, credential lifecycle, access event + refused-scan audit, required destination for every event, biometric reservation — **shipped 2026-09-16 on `feat/qr-entrance-exit-access`**

Phase numbering continues from v1.1 (Phase 10). Old v1.0 placeholder phases (12, 14) are superseded by v2.0/v2.2 design. Multi-arch Docker/CI is a fast-cycle task, not a milestone.

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

### Active

- [~] Mockup visual parity (v1.1, Phase 9) — `UI-03` — residents page done; other pages pending — `.specs/mockup-visual-parity/`
- [~] Mockup functional fixes (v1.1, Phase 9) — `UI-04` — residents page interactions done; login form, toasts, other pages pending — `.specs/2-mockup-functional-fixes/`
- [ ] Photo browser capture & display (v2.0, Phase 12) — `PHOTO-02` — `.specs/photo-capture/`
- [~] Consent gatehouse workflow UI (v2.0, Phase 13) — `CONSENT-03` — backend done; audit review UI pending — `.specs/consent-gatehouse/`
- [ ] Door integration (v2.2, gated on hardware; renumbered from v2.1 on 2026-09-19) — `.specs/door-integration/`
- [ ] Multi-arch Docker/CI (fast-cycle) — `.specs/1 - modernization-roadmap-arm64/`

### Out of Scope

- Legacy WPF coexistence smoke tests — WPF not in repo; macOS dev environment cannot run WPF
- WPF project removal from repo — WPF lives outside `ControlEasyReborn.sln`
- Production cutover checklist — owned by separate DevOps spec
- Legacy data migration from `controlEasyDB.db` — separate data-migration spec
- Mobile-native apps — responsive web / PWA sufficient for v1
- Billing / subscription management — external system

## Context

Brownfield modernization project. The repository contains ControlEasy Reborn only; legacy ControlEasy5 (WPF) and ControlEasyWeb (Blazor/.NET 5) are referenced in docs but not present in this repo.

Planning is derived from `.specs/` (20+ spec folders). Codebase intelligence lives in `.planning/codebase/`.

Known concerns from codebase map: dual tenant column patterns, JWT/localStorage defaults, generated OpenAPI client not consumed by handwritten Angular services (tech debt from v1.0), test coverage gaps.

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
| v2.1 visits: one data model, visitor-only QR→Visit | Visits is the single operational record; AccessEvents stays a security audit trail; ConsentAuditLog reverts to privacy-consent role | ○ Settled in gsd-explore 2026-09-19 (`.planning/notes/integrated-visits-flow.md`) |
| v2.1 password reset: SMTP self-service for admins only | Gatekeeper self-reset deferred; delivery via SMTP first (webhook/WhatsApp later); temp passwords one-time + MustChangePassword re-armed | ○ Settled in milestone scoping 2026-09-19 |

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
*Last updated: 2026-09-19 — Milestone v2.1 Integrated Visits & Account Operations started; Door Integration renumbered v2.1 → v2.2 (hardware-gated, never started)*