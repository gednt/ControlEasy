# Phase 22: Mockup Parity & Test Closeout — Research

**Researched:** 2026-09-24
**Domain:** Angular 18 frontend parity (visual + functional) and test-suite hygiene/validation coverage
**Confidence:** HIGH

## User Constraints (from CONTEXT.md)

> Copied verbatim from `22-CONTEXT.md`. These are locked decisions; the planner MUST honor them and must not plan alternatives.

### Locked Decisions (Implementation Decisions)

- **UI-01 — Mockup visual parity (light + dark themes):** Extend parity beyond the residents page to: login, dashboard, visits, vehicles. Per `.specs/mockup-visual-parity/` (UI-03 continuation).
- **UI-02 — Functional fixes:** Login form behavior, toast patterns, page interactions per `.specs/2-mockup-functional-fixes/` (UI-04 continuation): real error paths, submit spinner, auto-dismissing toasts.
- **TEST-01 — Stale E2E refresh:** `e2e/gatehouse-workflow.spec.ts` no longer tests removed dashboard buttons/tiles. E2E reflects the current gatehouse panel + ledger. Stale specs refreshed or removed.
- **TEST-02 — Nyquist validation coverage:** Every v2.2 phase (19–22) has a `*-VALIDATION.md`. (v2.1 left 3 phases without any; v2.2 must close that gap.)

### the agent's Discretion

- Exact visual-parity acceptance thresholds (per the mockup spec).
- Whether stale E2E specs are refreshed or removed (per spec, no testing of removed UI).

### Deferred Ideas (OUT OF SCOPE)

- Parity for screens beyond login/dashboard/visits/vehicles (future continuation).
- Door integration, biometrics — other milestones.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Mockup visual parity extended beyond residents page to login, dashboard, visits, vehicles per `.specs/mockup-visual-parity/` (UI-03 continuation) | §Visual Parity Gap Analysis + §Standard Stack + §Code Examples. Residents parity already done; the remaining work is component adoption + icon migration + CSS dedup on the 4 target pages. |
| UI-02 | Mockup functional fixes: login form behavior, toast patterns, page interactions per `.specs/2-mockup-functional-fixes/` (UI-04 continuation) — real error paths, submit spinner, auto-dismissing toasts | §Functional Fixes Gap Analysis. Login already has real error paths + spinner + show/hide; toast service already auto-dismisses (5s). Remaining gap: forgot-password uses inline banner, not the mockup's toast contract. |
| TEST-01 | Stale E2E refreshed/removed — `e2e/gatehouse-workflow.spec.ts` no longer tests removed dashboard buttons/tiles; E2E reflects current gatehouse panel | §Stale E2E Audit. Identifies exact stale tests + which removed UI they target. E2E is NOT wired into CI (verified). |
| TEST-02 | Nyquist `*-VALIDATION.md` coverage exists for milestone phases (19–22) | §Nyquist Validation Coverage State. Enumerates which v2.0/v2.1/v2.2 phases have/lack VALIDATION.md + the VALIDATION.md template contract. |
</phase_requirements>

## Project Constraints (from AGENTS.md)

Binding directives the planner must honor (authoritative source: `./AGENTS.md`, project-owned sections):

1. **Mandatory Local CI Verification Gate** — two tiers: per-turn fast gate (`scripts/verify-ci-local.sh --fast`: format + Release build + unit/arch tests) and task-completion full gate (`scripts/verify-ci-local.sh`: 6 stages). Claiming completion/checking off tasks/pushing without passing the full local CI suite is a constitutional violation. `[VERIFIED: AGENTS.md Policy + scripts/verify-ci-local.sh grep]`
2. **Platform-aware commands (Constitution Principle VIII)** — POSIX-only snippets must not run on Windows host; canonical fix is devcontainer or PowerShell wrappers. `[VERIFIED: AGENTS.md]`
3. **Angular conventions** — standalone components, `OnPush`, signals, `ce-` prefix, kebab-case selectors, `@angular-eslint/recommended`, Prettier single-quote/120 cols, TypeScript strict. `[VERIFIED: AGENTS.md]`
4. **DTOs generated from OpenAPI** (`ng-openapi-gen`) — no shared domain models between frontend/backend. `[VERIFIED: AGENTS.md]`
5. **Testing stack** — xUnit + FluentAssertions + NSubstitute + Testcontainers.MySql + Playwright; Karma + Jasmine for Angular unit tests. `[VERIFIED: AGENTS.md]`
6. **Pre-commit adversarial review** — no `git commit` until build+tests green AND adversarial review returns zero CRITICAL/HIGH. `[VERIFIED: AGENTS.md]`
7. **Synthetic test data only** — never copy real document numbers/names/contacts into tests/snapshots/seeders/example payloads. `[VERIFIED: AGENTS.md]` — directly relevant to any new Playwright visual snapshots (must use synthetic fixture data).
8. **No EF Core, no MediatR, no MVC controllers** — backend only; not directly touched by this phase but must not be violated. `[VERIFIED: AGENTS.md]`

## Summary

Phase 22 is a **software-only closeout** phase that sits at the end of the v2.2 milestone and **depends on Phases 19, 20, 21** (its E2E refresh and Nyquist coverage must reflect the final surfaces those phases produce). It has two independent capabilities: (1) **mockup parity + functional fixes** for four high-traffic screens (login, dashboard, visits, vehicles), and (2) **test hygiene** (refresh/remove stale E2E + ensure `*-VALIDATION.md` exists for every v2.2 phase).

The critical grounding finding is that **the residents page parity is already complete** — `residents.page.ts` already imports `CeStatTileComponent`, `CePaginationComponent`, `CeIconComponent`, and renders stat tiles, recent-activity, and pagination. `[VERIFIED: grep residents.page.ts]` The actual remaining parity work is on the *other four* pages, which still duplicate `ce-*` CSS and use Unicode glyph entities (`&#8635;`, `&#43;`, `&#128663;`) instead of the `ce-icon`/Lucide component. `[VERIFIED: grep features/ for duplicated CSS + Unicode entities]`

