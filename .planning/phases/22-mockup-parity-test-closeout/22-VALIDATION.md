---
phase: 22
slug: mockup-parity-test-closeout
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-24
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright `@playwright/test` 1.49 (E2E/visual/a11y) · Jasmine 5.2 + Karma 6.4 (Angular unit) · xUnit 2.9 + Testcontainers.MySql 4.0 (backend, regression-only) |
| **Config file** | `src/Web/ControlEasyReborn.Web/playwright.config.ts` · `angular.json` `test` architect · `tests/Directory.Build.props` |
| **Quick run command** | `cd src/Web/ControlEasyReborn.Web && npx playwright test <spec>` |
| **Full suite command** | `./scripts/verify-ci-local.ps1` (6-stage) — note: Playwright/visual/a11y run **manually** via `npm run e2e` against the Docker stack; they are NOT a `verify-ci-local` stage. |
| **Estimated runtime** | ~30 s (Angular single spec) / ~3 s (`--fast`) / ~5 min (full CI) |

---

## Sampling Rate

- **After every task commit:** Run `./scripts/verify-ci-local.ps1 -Fast` (+ `npx ng test --no-watch --browsers=ChromeHeadless --include='**/<page>.page.spec.ts'` for parity tasks).
- **After every plan wave:** Run full `./scripts/verify-ci-local.ps1`; for plan 22-03 also `cd src/Web/ControlEasyReborn.Web && npm run e2e` against the running Docker stack.
- **Before `/gsd-verify-work`:** Full suite green + `nyquist_compliant: true` flipped in this file.
- **Max feedback latency:** ~60 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | UI-01 | T-22-03 | visits page renders via ce-* components; duplicated ce-* CSS removed; existing QR-Pass assertion stays green | unit (Angular) | `npx ng test --no-watch --browsers=ChromeHeadless --include='**/visits.page.spec.ts'` | ⚠️ extend | ⬜ pending |
| 22-01-02 | 01 | 1 | UI-01 | T-22-03 | vehicles page renders via ce-*; Unicode glyphs replaced by ce-icon; no-glyph-entity assertion added | unit (Angular) | `npx ng test --no-watch --browsers=ChromeHeadless --include='**/vehicles.page.spec.ts'` | ⚠️ extend | ⬜ pending |
| 22-01-03 | 01 | 1 | UI-01 | T-22-02 | login/dashboard/visits/vehicles visual + a11y regression specs against demo seed | visual + a11y | `cd src/Web/ControlEasyReborn.Web && npx playwright test tests/visual/login.spec.ts tests/a11y/login.spec.ts` | ❌ W0 | ⬜ pending |
| 22-02-01 | 02 | 1 | UI-02 | T-22-01 | forgot-password info toast parity; 401 inline error enumeration-safe; submit busy state | unit (Angular) | `npx ng test --no-watch --browsers=ChromeHeadless --include='**/login.page.spec.ts'` | ⚠️ extend | ⬜ pending |
| 22-03-01 | 03 | 2 | TEST-01 | T-22-03 | gatehouse E2E drives tabbed operator panel; removed-tile assertions deleted; audit + consent-policy retained | E2E | `cd src/Web/ControlEasyReborn.Web && npx playwright test e2e/gatehouse-workflow.spec.ts` | ❌ W0 (rewrite) | ⬜ pending |
| 22-03-02 | 03 | 2 | TEST-01 | T-22-03 | module-pages E2E labels match current UI (Visit register (administrative), Pre-register visit, Add provider, etc.) | E2E | `cd src/Web/ControlEasyReborn.Web && npx playwright test e2e/module-pages.spec.ts` | ❌ W0 (fix) | ⬜ pending |
| 22-04-01 | 04 | 1 | TEST-02 | T-22-03 | 22-VALIDATION.md contains all six required sections; per-task map matches plan task IDs | process audit | `grep -c 'nyquist_compliant\|Per-Task Verification Map\|Wave 0 Requirements\|Manual-Only Verifications\|Validation Sign-Off' .planning/phases/22-mockup-parity-test-closeout/22-VALIDATION.md` | ⚠️ draft | ⬜ pending |
| 22-04-02 | 04 | 1 | TEST-02 | — | cross-phase audit confirms 19/20/21/22 each have `*-VALIDATION.md` | process audit | `find .planning/phases -maxdepth 2 -name '*-VALIDATION.md' | sort` | ⚠️ in-flight | ⬜ pending |

*Static grep gates for zero duplicated `.ce-*` CSS and zero Unicode glyph entities in the four target pages (login/dashboard/visits/vehicles) are plan-level conformance gates recorded in plan 22-01's `<verification>` section, not per-task verifies; they have no rows in this map.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/visual/login.spec.ts` — Playwright snapshots of `/login` (375/1440 × light/dark)
- [ ] `tests/visual/dashboard.spec.ts` — snapshots of `/` dashboard (component conformance, tolerant threshold)
- [ ] `tests/visual/visits.spec.ts` + `tests/visual/vehicles.spec.ts` — component conformance snapshots
- [ ] `tests/a11y/login.spec.ts` + `tests/a11y/dashboard.spec.ts` — Axe scans
- [ ] `login.page.spec.ts` — extend for 401 inline-error + submit busy state + forgot-password toast parity
- [ ] `e2e/gatehouse-workflow.spec.ts` — rewrite against current tabbed operator panel (remove tile assertions)
- [ ] `e2e/module-pages.spec.ts` — fix stale headings/labels (visits → "Visit register (administrative)" / "Pre-register visit", service-providers → "Add provider", administration → no create button)
- [ ] Framework install: Playwright Chromium via `npm run e2e:install`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual theme parity (light/dark) acceptance | UI-01 | Pixel/subjective parity | View login/dashboard/visits/vehicles in both themes against `mockup/` reference |

---

## Cross-Phase Validation Coverage (TEST-02 audit)

| Phase | VALIDATION.md present | Status |
|-------|----------------------|--------|
| 19 — ledger-reports-polish | ✅ yes (`19-VALIDATION.md`) | draft, owned by Phase 19 |
| 20 — account-operations-consent-audit-ui | ✅ yes (`20-VALIDATION.md`) | draft, owned by Phase 20 |
| 21 — photo-capture-display-ui | ✅ yes (`21-VALIDATION.md`) | verified (flipped `nyquist_compliant: true` on 2026-09-26) |
| 22 — mockup-parity-test-closeout | ✅ yes (this file) | draft, owned by Phase 22 |

**Out-of-scope surfacing (TEST-02 deferred):** v2.0 phases 11/12/13 and v2.1 phases 16/17/18 lack `*-VALIDATION.md` (they shipped with `*-VERIFICATION.md` only). Backfilling them is **out of scope** for TEST-02 (which is strictly 19–22); it is surfaced here for a separate human decision, default deferred.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending