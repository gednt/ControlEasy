# Project Retrospective

## Milestone: v1.0 — Reborn MVP

**Shipped:** 2026-07-13  
**Phases:** 11 | **Plans:** 11

### What Was Built

- Tenant-isolated ASP.NET Core modular monolith with the core condominium access-control modules.
- Angular SPA with authenticated tenant workflows and a hardened reusable design system.
- Canonical Docker Compose runtime plus deterministic opt-in demo mode.
- DBTools 1.4.3 NuGet persistence, runtime health checks, CI, OpenAPI generation, and architecture contracts.

### What Worked

- Cross-referencing implementation, specs, tests, and live containers exposed stale planning state without duplicating shipped work.
- Tenant-isolation regression tests and architecture guards converted critical invariants into executable checks.
- Rebuilding API and web images after changes caught runtime issues that unit-only verification would have missed.

### What Was Inefficient

- Much of the shipped implementation predated GSD evidence, requiring retrospective plan, summary, verification, and validation artifacts.
- Spec task checkboxes and roadmap counts drifted from the repository, obscuring the true remaining scope.
- Generated OpenAPI output lacks rich response typing and is not yet adopted by handwritten Angular services.

### Patterns Established

- Active milestone scope is counted separately from explicitly deferred v1.1/v2 requirements.
- Every tenant-sensitive data path receives both integration coverage and an architecture-level guard where practical.
- Release verification includes .NET, Angular, accessibility/visual checks, Docker rebuild, live health, and demo isolation.

### Key Lessons

- Keep GSD evidence and spec checkboxes synchronized when implementation lands, not at milestone close.
- Treat generated contracts as useful only when endpoint metadata and application consumption are both verified.
- Milestone audits should distinguish missing evidence from missing implementation before creating closure work.

## Post-v1.0 Work (2026-09-12 audit)

**Shipped without GSD artifacts:** v1.1 Phase 10 (dashboard + vehicle edit), v1.1 Phase 9 partial (residents page rebuild), v2.0 Phase 11 (Photos & Consent Schema), v2.0 Phase 13 backend (consent policy + entry log + CSV export). Unplanned: tenant staff lifecycle management, bootstrap race fix, Traefik TLS, worktree script fixes.

### What Was Built

- Photos module (Domain/Application/Infrastructure/Api) with `IStorageProvider` (local + S3/MinIO + Amazon S3), `photos`/`consent_audit_log`/`tenant_consent_policy` tables, append-only DB triggers, CHECK constraint on consent entries.
- Consent backend: entry-log CRUD, CSV export, consent policy get/update, four entry states, override reasons, policy enforcement.
- Dashboard: `GET /api/v1/dashboard/stats` endpoint + live stat tiles UI + recent visits table.
- Vehicle edit: `update()` in VehiclesApiService + edit modal in vehicles page.
- Residents page rebuilt with `ce-*` design-system components (stat tiles, tabs, dropdowns, table, badge, pagination, modals, card, inputs, client-side filter/sort/pagination).
- Tenant staff lifecycle: admin/porteiro CRUD, suspend/resume/revoke, last-admin guard, duplicate email rejection, 13 new unit tests.
- 118 unit tests + 73 integration tests for Photos/Consent module.

### What Worked

- Shipping Phase 11 + Phase 13 backend in one commit was efficient — the schema and consent backend are co-dependent; splitting them would have created an artificial boundary.
- The `ce-*` design-system component adoption on the residents page proved the pattern works for remaining pages.
- Cross-tenant integration tests on the Photos module caught isolation issues early.

### What Was Inefficient

- v1.1 Phase 9/10 and v2.0 Phase 11/13 shipped without GSD artifacts (PLAN/SUMMARY/VERIFICATION) — same pattern as v1.0 Phases 1–6 + 11. This required a full audit to reconstruct what shipped.
- Planning docs (STATE, MILESTONES, ROADMAP, REQUIREMENTS, PROJECT) drifted significantly from codebase reality. STATE.md said "v1.1 in planning" while v2.0 Phase 11 was already shipped.
- Unplanned work (tenant staff lifecycle) shipped without being tracked in requirements — it should have been captured as a new requirement when started.

### Key Lessons