Two important scope clarifications: (a) the `mockup/` directory has **no dedicated dashboard/visits/vehicles pages** — `app.html` is the *Residents* page, `login.html` is auth, `index.html` is the design-system hub with a "Dashboard preview" stat grid, and `showcase.html` is the component gallery. `[VERIFIED: ls mockup/ + grep mockup/index.html + mockup/app.html]` So "parity" for dashboard/visits/vehicles means **matching the design-system component contract (showcase + tokens) and the index.html stat-grid**, not pixel-matching a nonexistent mockup page. (b) `.specs/2-mockup-functional-fixes/` is a spec about the **static `mockup/assets/app.js`** prototype's behavior, not the Angular app — its UC-8..UC-14 demo behaviors (fake 401/429 emails, "multi" tenant picker, toast on forgot-password) are the *contract* the Angular service layer should mirror. `[CITED: .specs/2-mockup-functional-fixes/design.md]` CONTEXT.md correctly reinterprets UI-02 as "login form behavior, toast patterns, page interactions" for the Angular app.

**Primary recommendation:** Treat UI-01/UI-02 as a *component-adoption + icon-migration + functional-contract-verification* pass (not greenfield design), and treat TEST-01/TEST-02 as *removal + coverage generation*: rewrite/delete `gatehouse-workflow.spec.ts` against the current tabbed gatehouse panel, fix `module-pages.spec.ts` stale labels, and author `19/20/21/22-VALIDATION.md` per the GSD template (all four are currently missing).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Visual parity (design-system adoption, icons, tokens) | Browser / Client (Angular) | — | Parity is a pure SPA concern: component rendering, CSS variables, Lucide icons, theme toggling all happen in the browser. No backend or CDN involvement. |
| Login functional fixes (error paths, spinner, toasts) | Browser / Client (Angular) | API / Backend (auth error responses) | UI behavior is client-side; the *error content* comes from the backend's RFC 7807 `ProblemDetails` (401/429 `detail`). The login page already maps `detail`/`title`/status. `[VERIFIED: login.page.ts extractErrorMessage + auth.service]` |
| Toast auto-dismiss / patterns | Browser / Client (Angular) | — | `CeToastHostComponent` + `ToastService` are pure client; auto-dismiss is a `setTimeout` in the component. `[VERIFIED: toast.component.ts]` |
| Stale E2E refresh/removal | Browser / Client (Playwright) | CDN / Static (no) | E2E drives a real browser against the running stack; it is *not* part of the backend test tier. `[VERIFIED: verify-ci-local.sh has no Playwright stage]` |
| Nyquist `*-VALIDATION.md` coverage | Documentation/process artifact | — | VALIDATION.md is a GSD planning artifact in `.planning/`, not runtime code. It lives in the workflow tier. |

## Standard Stack

### Core (already in `package.json` — no new installs required for this phase)

| Library | Pinned Version | Purpose | Why Standard |
|---------|---------------|---------|--------------|
| `@playwright/test` | `^1.49.0` (latest 1.63.0) | E2E + visual regression + a11y runner | Already the project E2E/visual/a11y framework; drives `e2e/`, `tests/visual/`, `tests/a11y/`. `[VERIFIED: package.json + npm view]` |
| `@axe-core/playwright` | `^4.11.3` (latest 4.13.0) | WCAG a11y assertions | Used in `tests/a11y/showcase.spec.ts`. `[VERIFIED: package.json + npm view]` |
| `lucide-angular` | `^0.454.0` | Icon library backing `ce-icon` | Installed and already imported by `icon.component.ts` via `LucideAngularModule`. `[VERIFIED: package.json + icon.component.ts]` |
| Jasmine + Karma | Karma 6.4.4 / Jasmine 5.x | Angular unit tests (`*.spec.ts`) | 45 co-located spec files exist, mostly design-system. `[VERIFIED: npm view karma + TESTING.md + find *.spec.ts]` |
| Tailwind CSS 4 | `4.1` (via `@tailwindcss/postcss`) | Utility layer over design tokens | Per STACK.md; `var(--space-*)` is canonical, `var(--spacing-*)` a Tailwind alias only. `[VERIFIED: STACK.md]` |

### Supporting / Not Needed

| Library | Purpose | When to Use |
|---------|---------|-------------|
| `@lucide/angular` | New home of the Lucide Angular wrapper | **Only** if the deprecated `lucide-angular` must be replaced. Do NOT migrate this phase — it is out of scope and would churn every icon import. `[ASSUMED]` |
| `@zxing/browser` / `@zxing/library` | QR scanning | Already used by gatehouse QR tab; not touched by Phase 22. `[VERIFIED: package.json]` |

**Installation:** No new packages are required for this phase. All parity/test work uses the existing stack. If the planner chooses to add new visual-regression specs, they reuse `@playwright/test` already present.

**Version verification (npm registry, this session):**
- `lucide-angular` → latest published `1.0.0`, **deprecated**; project pins `^0.454.0`. `[VERIFIED: npm registry]`
- `@playwright/test` → latest `1.63.0` (project pins `^1.49.0`). `[VERIFIED: npm registry]`
- `@axe-core/playwright` → latest `4.13.0` (project pins `^4.11.3`). `[VERIFIED: npm registry]`
- `karma` → `6.4.4`; `jasmine-core` → `7.0.2`. `[VERIFIED: npm registry]`

## Package Legitimacy Audit

> This phase installs **no new packages**; the audit below covers the packages the phase's tests/parity work *relies on*, all already present in `package.json`.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `lucide-angular` | npm | ~4 yrs (0.454.0) | 72,644/wk | github.com/lucide-icons/lucide | SUS (deprecated) | Keep pinned; do NOT migrate. Note: `@lucide/angular` (1.48.0) is the successor — flag as future work, not this phase. |
| `@playwright/test` | npm | mature | 44.4M/wk | github.com/microsoft/playwright | OK | Approved (existing dependency) |
| `@axe-core/playwright` | npm | mature | 7.2M/wk | github.com/dequelabs/axe-core-npm | OK | Approved (existing dependency) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `lucide-angular` (deprecated — flagged by `package-legitimacy check` as `SUS` with reason `deprecated`). It is already in use and functional; the planner should NOT gate it behind a checkpoint (it is a pinned, working, pre-existing dependency), but SHOULD note in the plan that a future phase may migrate to `@lucide/angular`.

