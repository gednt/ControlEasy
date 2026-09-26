# Phase 22 Plan 02 — SUMMARY

**Plan:** 22-02 — Forgot-password toast parity + login 401/busy unit tests (UI-02)
**Status:** ✅ complete

## What shipped

### Login page (UI-02 forgot-password toast parity)

`src/Web/ControlEasyReborn.Web/src/app/features/auth/login.page.ts`
- `ToastService` imported from the design-system barrel and injected (`private readonly toast = inject(ToastService)`).
- Removed the `forgotPasswordMessage` signal and the `.forgot-success-banner` template block + CSS. The modal now renders the email input directly (no success-state UI); success is signalled app-wide through the toast.
- `onForgotPasswordSubmit()` on `next: (res)` calls `this.toast.info(res.message)` and then `this.closeForgotPassword()` — the toast auto-dismisses at 5s (ToastService info-tone convention), aria-live announces it, and the user is back at the sign-in screen.
- Removed the orphaned `.forgot-success-banner` style block.
- Preserved unchanged: the 401/429 enumeration-safe error path (`extractErrorMessage` still returns generic "Invalid email or password." / 429 `detail`); submit spinner via `ce-button [loading]` + `aria-busy`; password show/hide; tenant picker; demo/bootstrap accounts. No client-side 15s cooldown invented (the Angular side mirrors whatever the backend actually returns).
- Preserved `extractErrorMessage` enumeration-safety: 401 still returns generic "Invalid email or password." (T-22-01 mitigation stays in force).

### Login spec (UI-02 unit-test coverage)

`src/Web/ControlEasyReborn.Web/src/app/features/auth/login.page.spec.ts`
- Added `ToastService` to the TestBed providers (jasmine spy with `info`, `success`, `warning`, `error`).
- Updated `closeForgotPassword` test to assert `forgotPasswordError` is cleared (no longer checks `forgotPasswordMessage`).
- Updated the success-path test to assert `toastSpy.info` was called with `res.message` and the modal is closed (not the inline banner).
- New test: `onSubmit should set loginError and re-enable form on 401 (enumeration-safe)` — stubs `login` to throw 401 with `detail: 'Invalid email or password.'`; asserts `loginError()` equals the detail and `submitting()` is false.
- New test: `onSubmit should keep submitting=true while the login request is pending` — stubs `login` to return a `Subject<never>`; asserts `submitting()` is true until the subject completes (no flaky `setTimeout`).
- Synthetic test data only (`admin@condoeasy.com`, `demo123`); no real credentials or PII.

## Verification

- `npx ng test --no-watch --browsers=ChromeHeadlessNoSandbox --include='**/login.page.spec.ts'` → **7/7 SUCCESS** (3 prior + 2 modified + 2 new).
- Static regression guard: `extractErrorMessage` still routes `status === 401` to "Invalid email or password."; no "user not found" or "wrong password" specificity introduced anywhere.
- `./scripts/verify-ci-local.ps1 -Fast` → PASS.

## Decision (mirrors 22-RESEARCH.md Assumptions A2 + A3)

(1) The current inline success banner is arguably better UX; converting it to a toast is a parity call, and the plan converts to the toast (the locked mockup contract) while keeping the form-closing behavior the user expects.
(2) The mockup's fake `ratelimit@x.com` 15-second 429 cooldown may NOT map to a real backend behavior — the Angular side mirrors whatever the backend actually returns; no client-side 15s cooldown is invented; 429 detail (if the backend emits one) flows through the existing enumeration-safe error path.