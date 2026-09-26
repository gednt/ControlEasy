---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Ledger & Reports Polish (current focused milestone; pointer remains
  here while v2.2 Phases 19–22 execute on `version/2.2`).
current_phase: 20
current_phase_name: Account Operations & Consent Audit UI
status: executing
last_updated: "2026-09-26T13:50:00.000Z"
last_activity: 2026-09-26
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
  percent: 25
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-09-23)

**Core value:** Gatehouse staff can reliably register and control access through a fast, tenant-isolated web UI.
**Current focus:** v2.4 Resident Self-Service & Visitor Experience — roadmap created (Phases 27–30); ready for `/gsd-plan-phase 27`. Next milestone v2.5 (Real Vendor Hardware Integration — Control iD, Intelbras, Hikvision; Phases 31–34) defined 2026-09-23, executes after v2.3 ships.

## Current Position

Phase: 19 — Ledger & Reports Polish (complete; Phase 20 next)
Plan: —
Status: Phase 19 executed 2026-09-26 on `version/2.2` — 4 plans complete (LEDGER-01..05), full local CI gate PASSED (format, Release build, UnitTests 252/252, ArchitectureTests 20/20, Testcontainers MySQL IntegrationTests 126/126, Angular production Docker build, OpenAPI client drift). 8 atomic commits on `version/2.2`. STATE.md pointer advanced from v2.4 to v2.2 so subsequent phases (20–22) read correctly; v2.4 planning artifacts untouched.

Last activity: 2026-09-26 — Phase 19 executed end-to-end via GSD execute-phase. Required one stack-forced deviation: plan 19-04 prescribed endpoint-level `WithExposedHeaders` which does NOT exist in .NET 8 SDK; applied the policy-level form on the existing `AngularDev` CORS policy instead — same end result (`Access-Control-Expose-Headers: X-Total-Count` on `/history` to allowed origins), no widening of the response-header exposure surface. See `.planning/phases/19-ledger-reports-polish/19-VERIFICATION.md` for per-requirement verification.

## Performance Metrics

**Velocity:**

- Total plans completed (cumulative): 17 (11 v1.0 + 1 v1.1 + 3 v2.0 + 9 v2.1)
- v2.1 milestone: 9 plans, 9 summaries, 3 verifications, full local CI verification passing
- Average duration per plan: ~5-15 min (autonomous execution)

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
- (superseded 2026-09-22) v2.2 Door Integration (Phases 14–15, renumbered from v2.1 on 2026-09-19) gated on real condominium hardware — see next entries
- v2.2 milestone is software-only closeout (party-mode planning session 2026-09-22); Door Integration renumbered to v2.3, Phases 14–15 stay reserved
- v2.3 door integration is simulator-first (2026-09-22): `IDoorController`/`IDeviceHandler` abstractions, HMAC-SHA256 unlock security, event normalization, ledger integration, health monitoring, and admin UI are all built and verified against a simulated/loopback device adapter; real vendor drivers stay out of scope until hardware exists; Phases 14–15 reservations retired, v2.3 phases start at 23
- v2.5 real hardware milestone defined (2026-09-23): Control iD (DOOR-R1, Phase 32) → Intelbras (DOOR-R2, Phase 33) → Hikvision (Phase 34) + edge agent (outbound-only WSS, all drivers ride it — forced by the two we-dial-them vendors) + vendor simulators (zero hardware in CI) + on-site pilot (DOOR-R3, Phase 34); second wave (Henry, Shelly relay tier, TopData) parked in the v2.5 deferred pool
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
| v1.1 | UI Parity & Functional Fixes (Phase 9 partial) | Residents page only; login/dashboard/showcase/visits/vehicles/etc. pending | 2026-09-13 | v2.2 target (UI-03/UI-04) |
| v2.0 (tech debt) | Backend /api/v1/photos/{id}/thumbnail route | Forward-compatible shim (CSS object-fit cover) | 2026-09-13 | v2.2 candidate |
| v2.0 (tech debt) | Backend /api/v1/consent-policy list endpoint | Forward-compatible shim (4× parallel calls) | 2026-09-13 | v2.2 candidate |
| v2.0 (tech debt) | Backend X-Total-Count header on /api/v1/entry-log | Forward-compatible shim (entries.length approximation) | 2026-09-13 | v2.2 target |
| v2.1 | Webhook/WhatsApp temp-password delivery, photo on packages | Deferred requirements (REQUIREMENTS.md) | 2026-09-19 | v2.1+ |
| v2.1 | CPF pre-reg matching, purpose codes, resident visit history, visitor self-check-in, badge printing | Deferred requirements (REQUIREMENTS.md) — concretely scoped as v2.4 (2026-09-23) | 2026-09-19 | v2.4 |
| v2.3 | Door relay & unlock commands (DOOR-01) | Re-scoped simulator-first into v2.3 Phase 23+ (2026-09-22) | 2026-08-23 | v2.3 |
| v2.3 | Reader events & device health (DOOR-02, DOOR-03) | Re-scoped simulator-first into v2.3 Phase 23+ (2026-09-22) | 2026-08-23 | v2.3 |
| v2.3 | Real vendor device drivers (relay + reader) | Concretized as milestone v2.5 (Control iD, Intelbras, Hikvision; Phases 31–34) — party-mode hardware-research session 2026-09-23 | 2026-09-22 | v2.5 |
| Future access method | Facial biometrics | Requires separate approved specification | 2026-09-13 | future |
| Fast-cycle | Multi-arch Docker/CI (ARCH-01, ARCH-02) | No milestone, ~1 week | 2026-06-24 | none |
| todos | integrated-visits-flow.md | (presence-only) | 2026-09-20 | v2.1 |

## Session Continuity

Last session: 2026-09-23
Stopped at: Milestone v2.5 (Real Vendor Hardware Integration — Control iD, Intelbras, Hikvision) requirements + roadmap created on `feat/planning-lineage-unification`; MILESTONES.md, REQUIREMENTS.md (v2.4 file frontmatter), v2.3-REQUIREMENTS.md DOOR-R1..R3 pointers, ROADMAP.md, PROJECT.md, STATE.md updated. Planning artifacts only — no code changes.
Resume file: None

## Operator Next Steps

- Review v2.4 roadmap, then run `/gsd-plan-phase 27`
- v2.5 sits behind v2.3's simulator foundation: review `milestones/v2.5-REQUIREMENTS.md`, request Hikvision partner-portal doc access early (Phase 31 entry gate for Phase 34), and line up the pilot condominium (HW-09)
