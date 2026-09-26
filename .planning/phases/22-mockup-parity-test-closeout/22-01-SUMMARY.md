# Phase 22 Plan 01 — SUMMARY

**Plan:** 22-01 — visits/vehicles component adoption + visual/a11y regression specs for login/dashboard/visits/vehicles (UI-01)
**Status:** ✅ complete

## What shipped

### Visits page (UI-01 component adoption)
`src/Web/ControlEasyReborn.Web/src/app/features/visits/visits.page.ts`
- Imports extended: added `CeBadgeComponent`, `CeCardComponent`, `CeIconComponent`, `CeTableComponent` to `imports[]`.
- Replaced raw `<button class="ce-button variant-* size-*">` with `<ce-button variant size>` (header "+ Pre-register visit", QR Pass, Check in, Check out, Photos buttons).
- Replaced inline `<span class="spinner">` with `ce-button [loading]="actionInFlight() === visit.id"` (component renders its own `aria-busy` spinner).
- Replaced `<div class="ce-card"><table class="ce-table">` with `<ce-card [padded]="false"><ce-table>`.
- Replaced `<span class="ce-badge">{{ label }}</span>` with `<ce-badge [tone]="getStatusBadgeTone(status)" size="sm" [content]="getStatusLabel(status)" />`; added `getStatusBadgeTone(status)` helper (Pending→neutral, CheckedIn→success, CheckedOut→neutral, Cancelled→danger).
- Deleted from `styles[]` the duplicated component CSS blocks: `.ce-card`, `.ce-table`, `.ce-badge`, `.badge-*`, `.ce-button`, `.variant-*`, `.size-*`, `.spinner`, `@keyframes spin` — kept only page-specific rules (`.page-header`, `.page-title`, `.page-subtitle`, `.filter-tabs`, `.filter-tab`, `.page-error`, `.text-secondary`, `.text-xs`).