- Planning docs must be updated when implementation ships, not deferred to a later audit. The 2026-09-12 audit found docs 2 milestones behind reality.
- When implementation collapses roadmap phase boundaries (Phase 11 + 13 backend shipped together), update the roadmap to reflect the actual delivery shape rather than forcing the plan to match the original phase split.
- Unplanned work should be captured in REQUIREMENTS.md as it starts, even if it's a bugfix or hardening task — future audits need the trail.

## Milestone: v2.1 — Integrated Visits & Account Operations

**Shipped:** 2026-09-20
**Phases:** 3 (16–18) | **Plans:** 9

### What Was Built

- Unified visitor write path: single `VisitorArrivalHandler` for QR scan, manual lookup, and walk-in (`CheckInNow: true`); durable AccessEvent→VisitId links (migrations 14, 0011, 0012); entry-log re-scoped to privacy-consent role.
- Package drops as first-class AccessEvents with description + carrier codes, filterable in the ledger.
- One honest unified ledger: `GET /api/v1/reports/history` single UNION with native state stamps, `kind` discriminator, per-branch tenant predication, X-Total-Count pagination.
- Consolidated `/gatehouse` operator panel (QR, manual lookup, walk-in, open visits tabs) with deep-link parity; `/visits` demoted to admin register; QR camera facingMode per-device persistence.
- `/reports` page: date ranges, visit counts by day, residents per apartment, server-side filtering, millisecond-precision CSV export; dead dashboard link fixed.
- Password management: enumeration-safe forgot-password (decoy verify + partitioned rate limiter), platform/tenant admin resets with token revocation, BCrypt ≥ 11 pinned, MailKit SMTP + Mailpit, redaction arch tests.

### What Worked

- Settling the visits unification design in gsd-explore before planning (`.planning/notes/integrated-visits-flow.md`) removed ambiguity — phases 16–18 executed autonomously without design churn.
- Landing the write-path fold and read-model rewrite in the same phase (16) avoided the double-counting window trap.
- Parallel-safe phase design (18 independent of 16/17) let password work proceed without waiting on ledger work.
- Full local CI gate per plan (unit + integration + architecture + Angular) caught regressions immediately.

### What Was Inefficient

- The audit found 4 dead-code integration orphans (stale E2E specs, dead dashboard wiring, inert filter options) — removal of superseded frontend paths was not scoped into Phase 17 plans.
- Nyquist validation was never run for any phase despite `nyquist_validation: true` in config — coverage TODO surfaced only at audit time.
- Two requirements (INFRA-02 day-bucketing, PASS-03 TenantAdmin reset UI) passed phase verification yet surfaced partial at milestone audit — phase verification didn't check cross-endpoint consistency.

### Patterns Established

- Explicit per-branch tenant predication inside SQL UNIONs; never splice `TenantFilterInterceptor` into a UNION.
- Entry-log is privacy-consent audit only; all operational visitor records live in Visits.
- Temp-password machinery: one-time + `MustChangePassword` re-arm + refresh-token revoke-all + durable delivery state in the same transaction.

### Key Lessons

- When re-scoping an endpoint's role (entry-log), sweep the frontend for remnants in the same phase — dead wiring and stale types survive otherwise.
- Filter option lists should be derived from backend enums/vocabulary, not hand-typed — hand-typed options silently return empty result sets.
- Run `/gsd-validate-phase` when `nyquist_validation` is enabled, or turn the flag off — silent non-compliance is discovered only at audit.
- Cross-endpoint consistency checks (summary vs ledger day-bucketing) belong in phase verification, not just milestone audit.

## Cross-Milestone Trends

| Milestone | Requirements | Verification | Main debt |
|---|---:|---|---|
| v1.0 | 32/32 active | 79 unit, 55 integration, 6 architecture, 203 Angular | Generated-client adoption |
| v1.1 (partial) | 3/5 done (DASH-01/02/04), 2/5 partial (UI-03/04) | Shipped without GSD artifacts | Phase 9 remaining pages; Phase 9/10 backfill |
| v2.0 | 3/5 done + 1 partial (CONSENT-03 UI pending) | 118 unit, 73 integration (Photos module) | Phase 12 (browser capture UI); Phase 13 UI; forward-compatible shims |
| v2.1 | 19/19 checked (17 satisfied, 2 partial: INFRA-02, PASS-03) | All phases passed; runtime CI gate green | Dead frontend remnants, stale E2E specs, Nyquist coverage missing |
