# Phase 22 Plan 03 — SUMMARY

**Plan:** 22-03 — Rewrite gatehouse-workflow E2E + fix module-pages stale labels (TEST-01)
**Status:** ✅ complete

## What shipped

### Gatehouse E2E rewrite

`src/Web/ControlEasyReborn.Web/e2e/gatehouse-workflow.spec.ts`
- Replaced the Phase-13 "Gatehouse Workflow" describe block (which asserted removed dashboard FAB/tiles "New entry" / "Register entry" / "Entry denied" / "Gatehouse only" / "Override") with a new **Gatehouse Operator Panel** describe block that drives the current tabbed panel at `/gatehouse`:
  - **Panel loads with tablist and defaults to QR scan tab** — `page.goto('/gatehouse')`, assert `getByRole('tablist', { name: 'Gatehouse operator tabs' })`, `getByTestId('tab-qr')` has `aria-selected="true"`, and `getByTestId('panel-qr')` is visible.
  - **Tab switching renders the matching panel** — click each of `tab-manual`, `tab-walkin`, `tab-visits`; assert the corresponding `panel-*` testid is visible and the tab's `aria-selected="true"`. Verifies `walkin-name` and `open-visits-search` are visible on their respective panels.
  - **Walk-in registration submits and surfaces a success card** — fills synthetic `walkin-name` ("FedEx Driver"), `walkin-document` (synthetic CNPJ `11222333000181`), `walkin-phone` (synthetic `11988887777`), `walkin-purpose` ("Delivery"); selects first apartment via the shared `selectFirstApartmentOption(page, 'walkin-apartment')` helper; clicks `walkin-submit-btn`; asserts the success card ("checked in successfully") appears within 10s.
- **Retained** unchanged: the **Audit Review** describe block (audit log page + filter row + override-state filter + CSV export with millisecond timestamps + audit-row state badge); the **Consent Policy Editor** describe block (4 toggle rows, Save disabled when clean, dirty toggle enables Save, PUT call + "Policy updated" toast). Both target still-present routes (`/audit`, `/admin/consent-policy`).
- Removed-tile assertions (`getByRole('button', { name: 'New entry' })`, `getByRole('button', { name: /Register entry/i })`, `getByRole('button', { name: /Entry denied/i })`, `getByRole('button', { name: /Gatehouse only/i })`, `getByRole('button', { name: /Override/i })`) are gone.
- Camera-mock walk-in test from the previous gatehouse spec (which still asserts `/Register entry/i` on the dashboard) was removed with the rest of the stale tile block — a fresh walk-in registration test against the tabbed panel replaces it.
- Synthetic data only (`FedEx Driver`, `11222333000181`, etc.); no real PII.

### module-pages E2E fix

`src/Web/ControlEasyReborn.Web/e2e/module-pages.spec.ts`
- Replaced the stale `pages` array (asserted pre-Phase-17 headings like `Residents`, `Visits`, `Service Providers`, `Administration`) with the current, post-Phase-17 + post-22-01 labels:
  - `/residents` → heading `Resident register` + button `Add resident`
  - `/visits` → heading `Visit register (administrative)` + button `Pre-register visit` (the plus glyph is no longer part of the accessible name — it is rendered by `ce-icon` as `aria-hidden`)
  - `/vehicles` → heading `Vehicles` + button `Add vehicle`
  - `/service-providers` → heading `Service providers` + button `Add provider`
- Removed the `/administration` entry from the create-action loop (the administration page heading is `Condominium & System Administration` and it has NO create/add button). Replaced it with a dedicated test that asserts the heading and the settings tab's `Save settings` button are visible (settings is the default tab).
- `beforeEach` localStorage bootstrap unchanged (seeds a TenantAdmin token + roles + permissions so pages render write actions).
- Header comment records the surfaced decision that E2E runs via `npm run e2e` (manual, not CI).

## Verification

- Static guard: `grep -n 'New entry\|Register entry\|Entry denied\|Gatehouse only\|Override' e2e/gatehouse-workflow.spec.ts` → only 3 matches remain: 2 inside the header comment block (documenting which tile names were removed) and 1 inside the audit-filter assertion `await expect(badges.nth(i)).toHaveText(/Override/i)` (the legit `entered_override` audit state, NOT a tile button). No `getByRole('button', { name: ... })` tile-name assertions remain.
- `./scripts/verify-ci-local.ps1 -Fast` → PASS (E2E/visual/a11y are not CI stages per `verify-ci-local.sh`'s documented 6 stages; RESEARCH Pitfall 3 confirms Playwright is manual-only).
- `npx playwright test e2e/gatehouse-workflow.spec.ts` and `e2e/module-pages.spec.ts` require the running Docker stack (`npm run e2e`) — recorded as the plan's `<automated>` verify; not executed in this environment (no docker stack running). The verify command in the plan's `<verification>` block lists the local `npx playwright test <spec>` form, which is what a developer runs against the stack.

## Decision (mirrors 22-RESEARCH.md Open Question 3)

Refresh, not delete. The audit-review and consent-policy portions of the old `gatehouse-workflow.spec.ts` target still-present UI and are valuable coverage, so they were retained and relocated within the same file. Only the removed FAB/tile assertions were deleted, and the gatehouse portion was rewritten against the tabbed panel. The Phase-13 comment header was preserved as a historical breadcrumb but the stale test bodies are gone.

## Surfaced: E2E not wired into CI

Per AGENTS.md Policy + RESEARCH Pitfall 3, `verify-ci-local.sh` runs no Playwright/Karma stage. Wiring E2E into the CI gate is a separate policy decision and is **not** silently expanded in this phase.