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
| **Framework** | Playwright `@playwright/test` 1.49 (E2E/visual/a11y) · Jasmine 5.2 + Karma 6.4 (Angular unit) |
| **Config file** | `src/Web/ControlEasyReborn.Web/playwright.config.ts` · `angular.json` `test` architect |
| **Quick run command** | `cd src/Web/ControlEasyReborn.Web && npx playwright test <spec>` |
| **Full suite command** | `cd src/Web/ControlEasyReborn.Web && npm run e2e` (requires running stack) |
| **Estimated runtime** | ~30 s (single spec) / ~5 min (full) |

---

## Sampling Rate

- **After every task commit:** Run `./scripts/verify-ci-local.sh --fast` + `npm test -- --no-watch --browsers=ChromeHeadless` (parity tasks)
- **After every plan wave:** Run full `./scripts/verify-ci-local.sh` + `npm run e2e`
- **Before `/gsd-verify-work`:** Full suite green + `22-VALIDATION.md` `nyquist_compliant: true`
- **Max feedback latency:** ~60 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | UI-01 | T-22-03 | visits page renders via ce-* components; duplicated ce-* CSS removed; visits spec stays green | unit | `npx ng test --no-watch --browsers=ChromeHeadless --include='**/visits.page.spec.ts'` | ⚠️ extend | ⬜ pending |
| 22-01-02 | 01 | 1 | UI-01 | T-22-03 | vehicles page renders via ce-*; Unicode glyphs replaced by ce-icon; no-glyph-entity assertion | unit | `npx ng test --no-watch --browsers=ChromeHeadless --include='**/vehicles.page.spec.ts'` | ⚠️ extend | ⬜ pending |
| 22-01-03 | 01 | 1 | UI-01 | T-22-02 | login/dashboard/visits/vehicles visual + a11y regression specs (design-system conformance) | visual | `cd src/Web/ControlEasyReborn.Web && npx playwright test tests/visual/login.spec.ts tests/a11y/login.spec.ts` | ❌ W0 | ⬜ pending |
| 22-02-01 | 02 | 1 | UI-02 | T-22-01 | forgot-password info toast parity; 401 inline error enumeration-safe; submit busy state | unit | `npx ng test --no-watch --browsers=ChromeHeadless --include='**/login.page.spec.ts'` | ⚠️ extend | ⬜ pending |
| 22-03-01 | 03 | 2 | TEST-01 | T-22-03 | E2E reflects current gatehouse panel (no removed tiles) | E2E | `cd src/Web/ControlEasyReborn.Web && npx playwright test e2e/gatehouse-workflow.spec.ts` | ❌ W0 (rewrite) | ⬜ pending |
| 22-03-02 | 03 | 2 | TEST-01 | T-22-03 | module-page E2E labels match current UI | E2E | `cd src/Web/ControlEasyReborn.Web && npx playwright test e2e/module-pages.spec.ts` | ❌ W0 (fix) | ⬜ pending |
| 22-04-01 | 04 | 1 | TEST-02 | T-22-03 | 22-VALIDATION.md complete six-section contract, per-task map matches plan task IDs | process audit | `grep -c 'nyquist_compliant\|Per-Task Verification Map\|Wave 0 Requirements\|Manual-Only Verifications\|Validation Sign-Off' .planning/phases/22-mockup-parity-test-closeout/22-VALIDATION.md` | ⚠️ draft | ⬜ pending |
| 22-04-02 | 04 | 1 | TEST-02 | — | 19/20/21/22 each have `*-VALIDATION.md` | process audit | `find .planning/phases -maxdepth 2 -name '*-VALIDATION.md' \| sort` | ⚠️ in-flight | ⬜ pending |

*Static grep gates for zero duplicated `.ce-*` CSS and zero Unicode glyph entities in the target pages are plan-level conformance gates recorded in plan 22-01's `<verification>` section (not per-task verifies), so they have no rows in this map.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/visual/login.spec.ts` — snapshots of `/login` (375/1440 × light/dark)
- [ ] `tests/visual/dashboard.spec.ts` — snapshots of `/` dashboard
- [ ] `tests/visual/visits.spec.ts` + `tests/visual/vehicles.spec.ts` (or `feature-pages.spec.ts`)
- [ ] `tests/a11y/login.spec.ts` + `tests/a11y/dashboard.spec.ts` — Axe scans
- [ ] `e2e/gatehouse-workflow.spec.ts` — rewrite against current tabbed panel
- [ ] `e2e/module-pages.spec.ts` — fix stale headings/labels
- [ ] `login.page.spec.ts` — extend for 401 inline-error + forgot-password toast parity
- [ ] Framework install: Playwright Chromium via `npm run e2e:install`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual theme parity (light/dark) acceptance | UI-01 | Pixel/subjective parity | View login/dashboard/visits/vehicles in both themes against `mockup/` reference |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