*No `[ASSUMED]` packages are being newly introduced. `@lucide/angular` is mentioned only as a noted successor and is tagged `[ASSUMED]` for its appropriateness as a migration target.*

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
                         │            Browser (Angular 18 SPA)          │
                         │                                              │
  /login ──────────────▶ │  LoginPage ── ce-input/ce-checkbox/ce-button  │
                         │     │ (AuthService.login → API)              │
                         │     ├─ error path: ProblemDetails detail ─────┼──▶ inline error (aria-live)
                         │     ├─ pending: ce-button [loading] spinner   │
                         │     └─ success: postLoginRoute() / tenant picker
                         │                                              │
  /dashboard /visits     │  DashboardPage, VisitsPage, VehiclesPage     │
  /vehicles ───────────▶ │     │ adopt ce-* components + ce-icon (Lucide)│
                         │     └─ drop duplicated .ce-* CSS + Unicode   │
                         │        glyphs (&#8635; &#43; &#128663;)        │
                         │                                              │
  ToastService ◀─────────┼── CeToastHostComponent ── auto-dismiss 5s     │
                         └─────────────────────────────────────────────┘
                                      │ HTTP (OpenAPI-generated client)
                                      ▼
                         ┌─────────────────────────────────────────────┐
                         │        API (ASP.NET Core 8)                 │
                         │  RFC 7807 ProblemDetails (401/429 detail)    │
                         │  JWT bearer, tenant-scoped                    │
                         └─────────────────────────────────────────────┘
                                      │
                         ┌─────────────────────────────────────────────┐
                         │        Playwright (E2E/visual/a11y)          │
                         │  e2e/*.spec.ts · tests/visual/ · tests/a11y/ │
                         │  ⚠ NOT wired into verify-ci-local.sh         │
                         └─────────────────────────────────────────────┘
```

Key facts encoded above:
- The **dashboard page is NOT the mockup's stat-tile dashboard** — it is the "Shift ledger" (operational totals + arrival record + handover panel). `mockup/index.html`'s "Dashboard preview" stat grid (Active residents / Visits today / Service providers / Pending check-ins) does not match the current `dashboard.page.ts` content. `[VERIFIED: dashboard.page.ts + mockup/index.html grep]` This is a **parity gap to reconcile** (see Pitfalls).
- `verify-ci-local.sh` runs **no Playwright and no Karma** stage; its 6 stages are format / build / unit+arch / integration / web-docker-build / openapi-drift. `[VERIFIED: verify-ci-local.sh stages 1-6 grep]` So visual/a11y/E2E run **only manually** via `npm run e2e` against the Docker stack.

### Recommended Project Structure (unchanged; files this phase touches)

```
src/Web/ControlEasyReborn.Web/
├── e2e/
│   ├── gatehouse-workflow.spec.ts      # STALE — rewrite or delete (TEST-01)
│   └── module-pages.spec.ts            # STALE labels — fix (TEST-01)
├── tests/
│   ├── visual/                         # extend: login/dashboard/visits/vehicles snapshots (UI-01)
│   │   └── showcase.spec.ts            # only existing visual spec
│   └── a11y/
│       └── showcase.spec.ts            # only existing a11y spec
└── src/app/
    ├── features/
    │   ├── auth/login.page.ts          # UI-02: forgot-password toast parity
    │   ├── dashboard/dashboard.page.ts # UI-01: ce-* adoption (already partial)
    │   ├── visits/visits.page.ts       # UI-01: dedup CSS + icons
    │   └── vehicles/vehicles.page.ts   # UI-01: dedup CSS + Unicode glyphs
    └── design-system/                  # reference (do not modify contract)
```

### Pattern 1: Component adoption (drop duplicated CSS + Unicode glyphs)

**What:** Feature pages replace `<button class="ce-button variant-…">` with `<ce-button variant="…">`, replace `<div class="ce-empty-state-icon">&#128663;</div>` with `<ce-icon name="…">`, and delete the duplicated `.ce-button/.ce-input/.ce-table/.ce-card/.ce-badge/.ce-modal` CSS blocks from their `styles: []`.

**When to use:** On `visits`, `vehicles`, `apartments`, `service-providers`, `administration`, `platform/condominiums` (UI-01 scoped to visits+vehicles this phase, but the pattern is shared).

**Evidence:** `grep -rln '\.ce-button\|\.ce-input\|\.ce-table\|\.ce-card\|\.ce-badge\|\.ce-modal' features/` returns 12 feature files still duplicating the CSS; `grep '&#[0-9]\+;' features/` returns Unicode glyph entities in vehicles, apartments, platform, service-providers. `[VERIFIED: grep]`

**Example (ce-icon replaces Unicode glyph):**
```html
<!-- Before (vehicles.page.ts) -->
<button class="ce-button variant-secondary size-md" (click)="refresh()">&#8635; Refresh</button>
<div class="ce-empty-state-icon">&#128663;</div>

<!-- After -->
<ce-button variant="secondary" size="md" (click)="refresh()">
  <ce-icon name="refresh" [size]="15" /> Refresh
</ce-button>
<ce-icon name="car" [size]="40" aria-hidden="true" />
```
`[VERIFIED: vehicles.page.ts lines 33/51 for before; icon.types.ts confirms 'refresh'/'car' are valid LucideIconName]`

### Pattern 2: Functional contract mirroring (login error/spinner/toast)

**What:** The Angular login page must mirror the mockup contract from `mockup/login.html` + `.specs/2-mockup-functional-fixes/` UC-8..UC-11: submit shows a spinner (`aria-busy="true"`), 401 → inline error + form re-enable, 429 → "Too many attempts" with a cooldown, "multi" email → tenant picker, forgot-password → info toast "Check your email for reset instructions".

**When to use:** UI-02 login form behavior.

**Example (current login already satisfies most of this):**
```typescript
// login.page.ts — real error path + spinner already present
onSubmit(): void {
  if (this.loginForm.invalid) return;
  this.loginError.set(null);
  this.submitting.set(true);            // drives ce-button [loading] → spinner + aria-busy
  this.authService.login(email, password).subscribe({
    next: () => { /* tenant picker if >1, else postLoginRoute() */ },
    error: (err) => { this.submitting.set(false); this.loginError.set(this.extractErrorMessage(err)); },
  });
}
```
`[VERIFIED: login.page.ts onSubmit + ce-button.component.ts loading/aria-busy]`

The **gap**: forgot-password uses an inline success banner (`forgot-success-banner`), not a toast. `[VERIFIED: login.page.ts template]` The mockup uses `data-toast="info" data-toast-msg="Check your email for reset instructions."`. `[VERIFIED: mockup/login.html line 76]`

### Anti-Patterns to Avoid

- **Pixel-matching a nonexistent mockup page:** Do not invent a dashboard/visits/vehicles mockup to match. The contract is the *design-system component gallery* (`showcase.html`) + tokens + `index.html` stat grid. `[VERIFIED: ls mockup/ shows only index/app/showcase/login.html]`
- **Adding new deps to "fix" parity:** Everything needed (`ce-*`, `ce-icon`, `ToastService`) already exists and is exported from `design-system/index.ts`. `[VERIFIED: design-system/index.ts]`
- **Migrating `lucide-angular` → `@lucide/angular`:** Deprecated ≠ broken. It works and is pinned. Migrating ripples across 20+ components with zero user value; defer. `[ASSUMED]`
- **Wiring Playwright into `verify-ci-local.sh` silently:** That would violate the CI-gate policy (stages are locked to the 6 documented stages). Any CI wiring decision is a policy change and must be surfaced to the human, not folded in. `[ASSUMED]`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Icons | Unicode glyph entities (`&#8635;`, `&#43;`, `&#128663;`) | `ce-icon` (Lucide via `lucide-angular`) | Consistent stroke/style across browsers; already the standard. `[VERIFIED: icon.component.ts + mockup-visual-parity UC1]` |
| Toasts | Custom toast state per page | `ToastService` / `CeToastHostComponent` | Auto-dismiss (5s), tone variants, aria-live region already built. `[VERIFIED: toast.component.ts]` |
| Spinners | Hand-rolled `<span class="spinner">` | `ce-button [loading]` + `CeSpinnerComponent` | `ce-button` already emits `aria-busy` + disabled state + spinner. `[VERIFIED: button.component.ts]` |
| Visual regression | Manual `mockup/SMOKE.md` checklist only | Playwright `toHaveScreenshot` (tests/visual) | Automated pixel diff with `maxDiffPixelRatio`; already the showcase pattern. `[VERIFIED: showcase.spec.ts + visual-parity design.md]` |
| Error message parsing | Re-implementing `ProblemDetails` parsing | `getApiErrorMessage()` util | Central RFC 7807 `detail`/`title`/`errors` extraction. `[VERIFIED: api-error.util.ts]` |

