# Phase 22: Mockup Parity & Test Closeout — Context

**Gathered:** 2026-09-24
**Status:** Ready for planning
**Source:** Party-mode planning session + v2.2 requirements + mockup specs

<domain>
## Phase Boundary

High-traffic screens visually and functionally match the mockup contract, and the automated test suite reflects the product as actually shipped. Two capabilities:
1. **Mockup parity + functional fixes** (UI-01/02) — extend residents-page parity to login, dashboard, visits, vehicles; login form behavior, toast patterns, page interactions.
2. **Test hygiene & validation** (TEST-01/02) — refresh/remove stale E2E; ensure Nyquist `*-VALIDATION.md` coverage exists for every v2.2 phase.

Phase 22 depends on Phases 19, 20, 21 (E2E refresh + Nyquist validation must cover the final surfaces).
</domain>

<decisions>
## Implementation Decisions

### UI-01 — Mockup visual parity (light + dark themes)
- Extend parity beyond the residents page to: login, dashboard, visits, vehicles. Per `.specs/mockup-visual-parity/` (UI-03 continuation).

### UI-02 — Functional fixes
- Login form behavior, toast patterns, page interactions per `.specs/2-mockup-functional-fixes/` (UI-04 continuation): real error paths, submit spinner, auto-dismissing toasts.

### TEST-01 — Stale E2E refresh
- `e2e/gatehouse-workflow.spec.ts` no longer tests removed dashboard buttons/tiles. E2E reflects the current gatehouse panel + ledger. Stale specs refreshed or removed.

### TEST-02 — Nyquist validation coverage
- Every v2.2 phase (19–22) has a `*-VALIDATION.md`. (v2.1 left 3 phases without any; v2.2 must close that gap.)

### the agent's Discretion
- Exact visual-parity acceptance thresholds (per the mockup spec).
- Whether stale E2E specs are refreshed or removed (per spec, no testing of removed UI).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.specs/mockup-visual-parity/` (design.md, requirements.md, tasks.md) — UI-03 visual parity contract.
- `.specs/2-mockup-functional-fixes/` (design.md, requirements.md, tasks.md) — UI-04 functional-fixes contract.
- `src/Web/ControlEasyReborn.Web/e2e/gatehouse-workflow.spec.ts` — stale E2E (tests removed dashboard buttons/tiles).
- `src/Web/ControlEasyReborn.Web/src/app/features/reports/reports.page.ts`, `gatehouse/gatehouse-panel.page.ts` — current high-traffic screens.
- v2.0 phases 08 (design-system-hardening) + 10 (dashboard) — design system tokens and `ce-*` components.

### Established Patterns
- Angular standalone components, OnPush, signals, `ce-` prefix; Tailwind CSS 4; Shift Ledger design system tokens.
- Playwright E2E + visual regression (`tests/visual/`) + a11y (`tests/a11y/`).
- GSD Nyquist `*-VALIDATION.md` per phase (see `templates/VALIDATION.md`).

</code_context>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/milestones/v2.2-REQUIREMENTS.md` — UI-01/02, TEST-01/02
- `.planning/ROADMAP.md` — Phase 22 goal + success criteria (depends on 19/20/21)

### Specs
- `.specs/mockup-visual-parity/requirements.md` + `design.md` — UI-01
- `.specs/2-mockup-functional-fixes/requirements.md` + `design.md` — UI-02

### Prior phase evidence
- `.planning/milestones/v2.1-phases/17-gatehouse-panel-reports-page/17-VERIFICATION.md` — E2E/panel current-state baseline

### Source of truth
- `.planning/codebase/STACK.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/TESTING.md`, `.planning/codebase/CONVENTIONS.md`
- `AGENTS.md`

</canonical_refs>

<deferred>
## Deferred Ideas

- Parity for screens beyond login/dashboard/visits/vehicles (future continuation).
- Door integration, biometrics — other milestones.

</deferred>

---

*Phase: 22-mockup-parity-test-closeout*
*Context gathered: 2026-09-24 via party-mode planning + v2.2 requirements*
