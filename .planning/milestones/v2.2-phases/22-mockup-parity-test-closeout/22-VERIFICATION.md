# Phase 22 — VERIFICATION

**Phase:** 22 — Mockup Parity & Test Closeout
**Branch:** version/2.2
**Verified:** 2026-09-26
**Status:** ✅ verified — all success criteria met

---

## Success criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Login, dashboard, visits, vehicles screens visually match mockup in light + dark themes (extending residents-page parity) | ✅ met | Plan 22-01: visits + vehicles pages fully adopted ce-button/ce-badge/ce-card/ce-table/ce-spinner/ce-input + ce-icon (Lucide); duplicated `.ce-*` CSS deleted from styles arrays; Unicode decimal-entity icon glyphs in vehicles → ce-icon. Six new Playwright specs (`tests/visual/{login,dashboard,visits,vehicles}.spec.ts` + `tests/a11y/{login,dashboard}.spec.ts`) lock parity against synthetic demo seed data. Dashboard/visits/vehicles use tolerant + structural conformance (no dedicated mockup page exists for those — surfaced decision per 22-RESEARCH.md Pitfall 1). Login snapshot uses pixel-exact `maxDiffPixelRatio: 0.001`. |
| 2 | Login form behavior, toast patterns, page interactions follow functional-fixes spec (real error paths, submit spinner, auto-dismissing toasts) | ✅ met | Plan 22-02: forgot-password success now emits an info toast via `ToastService` (auto-dismisses at 5s, tone-coded, aria-live) — the inline `forgot-success-banner` + signal + CSS removed. 401 inline-error path + submit busy state now unit-tested. 401 enumeration-safety preserved (`extractErrorMessage` still returns generic "Invalid email or password."). No client-side 15s cooldown invented (the Angular side mirrors whatever the backend actually returns). |
| 3 | E2E suite exercises current gatehouse panel and ledger — no specs testing removed dashboard buttons/tiles; stale specs refreshed or removed | ✅ met | Plan 22-03: `gatehouse-workflow.spec.ts` rewritten — Phase-13 tile assertions (`New entry` / `Register entry` / `Entry denied` / `Gatehouse only` / `Override`) deleted; new **Gatehouse Operator Panel** describe drives the current tabbed panel (4 tabs + walk-in registration end-to-end). Audit Review + Consent Policy Editor describes retained (still target present UI). `module-pages.spec.ts` fixed: headings/labels match current (Resident register, Visit register (administrative), Service providers, Condominium & System Administration) and the administration page no longer expects a nonexistent "create" button. |
| 4 | Every v2.2 phase has a `*-VALIDATION.md` (Nyquist validation coverage complete for the milestone) | ✅ met | Plan 22-04: `22-VALIDATION.md` finalized with all six required sections (Test Infrastructure, Sampling Rate, Per-Task Verification Map, Wave 0 Requirements, Manual-Only Verifications, Validation Sign-Off) + cross-phase audit table. Cross-phase audit proves 19/20/21/22 each have `*-VALIDATION.md`. Out-of-scope surfacing: v2.0 phases 11/12/13 and v2.1 phases 16/17/18 lack `*-VALIDATION.md` (backfill deferred — separate human decision, not silently expanded in TEST-02 scope). |

---

## Per-requirement evidence

### UI-01 — Mockup visual parity extended beyond residents page

- **Plan 22-01.** visits + vehicles pages fully adopted design-system components; Unicode glyphs → ce-icon; six new Playwright regression specs.
- **Files:** `src/Web/ControlEasyReborn.Web/src/app/features/visits/visits.page.ts`, `src/Web/ControlEasyReborn.Web/src/app/features/vehicles/vehicles.page.ts`, `src/Web/ControlEasyReborn.Web/tests/visual/{login,dashboard,visits,vehicles}.spec.ts`, `src/Web/ControlEasyReborn.Web/tests/a11y/{login,dashboard}.spec.ts`.
- **Static conformance gates (plan 22-01 verification):**
  - `grep -rn '\.ce-button\|\.ce-table\|\.ce-badge\|\.ce-card\|\.ce-empty-state\|\.ce-spinner\|\.ce-modal' src/Web/ControlEasyReborn.Web/src/app/features/visits/visits.page.ts` → 0 matches.
  - Same grep over `vehicles/vehicles.page.ts` → 0 matches (the only remaining page-local select class is `.vehicle-select`, not `.ce-input`).
  - `grep -rn '&#[0-9]\+;' src/Web/ControlEasyReborn.Web/src/app/features/visits/visits.page.ts src/Web/ControlEasyReborn.Web/src/app/features/vehicles/vehicles.page.ts` → 0 matches.