**Key insight:** Every deceptively-complex problem this phase touches (icons, toasts, spinners, error mapping, visual diff) already has a first-class building block in `design-system/` or `core/`. The phase's risk is *not* building new infra — it is the discipline of *removing* duplicated/legacy code and *verifying* the existing contract.

## Runtime State Inventory

> **Not a rename/refactor/migration phase.** This phase does not rename any identifier, brand, key, or stored string. It removes stale E2E tests and adopts existing components. No runtime state (databases, OS registrations, env vars, build artifacts) is affected by a rename.

- **Stored data:** None — no identifier or persisted key is renamed. `[VERIFIED: phase scope]`
- **Live service config:** None — no external service string changes.
- **OS-registered state:** None.
- **Secrets/env vars:** None — E2E env vars (`E2E_BASE_URL`, `E2E_ADMIN_EMAIL`, etc.) are read, not renamed. `[VERIFIED: demo-auth.ts + global-setup.ts]`
- **Build artifacts:** None beyond normal rebuild; no package/binary renames.

## Common Pitfalls

### Pitfall 1: Assuming dashboard/visits/vehicles parity has a dedicated mockup to match
**What goes wrong:** A plan task says "match dashboard to `mockup/<page>.html`" and the executor searches for a file that doesn't exist.
**Why it happens:** CONTEXT.md/requirements say "parity to login, dashboard, visits, vehicles" but the `mockup/` folder only contains `index.html` (hub + dashboard-preview grid), `app.html` (Residents), `showcase.html` (component gallery), `login.html`. `[VERIFIED: ls mockup/]`
**How to avoid:** Define parity as *design-system conformance* (component gallery + tokens) for dashboard/visits/vehicles, and *login.html conformance* for login. Cite `showcase.html` and `index.html` stat grid as the visual reference.
**Warning signs:** Tasks referencing `mockup/dashboard.html`, `mockup/visits.html`, etc.

### Pitfall 2: Refreshing E2E against the *current* dashboard, which the spec says no longer has tiles
**What goes wrong:** Executor "fixes" `gatehouse-workflow.spec.ts` by asserting the current dashboard's "Add visit"/"Record access" links, but the spec (TEST-01) explicitly says the spec must *not test removed dashboard buttons/tiles*.
**Why it happens:** The current dashboard has no FAB/tiles ("New entry", "Register entry", "Entry denied", "Gatehouse only", "Override") — those were removed in Phase 17. `[VERIFIED: dashboard.page.ts has only "Add visit"/"Record access" links; gatehouse-workflow.spec.ts tests the removed tiles]`
**How to avoid:** Rewrite the gatehouse spec to target the *current tabbed gatehouse panel* (`/gatehouse` with `qr`/`manual`/`walkin`/`visits` tabs) and drop the tile-based assertions entirely.
**Warning signs:** A plan that "keeps the 4-tile test but updates selectors" — that's the anti-pattern.

