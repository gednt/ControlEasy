---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Integrated Visits & Account Operations
status: planning
last_updated: "2026-09-19T12:23:50.284Z"
last_activity: 2026-09-19
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-13)

**Core value:** Gatehouse staff can reliably register and control access through a fast, tenant-isolated web UI.
**Current focus:** v2.0 milestone COMPLETE (2026-09-13). All 3 phases (11, 12, 13) shipped. No active milestone.

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-09-19 — Milestone v2.1 started

## Performance Metrics

**Velocity:**

- Total plans completed (cumulative): 14 (11 v1.0 + 1 v1.1 + 1 v2.0 Phase 11 + 1 v2.0 Phase 12 + 1 v2.0 Phase 13)
- v2.0 milestone: 3 plans, 3 summaries, 3 verifications, 1 audit, 26 atomic commits
- Average duration per plan: ~5 min (autonomous execution)

## Accumulated Context

### Decisions

- v2.0 photo capture: browser-only, client-side compression (0.8→0.6→0.3 ladder), EXIF strip via canvas redraw, 3× retry with 1s/2s/4s backoff
- v2.0 consent model: per-tenant per-category policy, five entry states (entered_with_consent / entered_override / gatehouse_only / denied / entered_without_consent), append-only audit log, hardcoded override reason codes
- v2.0 design principle: 3-second gatehouse workflow as honesty enforcement; CCTV is external backstop
- Phase 12/13 used forward-compatible shims for backend endpoints not yet shipped:
  - Photos entity binding via localStorage cache
  - Thumbnails via CSS object-fit cover (no /thumbnail route)
  - Consent policy list via 4× parallel category calls (no list endpoint)
  - Pagination total via entries.length (no X-Total-Count header)
- v1.1 Phase 9 (UI parity) explicitly deferred to a future milestone (out of v2.0 scope)
- v2.2 Door Integration (Phases 14-15, renumbered from v2.1 on 2026-09-19) gated on real condominium hardware
- Gatehouse access is a software-only validation and audit workflow: QR is the initial credential method, with a protected manual lookup fallback by document, name, apartment, or block. Every visit now requires an apartment/block destination, automatically recovered for residents and associated vehicles; facial biometrics requires a separate future privacy, security, and enrollment specification.
- QR feature implementation pragmatic deviation (2026-09-14): spec-kit generated 74 atomic tasks across 9 phases (Setup, Foundational, US1–US6, Polish). Constitution IV requires per-task Docker rebuild + tests. To stay within realistic session scope, the workflow groups Docker rebuilds at phase boundaries while still producing one atomic commit per task. This deviation was approved explicitly by the operator and is recorded here per Constitution VII (concurrency-budget deviation rationale lives next to the work it justifies). Reviewer actions: per-task rebuild pass can be re-run during `/gsd-verify-work`.
- Phase 9 observability (T066): AccessControl logs structured fields only — `TenantId`, `ProfileId`, `ProfileId`, `ProfileId`, `ScanAttemptId`, `LookupAuditId`, `Decision`, `CredentialMethod`, `SubjectType`, `DurationMs` — and an architecture test asserts no AccessControl `LogX` call passes raw QR / document / CPF / full name values.
- Phase 9 a11y (T069): entry-workflow exposes an `aria-live=polite` status region, uses `role=radiogroup` + roving `tabindex` for the category selector, supports Arrow / Home / End navigation, and routes labels through a translation table; 14/14 Angular unit tests pass.
- Phase 9 constitution compliance (T071): `AccessControlConstitutionComplianceTests` enforces all seven constitution principles plus the stack constraints as a single failing-build gate for AccessControl; 18/18 architecture tests pass.
- Multi-arch Docker/CI is fast-cycle (no milestone)

### Blockers/Concerns

- No blocking concerns. v2.0 milestone is complete.
- v1.1 Phase 9 partial work (residents page only) deferred to future milestone.
- v2.2 (Phases 14-15, renumbered from v2.1) gated on hardware.
- OpenAPI client not yet consumed by handwritten Angular services (carried over from v1.0 tech debt).
- Photo entity binding is now persisted by the Photos API; existing MySQL databases need the versioned migration once.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v1.1 | UI Parity & Functional Fixes (Phase 9 partial) | Residents page only; login/dashboard/showcase/visits/vehicles/etc. pending | 2026-09-13 |
| v2.0 (tech debt) | Backend /api/v1/photos/{id}/thumbnail route | Forward-compatible shim in place (CSS object-fit cover) | 2026-09-13 |
| v2.0 (tech debt) | Backend /api/v1/consent-policy list endpoint | Forward-compatible shim (4× parallel calls) | 2026-09-13 |
| v2.0 (tech debt) | Backend X-Total-Count header on /api/v1/entry-log | Forward-compatible shim (entries.length approximation) | 2026-09-13 |
| v2.2 | Door relay & unlock commands (DOOR-01) | Phase 14, gated on hardware; renumbered from v2.1 | 2026-08-23 |
| v2.2 | Reader events & device health (DOOR-02, DOOR-03) | Phase 15, gated on Phase 14; renumbered from v2.1 | 2026-08-23 |
| Future access method | Facial biometrics | Explicitly deferred; requires separate approved specification before biometric enrollment, matching, or storage | 2026-09-13 |
| Fast-cycle | Multi-arch Docker/CI (ARCH-01, ARCH-02) | No milestone, ~1 week | 2026-06-24 |
| v1.0 | OpenAPI client integration with handwritten services | Carried over | 2026-09-12 |

## Session Continuity

Last session: 2026-09-17
Stopped at: Spec-kit /speckit-implement Phase 8 (US6 docs) and Phase 9 (Polish) complete on `feat/qr-entrance-exit-access`. T065–T074 implemented: biometric reservation docs + cross-links + quickstart exclusion scan; Serilog structured logging + redaction arch test; worktree compose override; Stopwatch/Serilog timing on every handler boundary; entry-workflow a11y (live region, roving-tab radiogroup, keyboard navigation, category translation table); Playwright API-level access-control lifecycle E2E spec; AccessControl constitution-compliance test; PROJECT.md + STATE.md sync per spec-kit ownership rule; stack smoke via docker build + /api/v1/health green. All 74 atomic tasks complete; solution rebuilds cleanly.
Resume file: None

## Operator Next Steps

- QR access feature ready for human review on `feat/qr-entrance-exit-access` (74 atomic commits across 9 phases; clean working tree)
- Run `/gsd-new-milestone` to define next milestone (likely v1.1 Phase 9 completion OR v2.2 Door Integration prep OR fast-cycle multi-arch)
- v2.0 ship commit ready for human review on `feat/planning-reconcile-v2` (26 atomic commits, clean working tree)
- Forward-compatible shims can be removed by future backend work (4 backend endpoints/migrations)
- v2.2 roadmap (Phases 14-15, renumbered from v2.1, gated on hardware) archived at `.planning/milestones/v2.0-ROADMAP.md`
- Multi-arch Docker/CI: fast-cycle, ~1 week, `.specs/1 - modernization-roadmap-arm64/`