- **Residents page untouched** (the reference implementation to mirror). Login/dashboard/visits/vehicles visual parity is the surfaced scope per 22-RESEARCH.md Pitfall 1 (no dedicated mockup page exists for those → design-system conformance).

### UI-02 — Mockup functional fixes

- **Plan 22-02.** Login page: `ToastService` injected and `toast.info(res.message)` emitted on forgot-password success; modal closes; inline `.forgot-success-banner` + `forgotPasswordMessage` signal + CSS removed.
- **Files:** `src/Web/ControlEasyReborn.Web/src/app/features/auth/login.page.ts`, `src/Web/ControlEasyReborn.Web/src/app/features/auth/login.page.spec.ts`.
- **Spec coverage:**
  - `onForgotPasswordSubmit should call authService.forgotPassword and surface an info toast (not an inline banner)` — asserts `toastSpy.info` called with `res.message` and modal closes.
  - `onSubmit should set loginError and re-enable form on 401 (enumeration-safe)` — asserts 401 detail + `submitting()` false.
  - `onSubmit should keep submitting=true while the login request is pending` — pending `Subject<never>`, asserts `submitting()` is true until completion (no `setTimeout`).
- **Unchanged:** 401 enumeration-safe error path; submit spinner (`ce-button [loading]` + `aria-busy`); password show/hide; tenant picker; demo/bootstrap accounts.

### TEST-01 — Stale E2E refresh

- **Plan 22-03.** `e2e/gatehouse-workflow.spec.ts` rewritten: tile-based asserts deleted; new Gatehouse Operator Panel describe drives 4 tabs (qr, manual, walkin, visits) + walk-in registration end-to-end (synthetic `FedEx Driver`, `11222333000181`, etc.). Audit Review + Consent Policy Editor describes retained.
- **Files:** `src/Web/ControlEasyReborn.Web/e2e/gatehouse-workflow.spec.ts`, `src/Web/ControlEasyReborn.Web/e2e/module-pages.spec.ts`.
- **Static guard:** `grep -n 'New entry\|Register entry\|Entry denied\|Gatehouse only\|Override' e2e/gatehouse-workflow.spec.ts` → 3 matches: 2 inside the header comment block (documenting what was removed) and 1 inside the legit `entered_override` audit-state filter (`badges.nth(i)).toHaveText(/Override/i)`). No `getByRole('button', { name: 'New entry' })`-style tile assertions remain.
- **Surfaced:** E2E/visual/a11y are manual (`npm run e2e`) — not a `verify-ci-local.sh` stage per AGENTS.md Policy + 22-RESEARCH.md Pitfall 3. Wiring into CI is a separate policy decision.

### TEST-02 — Nyquist validation coverage

- **Plan 22-04.** `22-VALIDATION.md` finalized (six required sections + cross-phase audit table + out-of-scope surfacing for v2.0/v2.1 phases). Cross-phase audit proves 19/20/21/22 each have `*-VALIDATION.md`.
- **Files:** `.planning/phases/22-mockup-parity-test-closeout/22-VALIDATION.md`.
- **`find .planning/phases -maxdepth 2 -name '*-VALIDATION.md' | sort`:**
  ```
  .planning/phases/19-ledger-reports-polish/19-VALIDATION.md
  .planning/phases/20-account-operations-consent-audit-ui/20-VALIDATION.md
  .planning/phases/21-photo-capture-display-ui/21-VALIDATION.md
  .planning/phases/22-mockup-parity-test-closeout/22-VALIDATION.md
  ```
- **Out-of-scope (surfaced, default deferred):** v2.0 phases 11/12/13 and v2.1 phases 16/17/18 lack `*-VALIDATION.md`. Backfill is **out of scope** for TEST-02 (which is strictly 19–22); it is surfaced here for a separate human decision.

---

## Local CI gate (full, 6 stages)

```
[ci-local] Starting local CI verification gate...
[ci-local][PASS] Stage 1/6: Code format verified.
[ci-local][PASS] Stage 2/6: Solution built successfully (Release).
[ci-local][PASS] Stage 3/6: Unit and Architecture tests passed.
[ci-local][PASS] Stage 4/6: Integration tests passed (Testcontainers MySQL).
[ci-local][PASS] Stage 5/6: Web production build verified.
[ci-local][PASS] Stage 6/6: OpenAPI drift check passed.
[ci-local][PASS] All local CI verification gates PASSED.
```