### Pitfall 3: Believing E2E/visual/a11y run in CI
**What goes wrong:** A plan says "CI gate will run the visual regression snapshots" — it won't.
**Why it happens:** `verify-ci-local.sh` stages 1–6 are format/build/unit+arch/integration/web-docker/openapi; there is **no** Karma (`ng test`) and **no** Playwright (`npm run e2e`) stage. `[VERIFIED: verify-ci-local.sh stage listing + grep for karma/playwright/ng test]`
**How to avoid:** Plan visual/a11y/E2E as *manual local* verification steps (`npm run e2e` against the Docker stack), not CI-enforced. If CI wiring is desired, it is a separate policy decision for the human.
**Warning signs:** "Wave gate: `npm run e2e` in CI" — needs correction.

### Pitfall 4: Overwriting existing parity work on residents
**What goes wrong:** A task re-does residents-page parity that is already complete (stat tiles, pagination, recent-activity, `ce-icon` all present).
**Why it happens:** The requirement text says "extend parity *beyond* residents" but a naive executor may not realize residents is already done. `[VERIFIED: residents.page.ts imports CeStatTile/CePagination/CeIcon and renders them]`
**How to avoid:** Explicitly scope UI-01 to login/dashboard/visits/vehicles; treat residents as the *reference* implementation to mirror, not rework.

### Pitfall 5: Duplicating CSS cleanup into unrelated pages (scope creep)
**What goes wrong:** The CSS-dedup pattern is needed on 6 pages (visits, vehicles, apartments, service-providers, administration, platform/condominiums) but UI-01 is scoped to 4 (login/dashboard/visits/vehicles).
**Why it happens:** `grep` shows 12 feature files duplicating `ce-*` CSS; the `.specs/mockup-visual-parity/design.md` UC6 lists all six. `[VERIFIED: grep + design.md]`
**How to avoid:** Scope to the 4 locked pages; defer apartments/service-providers/administration/platform to a future continuation (matching CONTEXT.md deferred ideas).

## Code Examples

### Login error path + spinner + show/hide (already correct — reference pattern)

```typescript
// Source: src/app/features/auth/login.page.ts [VERIFIED]
// ce-button [loading] drives spinner + aria-busy="true" + disabled
<ce-button variant="primary" size="lg" type="submit"
        [disabled]="loginForm.invalid || submitting()"
        [loading]="submitting()">
  Sign in
</ce-button>

// ce-input with prefix/suffix slots for user icon + password show/hide
<ce-input label="Password" inputId="login-password"
        [type]="showPassword() ? 'text' : 'password'" ...>
  <button input-suffix type="button" class="password-toggle"
        (click)="showPassword.set(!showPassword())"
        [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'">
    <ce-icon [name]="showPassword() ? 'eye-off' : 'eye'" [size]="16" />
  </button>
</ce-input>
```

### Toast auto-dismiss (already correct — reference pattern)

```typescript
// Source: src/app/design-system/components/toast/toast.component.ts [VERIFIED]
success(message: string, opts?: { duration?: number }): number {
  return this.host?.add({ message, tone: 'success', duration: opts?.duration ?? 5000 }) ?? 0;
}
// CeToastHostComponent.add schedules setTimeout(() => this.dismiss(id), toast.duration)
```

### Visual regression spec (extend this pattern to login/dashboard/visits/vehicles)

```typescript
// Source: src/Web/.../tests/visual/showcase.spec.ts [VERIFIED]
for (const viewport of viewports) {
  for (const theme of themes) {
    test(`showcase-${viewport.name}-${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await loginAsDemoUser(page);
      await page.goto('/design-system/showcase');
      if (theme === 'dark') { await page.selectOption('.theme-switcher select', 'dark'); }
      await expect(page).toHaveScreenshot(`showcase-${viewport.name}-${theme}.png`, {
        maxDiffPixelRatio: 0.001,
      });
    });
  }
}
```

### A11y spec (extend to login/dashboard)

```typescript
// Source: src/Web/.../tests/a11y/showcase.spec.ts [VERIFIED]
const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
  .analyze();
const violations = results.violations.filter(
  v => v.impact === 'serious' || v.impact === 'critical',
);
expect(violations).toHaveLength(0);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Unicode glyphs (`&#8635;` `&#43;` `&#128663;`) for icons | `ce-icon` (Lucide via `lucide-angular`) | v2.0 Phase 08 design-system-hardening | Consistent icons; residents/shell/topbar already migrated. `[VERIFIED]` |
| Hand-written `.ce-*` CSS in every feature page | Import `ce-*` components, delete duplicated CSS | v2.0 `.specs/mockup-visual-parity/` (residents done) | Single visual source of truth; 4 of 6 pages remain. `[VERIFIED: grep]` |
| Dashboard as stat-tile grid (mockup `index.html` preview) | Dashboard as "Shift ledger" (totals + arrival record + handover) | v2.1 Phase 17 | Dashboard diverges from the mockup stat grid — a parity decision to reconcile. `[VERIFIED: dashboard.page.ts]` |
| Gatehouse as FAB + tile buttons | Gatehouse as tabbed panel (QR/manual/walkin/visits) | v2.1 Phase 17 | Makes `gatehouse-workflow.spec.ts` stale. `[VERIFIED]` |
| `lucide-angular` (current) | `@lucide/angular` (successor, 1.48.0) | future | `lucide-angular` is deprecated; migration deferred. `[VERIFIED: npm view + package-legitimacy SUS]` |

