---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Integrated Visits & Account Operations (started 2026-09-19)
current_phase: 16
current_phase_name: Visits Unification Backend
status: executing
stopped_at: v2.1 roadmap created — Phases 16–18 defined with full requirement coverage (VISIT-01..07, PANEL-01..05, PASS-01..05, INFRA-01..02); REQUIREMENTS.md traceability updated; Phase 16 ready for `/gsd-discuss-phase 16`.
last_updated: "2026-09-19T13:47:24.213Z"
last_activity: 2026-09-19
last_activity_desc: Phase 16 execution started
state_head: 9533dae97b8875a1dca76ad3b976e73663847999
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 3
  completed_plans: 1
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-19)

**Core value:** Gatehouse staff can reliably register and control access through a fast, tenant-isolated web UI.
**Current focus:** Phase 16 — Visits Unification Backend

## Current Position

Phase: 16 (Visits Unification Backend) — EXECUTING
Plan: 1 of 3
Status: Executing Phase 16
Last activity: 2026-09-19 — Phase 16 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed (cumulative): 14 (11 v1.0 + 1 v1.1 + 3 v2.0)
- v2.0 milestone: 3 plans, 3 summaries, 3 verifications, 1 audit, 26 atomic commits
- Average duration per plan: ~5 min (autonomous execution)

**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 16 P01 | 35 | 3 tasks | 16 files |

## Accumulated Context

### Decisions

- v2.1 visits unification: one data model (Visits), visitor-only QR→Visit, walk-ins land directly `CheckedIn`; AccessEvents stays security audit trail; ConsentAuditLog reverts to privacy-consent role (settled in gsd-explore 2026-09-19, `.planning/notes/integrated-visits-flow.md`)
- v2.1 write-path fold + read-model rewrite MUST land in the same phase (Phase 16) — a double-counting window between phases is the trap (dashboard already double-adds ConsentAuditLog rows today)
- Unified ledger read model: single SQL UNION in `ReportReadRepository` with explicit `tenant_id = @p0` per branch (never let `TenantFilterInterceptor` splice into a UNION); two-query C# merge only for small bounded sets
- Entry-log re-scoped, not deleted — no dual-write, no backfill mutation (append-only triggers); ledger cutoff constant for the legacy read-only segment
- v2.1 password reset: SMTP self-service for admins only (gatekeeper self-reset deferred); temp passwords one-time + `MustChangePassword` re-armed + refresh-token revoke-all; enumeration-safe uniform response + decoy verify; durable `PasswordResetRequest` table doubles as rate-limit counter (consolidated single-table design to settle in Phase 18 planning)
- v2.0 photo capture: browser-only, client-side compression (0.8→0.6→0.3 ladder), EXIF strip via canvas redraw, 3× retry with 1s/2s/4s backoff
- v2.0 consent model: per-tenant per-category policy, five entry states, append-only audit log, hardcoded override reason codes
- v2.2 Door Integration (Phases 14–15, renumbered from v2.1 on 2026-09-19) gated on real condominium hardware
- Gatehouse access is software-only validation/audit: QR initial credential + manual lookup fallback; every visit requires a destination; biometrics require separate approved spec
- Multi-arch Docker/CI is fast-cycle (no milestone)

### Blockers/Concerns

- OpenAPI client not yet consumed by handwritten Angular services (carried over from v1.0 tech debt) — Phase 17 consumes generated clients for the new endpoints
- Photo entity binding: existing MySQL databases need the versioned migration once
- Research-flagged decisions to resolve during phase discussion: visitor identity for unmatched QR scans (Phase 16), ledger cutoff build-constant vs config (Phase 16), tenant-local day-boundary timezone setting (Phase 17), single consolidated `PasswordResetRequest` table design (Phase 18), tenant-admin permission string for reset endpoint (Phase 18)
- No `UseForwardedHeaders()` in codebase — behind Traefik, IP-partitioned rate limits collapse to one bucket; partition on normalized email (Phase 18)

## Deferred Items

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| v1.1 | UI Parity & Functional Fixes (Phase 9 partial) | Residents page only; login/dashboard/showcase/visits/vehicles/etc. pending | 2026-09-13 | v1.1 |
| v2.0 (tech debt) | Backend /api/v1/photos/{id}/thumbnail route | Forward-compatible shim (CSS object-fit cover) | 2026-09-13 | v2.0 |
| v2.0 (tech debt) | Backend /api/v1/consent-policy list endpoint | Forward-compatible shim (4× parallel calls) | 2026-09-13 | v2.0 |
| v2.0 (tech debt) | Backend X-Total-Count header on /api/v1/entry-log | Forward-compatible shim (entries.length approximation) | 2026-09-13 | v2.0 |
| v2.1 | Webhook/WhatsApp temp-password delivery, photo on packages, CPF pre-reg matching, purpose codes, resident visit history, visitor self-check-in, badge printing | Deferred requirements (REQUIREMENTS.md) | 2026-09-19 | v2.1+ |
| v2.2 | Door relay & unlock commands (DOOR-01) | Phase 14, gated on hardware | 2026-08-23 | v2.2 |
| v2.2 | Reader events & device health (DOOR-02, DOOR-03) | Phase 15, gated on Phase 14 | 2026-08-23 | v2.2 |
| Future access method | Facial biometrics | Requires separate approved specification | 2026-09-13 | future |
| Fast-cycle | Multi-arch Docker/CI (ARCH-01, ARCH-02) | No milestone, ~1 week | 2026-06-24 | none |

## Session Continuity

Last session: 2026-09-19
Stopped at: v2.1 roadmap created — Phases 16–18 defined with full requirement coverage (VISIT-01..07, PANEL-01..05, PASS-01..05, INFRA-01..02); REQUIREMENTS.md traceability updated; Phase 16 ready for `/gsd-discuss-phase 16`.
Resume file: None