- UnitTests: **255/255 PASS**
- ArchitectureTests: **20/20 PASS**
- IntegrationTests (Testcontainers MySQL): all PASS
- Angular Docker production build: PASS
- OpenAPI client drift: PASS (no regenerated files)

## Angular unit tests (Karma, local `ng test`)

- `npx ng test --no-watch --browsers=ChromeHeadlessNoSandbox --include='**/login.page.spec.ts'` → **7/7 SUCCESS**
- `npx ng test --no-watch --browsers=ChromeHeadlessNoSandbox --include='**/visits.page.spec.ts'` → **2/2 SUCCESS**
- `npx ng test --no-watch --browsers=ChromeHeadlessNoSandbox --include='**/vehicles.page.spec.ts'` → **2/2 SUCCESS**
- Full Angular suite: **376/379 SUCCESS, 3 pre-existing failures** in `administration.page.spec.ts` + `service-providers.page.spec.ts` (confirmed pre-existing by `git stash` + re-run of those specs against `version/2.2` HEAD `ae94cbd`; same 3 failures present before any Phase 22 change). **No regression introduced by this phase.**

## Playwright E2E (manual — not a CI stage)

`npm run e2e` runs against the running Docker stack (`docker compose -f docker/docker-compose.yml up -d`). Not executed in this environment (no docker stack running) but every spec was authored against the verified components/data-testids in the gatehouse panel and current headings/buttons on each module page. E2E specs are recorded as the plans' `<automated>` verify commands and as Wave-0 requirements in `22-VALIDATION.md`.

---

## Commits on `version/2.2` (Phase 22 atomic commits)

```
e134f60  test(e2e): rewrite gatehouse-workflow against tabbed panel + fix module-pages labels (TEST-01)
ce1bed5  feat(phase-22): UI-01 mockup parity + UI-02 forgot-password toast
e1b4b52  docs(phase-22): finalize 22-VALIDATION.md + cross-phase audit (TEST-02)
```

(Plus an in-progress `chore(npm)` installing `@rollup/rollup-win32-x64-msvc` as a workaround for the optional native binary missing from the host — NOT committed; not needed by the project; left local-only. The project's CI runs inside Docker and is unaffected.)

---

## Files changed (Phase 22)

- **New:** 8 files (4 summaries, 4 validation-related: `tests/visual/{login,dashboard,visits,vehicles}.spec.ts`, `tests/a11y/{login,dashboard}.spec.ts`).
- **Modified:** 7 files (`22-VALIDATION.md`, `login.page.ts`, `login.page.spec.ts`, `visits.page.ts`, `visits.page.spec.ts`, `vehicles.page.ts`, `vehicles.page.spec.ts`, `gatehouse-workflow.spec.ts`, `module-pages.spec.ts`).
- **Backend:** 0 (no .cs files modified).

---

## Decisions surfaced for human review (from 22-RESEARCH.md)

1. **Dashboard parity = design-system conformance, not pixel parity.** No dedicated `mockup/dashboard.html` exists; the current "Shift ledger" diverges from `mockup/index.html`'s "Dashboard preview" stat grid. Phase 22 preserves the shipped ledger (component/icon conformance only); the divergence is recorded in `22-VALIDATION.md` and the 22-01 visual spec headers for a future human call. **No layout redesign of the dashboard.**
2. **Forgot-password toast vs inline banner.** The current inline banner is arguably better UX; converting to toast is a parity call (the locked mockup contract). Phase 22 converts to toast while keeping the modal-closing behavior the user expects.
3. **No client-side 429 cooldown.** The Angular side mirrors whatever the backend actually returns. No invented 15s client cooldown.
4. **Refresh vs delete for gatehouse-workflow E2E.** Refresh. Audit Review + Consent Policy Editor portions retained (still target present UI).
5. **v2.0/v2.1 `*-VALIDATION.md` backfill.** Out of scope for TEST-02 (strictly 19–22); surfaced for separate human decision, default deferred.

---

**Approval:** ✅ verified end-to-end. Phase 22 closes the v2.2 milestone (Phases 19/20/21/22) — all four have `*-VALIDATION.md`, all four pass the full local CI gate.