**Deprecated/outdated:**
- `lucide-angular`: deprecated on npm; successor is `@lucide/angular`. Still functional + pinned; do NOT migrate this phase. `[VERIFIED: package-legitimacy check verdict SUS/deprecated]`
- Unicode glyph icon entities in feature pages: obsolete, replaced by `ce-icon`.
- `mockup/SMOKE.md` manual-only checklist: superseded as the *only* guard by Playwright `tests/visual/` (though it remains a valid manual smoke).

## Nyquist Validation Coverage State (TEST-02)

The GSD Nyquist contract (`templates/VALIDATION.md`) requires, per phase: `Test Infrastructure` (framework/config/quick+full commands), `Sampling Rate`, `Per-Task Verification Map`, `Wave 0 Requirements`, `Manual-Only Verifications`, and `Validation Sign-Off` with `nyquist_compliant: true` in frontmatter. `[VERIFIED: templates/VALIDATION.md]`

**Current coverage across the repo:**

| Phase set | Phase | Has `*-VALIDATION.md`? | Has `*-VERIFICATION.md`? |
|-----------|-------|------------------------|--------------------------|
| v2.0 | 01–08, 10, v1-11, v1-13 | ✅ yes | ✅ yes |
| v2.0 | 11, 12, 13 | ❌ **no** | ✅ yes (VERIFICATION only) |
| v2.1 | 16, 17, 18 | ❌ **no** (the "3 phases" CONTEXT refers to) | ✅ yes |
| v2.2 | 19, 20, 21, 22 | ❌ **no** (still in research/planning) | ❌ no |

`[VERIFIED: find .planning -name '*-VALIDATION.md' + ls of each phase dir]`