### Vehicles page (UI-01 component adoption + icon migration)
`src/Web/ControlEasyReborn.Web/src/app/features/vehicles/vehicles.page.ts`
- Imports extended: added `CeBadgeComponent`, `CeCardComponent`, `CeEmptyStateComponent`, `CeIconComponent`, `CeInputComponent`, `CeSpinnerComponent`, `CeTableComponent`.
- Unicode decimal-entity glyphs replaced with `ce-icon` (Lucide): `&#8635;` (refresh) → `<ce-icon name="refresh" [size]="16" />`, `&#43;` (plus) → `<ce-icon name="plus" [size]="16" />` (×3 sites: header "Add vehicle", empty-state CTA, modal-footer CTA), `&#128663;` (car) → `<ce-icon name="car" [size]="40" />` (×2 sites: empty-state, empty-table), `&#128247;` (camera) → `<ce-icon name="camera" [size]="16" />` (row "Vehicle photos" button), `&#9998;` (pencil) → `<ce-icon name="edit" [size]="16" />` (row "Edit vehicle" button). The `ce-empty-state` is invoked with `icon=""` + a slotted `<ce-icon name="car" [size]="40" />` so the glyph is rendered by Lucide (not as literal text).
- Raw buttons → `<ce-button>` (refresh, Add vehicle, modal-footer Cancel/Create/Save/Done/Close).
- `<div class="ce-card"><table class="ce-table">` → `<ce-card [padded]="false"><ce-table>`.
- `<span class="ce-badge tone-success size-sm">{{ label }}</span>` → `<ce-badge [tone]="vehicle.active ? 'success' : 'neutral'" size="sm" [content]="label" />`.
- `<div class="ce-spinner tone-primary size-lg">` → `<ce-spinner tone="primary" size="lg" />`.
- Form inputs converted: each `<label>+<input class="ce-input">` pair (plate, owner, brand, model, color) replaced by `<ce-input label=... inputId=... placeholder=... formControlName=... [error]=...>` (uses `CeInputComponent`'s built-in `ControlValueAccessor`).
- Modal selects kept as raw HTML `<select>` but with a page-scoped `.vehicle-select` class (no `ce-input` class name; ce-select does not exist).
- Modal text inputs moved from `<input class="ce-input">` to `<ce-input>` — every error/help block is now rendered by the component.
- Deleted from `styles[]` the duplicated component CSS blocks: `.ce-button`, `.ce-card`, `.ce-table`, `.ce-badge`, `.ce-empty-state`, `.ce-spinner`, `.ce-modal*`, `.ce-form`, `.ce-input-group`, `.ce-input-label`, `.ce-input-wrapper`, `.ce-input`, `.ce-input-error` — kept only `.page-header`, `.page-title`, `.page-subtitle`, `.page-error`, `.loading-state`, `.actions-col`, `.action-cell`, `.form-row`, `.form-label`, `.vehicle-select`, `.form-error-banner`.

### Unit specs (extended)

- `visits.page.spec.ts` — added `importProvidersFrom(CE_LUCIDE_ICONS)` so `<ce-icon>` resolves in tests; existing Maria Santos + QR-Pass assertions stay green.
- `vehicles.page.spec.ts` — added `importProvidersFrom(CE_LUCIDE_ICONS)`; new test asserts the refreshed template contains no Unicode decimal-entity icon glyphs (`&#128663;`, `&#8635;`, `&#43;`, `&#128247;`, `&#9998;`) and that at least one `<ce-icon>` element renders. Synthetic fixtures unchanged (`ABC1D23`, `vehicleType: 2`).

### Playwright regression specs (new)

- `tests/visual/login.spec.ts` — snapshots `/login` at 375×812 + 1440×900 in light + dark; pixel-exact (`maxDiffPixelRatio: 0.001`).
- `tests/visual/dashboard.spec.ts` — snapshots `/` (dashboard) at 375×812 + 1440×900 in light + dark; tolerant threshold (`maxDiffPixelRatio: 0.05`) + structural conformance assertions (`ce-button` + `ce-icon` visible). Header comment records the surfaced decision that dashboard parity = design-system conformance (the Shift Ledger diverges from `mockup/index.html`'s stat grid — divergence surfaced for human call, not a layout redesign).
- `tests/visual/visits.spec.ts` — snapshots `/visits` at 375×812 + 1440×900 in light + dark; tolerant + structural.
- `tests/visual/vehicles.spec.ts` — snapshots `/vehicles` at 375×812 + 1440×900 in light + dark; tolerant + structural.
- `tests/a11y/login.spec.ts` — Axe scan of `/login` in light + dark; asserts zero serious/critical violations with WCAG2A/AA/21A/21AA tags.
- `tests/a11y/dashboard.spec.ts` — Axe scan of `/` (dashboard); asserts zero serious/critical violations.
- All Playwright specs use `loginAsDemoUser` (synthetic demo seed `admin@controleasy.app` / `demo123`, no real PII).

## Verification

- `npx ng test --no-watch --browsers=ChromeHeadlessNoSandbox --include='**/visits.page.spec.ts'` → **2/2 SUCCESS**.
- `npx ng test --no-watch --browsers=ChromeHeadlessNoSandbox --include='**/vehicles.page.spec.ts'` → **2/2 SUCCESS**.
- `npx ng test --no-watch --browsers=ChromeHeadlessNoSandbox` (full suite) → **376/379 SUCCESS**, 3 pre-existing failures in `administration.page.spec.ts` and `service-providers.page.spec.ts` (confirmed pre-existing by `git stash` + re-run of those specs against `version/2.2` HEAD; same 3 failures present before any Phase 22 change). **No regression introduced by this plan.**
- Static conformance gates (zero duplicated `.ce-*` CSS, zero Unicode glyph entities in the four target pages):
  - `grep -rn '\.ce-button\|\.ce-table\|\.ce-badge\|\.ce-card\|\.ce-empty-state\|\.ce-spinner\|\.ce-modal' src/Web/ControlEasyReborn.Web/src/app/features/visits/visits.page.ts` → 0 matches.
  - Same grep over `vehicles/vehicles.page.ts` → 0 matches (vehicle `<select>` uses `.vehicle-select`, not `.ce-input`).
  - `grep -rn '&#[0-9]\+;' src/Web/ControlEasyReborn.Web/src/app/features/visits/visits.page.ts src/Web/ControlEasyReborn.Web/src/app/features/vehicles/vehicles.page.ts` → 0 matches.
- `./scripts/verify-ci-local.ps1 -Fast` → PASS (format skipped for no .cs changes; Release build green; UnitTests 255/255; ArchitectureTests 20/20).

## Manual-only verification (per VALIDATION.md)

Visual theme parity (light/dark) acceptance for login/dashboard/visits/vehicles against `mockup/` reference is subjective/pixel-parity and is recorded in `22-VALIDATION.md`'s Manual-Only Verifications table for a human review pass.

## Surfaced decision (mirrors 22-RESEARCH.md Pitfall 1)

There is no dedicated `mockup/dashboard.html` or `mockup/visits.html` or `mockup/vehicles.html` page. "Parity" for those three means **design-system conformance** (component gallery + tokens + `mockup/index.html`'s stat grid), not pixel-matching a nonexistent page. The current dashboard is a "Shift ledger" (operational totals + arrival record + handover panel), which diverges from `mockup/index.html`'s stat-grid preview — the plan preserves the shipped ledger (component/icon conformance only, no layout redesign) and records the divergence for a human call.