**Interpretation for TEST-02:** v2.1 "left 3 phases without any" = Phases 16, 17, 18 (they shipped with `*-VERIFICATION.md` only). v2.2 must ensure **all four** phases (19, 20, 21, 22) produce a `*-VALIDATION.md`. Phases 19/20/21 are in-flight this same session (only `*-CONTEXT.md` + `*-RESEARCH.md` exist so far), so the Phase 22 plan must:
1. Author `22-VALIDATION.md` for itself (Wave 0 in this phase's plan).
2. Verify (or flag) that 19/20/21 each have a `*-VALIDATION.md` before the milestone closes — a final cross-phase audit task.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Dashboard/visits/vehicles parity means *design-system conformance* (showcase + tokens + index.html stat grid), not pixel-matching a dedicated mockup page. | Standard Stack / Pitfall 1 | Low — `ls mockup/` confirms no such pages exist; but the exact acceptance thresholds are the agent's discretion and need a human check. |
| A2 | UI-02 "forgot-password should show a toast" is a genuine parity gap (current impl uses an inline success banner). | Functional fixes | Medium — the current inline banner is arguably *better* UX; whether to convert to toast is a discretion call, not a hard requirement. |
| A3 | The mockup's fake `fail@x.com` / `ratelimit@x.com` / "multi" email behaviors map to *real* backend behaviors (401 detail, rate-limit 429, tenant picker). | Functional fixes | Medium — the real backend may not implement a 15s rate-limit cooldown; the Angular side should mirror *whatever the backend actually returns*, not the mockup's hardcoded demo. |
| A4 | Playwright/Karma should remain manual-only (not wired into `verify-ci-local.sh`) unless the human approves a policy change. | Pitfall 3 | Medium — the human may actually want E2E in CI; this is a decision, not a given. |
| A5 | `lucide-angular` migration to `@lucide/angular` is out of scope and safe to defer. | Package Legitimacy | Low — the deprecated package still works and is pinned. |
| A6 | Phase 22's own `*-VALIDATION.md` can be authored during planning as a Wave 0 artifact (rather than post-hoc). | Validation coverage | Low — this matches the template's "Wave 0 Requirements" section. |

## Open Questions (RESOLVED)

1. **Visual-parity acceptance thresholds for dashboard/visits/vehicles.**
   - **RESOLVED (plan 22-01, objective "Surface" block):** Parity for dashboard/visits/vehicles = design-system conformance (component/icon + tokens + index.html stat grid); the shipped "Shift ledger" is preserved (no layout redesign) and the ledger-vs-stat-grid divergence is surfaced for a human decision.
   - What we know: `.specs/mockup-visual-parity/design.md` defines parity as "pixel-comparable at 375/768/1440 × light/dark" and prescribes Playwright snapshots with `maxDiffPixelRatio: 0.001` for login/residents/dashboard. `[CITED: design.md]`
   - What's unclear: The current dashboard is a "Shift ledger", not the mockup's stat grid — does "parity" mean *restyle the ledger to match the stat-grid preview*, or *accept the ledger as the shipped product and only ensure component/icon conformance*?
   - Recommendation: Default to **component/icon conformance** (no layout redesign) and surface the dashboard-vs-mockup divergence as a human decision; the plan should not unilaterally redesign the shipped ledger.

2. **Does the real backend implement the mockup's rate-limit (429) and "multi" tenant-picker contract?**
   - **RESOLVED (plan 22-02, objective "Surface" block):** The Angular side mirrors whatever the backend actually returns; no client-side 15s 429 cooldown is invented — if the backend does not emit 429 for login, no cooldown is added. 429 detail (if any) flows through the existing enumeration-safe error path.
   - What we know: The login page already handles `status === 401` → "Invalid email or password." and delegates multi-tenant via `lookupTenants(email).length > 1`. `[VERIFIED: login.page.ts]`
   - What's unclear: Whether a 429 "Too many attempts" path exists server-side and needs a cooldown UI.
   - Recommendation: Mirror backend behavior; do not build a mockup-only cooldown. Verify against the Security module auth endpoint during planning.

3. **Refresh vs. delete for `gatehouse-workflow.spec.ts`.**
   - **RESOLVED (plan 22-03, objective "Scope decision" block):** Refresh. The gatehouse portion is rewritten against the current tabbed panel; the still-valuable audit-review + consent-policy portions are retained in the same spec; only the removed FAB/tile assertions are deleted.
   - What we know: TEST-01 leaves refresh-vs-remove to the agent's discretion; the spec's gatehouse/audit/policy flows are still valuable coverage (audit review, CSV export, consent policy editor all still exist as routes). `[VERIFIED: routes + audit.page.ts + consent-policy-editor.page.ts]`
   - What's unclear: Whether the audit/consent-policy portions should be split into their own spec.
   - Recommendation: Rewrite the gatehouse portion against the tabbed panel, keep/relocate the audit + consent-policy portions (they test still-present UI), and delete the removed-tile assertions.

4. **Whether Phase 22 should also backfill `*-VALIDATION.md` for v2.0 phases 11/12/13.**
   - **RESOLVED (plan 22-04, objective "Scope decision" block):** Out of scope for Phase 22 — TEST-02 is strictly milestone phases 19–22. The audit records 11/12/13 (and 16/17/18) as uncovered as a surfaced note, with backfill deferred as a separate human decision.
   - What we know: TEST-02 scopes to "v2.2 phases (19–22)"; but v2.0 phases 11/12/13 also lack VALIDATION.md. `[VERIFIED: ls v2.0-phases]`
   - What's unclear: Whether the human wants those backfilled too.
   - Recommendation: Out of scope for Phase 22 (deferred/backlog); note in the audit that 11/12/13 remain uncovered.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Angular build/test | ✓ | v22.22.1 (host) | Docker `node:20-slim` for CI stages |
| npm | Angular scripts | ✓ | 10.9.4 | — |
| Docker (daemon) | CI gate + E2E stack | ✓ | 29.8.1 (daemon OK) | — |
| .NET SDK | backend (not touched, but CI) | ✓ | 8.0.131 | Docker `mcr.microsoft.com/dotnet/sdk:8.0` |
| Playwright Chromium | E2E/visual/a11y | ⚠ | not installed (needs `npm run e2e:install`) | install via `playwright install chromium` |
| Running stack (api+web+db) | E2E execution | ⚠ | not confirmed running | `docker compose up` before `npm run e2e` |

**Missing dependencies with no fallback:** none (all toolchains present; Playwright browsers are installed on demand via `e2e:install`).

**Missing dependencies with fallback:** Playwright Chromium (install on demand); a running demo stack (spin up with `docker compose`).

*Step 2.6 audit performed: host has Node 22/npm 10/Docker 29/dotnet 8. The project's CI pins Node 20 inside containers, but local Playwright/E2E can run on host Node 22.* `[VERIFIED: env probe]`

## Validation Architecture

> `nyquist_validation` is `true` in `.planning/config.json`. `[VERIFIED]`

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright `@playwright/test` 1.49 (E2E/visual/a11y) + Jasmine/Karma 6.4 (Angular unit) |
| Config file | `src/Web/ControlEasyReborn.Web/playwright.config.ts` (testDir `.`, match `e2e/**` + `tests/**`); `angular.json` `test` architect (Karma) |
| Quick run command | `cd src/Web/ControlEasyReborn.Web && npx playwright test <spec>` (single spec) |
| Full suite command | `cd src/Web/ControlEasyReborn.Web && npm run e2e` (requires running stack + `npm run e2e:install`) |
| Angular unit | `npm test -- --no-watch --browsers=ChromeHeadless` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-01 | Login/dashboard/visits/vehicles match design-system (component + icon conformance, light/dark) | visual (Playwright snapshot) | `npx playwright test tests/visual/login.spec.ts` | ❌ Wave 0 (only showcase.spec.ts exists) |
| UI-01 | No duplicated `.ce-*` CSS in the 4 target pages | static (grep gate) | `grep -rn '\.ce-button\|\.ce-input' src/app/features/{auth,dashboard,visits,vehicles}/` → zero | ❌ Wave 0 (define as a check) |
| UI-01 | No Unicode glyph icons in the 4 target pages | static (grep gate) | `grep -rn '&#[0-9]\+;' src/app/features/{auth,dashboard,visits,vehicles}/` → zero | ❌ Wave 0 |
| UI-02 | Login 401 → inline error + form re-enabled | unit (Karma) | `npm test -- --no-watch --browsers=ChromeHeadless --include=**/login.page.spec.ts` | ✅ (login.page.spec.ts exists; extend for 401) |
| UI-02 | Login submit spinner `aria-busy` while pending | unit | same as above | ✅ (extend) |
| UI-02 | Toast auto-dismiss (5s) + tone variants | unit | `npm test -- --include=**/toast.component.spec.ts` | ✅ (toast.component.spec.ts exists) |
| UI-02 | Forgot-password surfaces info toast (parity) | unit | `npm test -- --include=**/login.page.spec.ts` | ❌ Wave 0 (new assertion) |
| TEST-01 | E2E reflects current gatehouse panel (no removed tiles) | E2E | `npx playwright test e2e/gatehouse-workflow.spec.ts` | ❌ Wave 0 (rewrite) |
| TEST-01 | Module-page E2E labels match current headings/buttons | E2E | `npx playwright test e2e/module-pages.spec.ts` | ❌ Wave 0 (fix stale labels) |
| TEST-02 | `22-VALIDATION.md` authored + `nyquist_compliant: true` | process artifact | n/a (file authored in planning) | ❌ Wave 0 |
| TEST-02 | 19/20/21 each have `*-VALIDATION.md` before milestone close | audit | `find .planning/phases -name '*-VALIDATION.md'` | ❌ Wave 0 (cross-phase audit) |

### Sampling Rate

- **Per task commit:** `./scripts/verify-ci-local.sh --fast` (format + build + unit/arch — mandated by AGENTS.md). Angular unit via `npm test -- --no-watch --browsers=ChromeHeadless` for parity tasks.
- **Per wave merge:** full `./scripts/verify-ci-local.sh` + `npm run e2e` (visual/a11y/E2E) against the running Docker stack.
- **Phase gate:** full suite green before `/gsd-verify-work`; `22-VALIDATION.md` `nyquist_compliant: true`.

### Wave 0 Gaps

- [ ] `tests/visual/login.spec.ts` — Playwright snapshots of `/login` (375/1440 × light/dark)
- [ ] `tests/visual/dashboard.spec.ts` — snapshots of `/` dashboard (component conformance)
- [ ] `tests/visual/visits.spec.ts` + `tests/visual/vehicles.spec.ts` — component conformance snapshots (or a combined `feature-pages.spec.ts`)
- [ ] `tests/a11y/login.spec.ts` + `tests/a11y/dashboard.spec.ts` — Axe scans of login + dashboard
- [ ] `e2e/gatehouse-workflow.spec.ts` — rewrite against current tabbed panel (remove tile assertions)
- [ ] `e2e/module-pages.spec.ts` — fix stale headings/labels (visits → "Visit register (administrative)" / "+ Pre-register visit", service-providers → "Add provider")
- [ ] `login.page.spec.ts` — extend for 401 inline-error path + forgot-password toast parity
- [ ] `22-VALIDATION.md` — author per `templates/VALIDATION.md`
- [ ] Framework install note: Playwright Chromium via `npm run e2e:install` (not pre-installed)

## Security Domain

> `security_enforcement` is not explicitly disabled; default is enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Login error paths must be enumeration-safe; the current impl returns generic 401 "Invalid email or password." via `extractErrorMessage`. `[VERIFIED: login.page.ts]` Parity work must NOT regress to specific "user not found" messages. |
| V3 Session Management | yes (login/tenant-picker) | Tenant switch via `switchTenant(tenantId)`; `Remember me` persists email only, not credentials. `[VERIFIED: login.page.ts + auth.service]` |
| V4 Access Control | yes | Gatehouse `/gatehouse` behind `porteiroGuard`; audit behind `syndicGuard`; consent-policy behind `tenantAdminGuard`. E2E rewrite must keep role-gated assertions. `[VERIFIED: app.routes.ts]` |
| V5 Input Validation | yes | `ce-input` + Angular `Validators` (required/email/minLength 6); error display via `[error]` input. `[VERIFIED: login.page.ts + input.component.ts]` |
| V6 Cryptography | no (no crypto in scope) | Password hashing is backend (BCrypt ≥ 11); not touched. |

### Known Threat Patterns for Angular + Playwright parity phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Enumeration via login error specificity | Information disclosure | Keep generic 401 message; never surface "email not found" vs "wrong password". `[VERIFIED: extractErrorMessage status===401]` |
| Leaking real PII into visual snapshots | Information disclosure | Synthetic test data only (AGENTS.md) — snapshots/E2E must use demo seed accounts (`admin@controleasy.app` / `demo123`), not real names/docs. `[VERIFIED: AGENTS.md + demo-auth.ts]` |
| Stale E2E masking real regressions | Tampering (test integrity) | Rewrite/remove stale specs so the suite reflects shipped UI; otherwise green E2E is false confidence. |
| Auto-dismiss toast hiding error detail | Information availability | Keep error toasts at 8s (`error()` default 8000ms) and success/info at 5s. `[VERIFIED: toast.component.ts durations]` |

## Sources

### Primary (HIGH confidence — direct observation this session)

- `grep`/`read` of `src/Web/ControlEasyReborn.Web/src/app/features/*.page.ts` (login, dashboard, visits, vehicles, reports, gatehouse-panel), `design-system/` components (icon, toast, button, input, spinner), `app.routes.ts`, `design-system/index.ts`. `[VERIFIED: codebase]`
- `read` of `e2e/gatehouse-workflow.spec.ts`, `e2e/module-pages.spec.ts`, `e2e/global-setup.ts`, `e2e/helpers/demo-auth.ts`, `tests/visual/showcase.spec.ts`, `tests/a11y/showcase.spec.ts`, `playwright.config.ts`. `[VERIFIED: codebase]`
- `read` of `scripts/verify-ci-local.sh` (stages 1–6; no Karma/Playwright). `[VERIFIED: codebase]`
- `read` of `.planning/milestones/v2.2-REQUIREMENTS.md`, `ROADMAP.md`, `.planning/codebase/{STACK,TESTING,STRUCTURE,CONVENTIONS}.md`, `22-CONTEXT.md`. `[VERIFIED: repo]`
- `read` of `.specs/mockup-visual-parity/{requirements,design}.md`, `.specs/2-mockup-functional-fixes/{requirements,design}.md`. `[CITED]`
- `read` of `/home/reisfelipe18/.config/opencode/gsd-core/templates/VALIDATION.md`. `[VERIFIED: GSD template]`
- `read` of `mockup/{index,app,showcase,login}.html`, `mockup/SMOKE.md`. `[VERIFIED: repo]`
- `find .planning -name '*-VALIDATION.md'` + per-phase `ls` for coverage state. `[VERIFIED: repo]`

### Secondary (MEDIUM confidence)

- `npm view` version checks for `lucide-angular`, `@lucide/angular`, `@playwright/test`, `@axe-core/playwright`, `karma`, `jasmine-core`. `[VERIFIED: npm registry]`
- `gsd-tools query package-legitimacy check` for `lucide-angular` (SUS/deprecated), `@playwright/test` (OK), `@axe-core/playwright` (OK). `[VERIFIED: npm registry + seam]`

### Tertiary (LOW confidence — training knowledge)

- `@lucide/angular` as the successor home of the Lucide Angular wrapper (registry `deprecated` flag + package name inference). `[ASSUMED]`
- Whether the real backend implements a 429 rate-limit cooldown matching the mockup's demo behavior. `[ASSUMED]`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages verified against npm registry + package.json this session.
- Architecture: HIGH — component/file structure read directly from the codebase.
- Pitfalls: HIGH — each pitfall grounded in a specific `grep`/`read` observation.
- Functional-fix gap analysis: MEDIUM — current login/toast behavior verified; the "gap" interpretation (forgot-password toast, rate-limit contract) carries assumptions.

**Research date:** 2026-09-24
**Valid until:** 2026-10-24 (30 days — stable stack; note Playwright/axe minor-version drift is fast-moving)
