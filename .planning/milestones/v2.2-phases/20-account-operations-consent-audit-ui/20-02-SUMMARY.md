---
phase: 20-account-operations-consent-audit-ui
plan: 02
type: execute
wave: 2
status: complete
---

# Phase 20 Plan 02 — Summary

## Scope

ACCNT-01/02 frontend: TenantAdmin-reachable reset surface on the existing
administration page (shared-shell route, no `platformAdminGuard`); new staff-list
DTO; transport for the no-plaintext reset response; the platform-admin reset
modal no longer surfaces the temp password.

## Truths Delivered

- A TenantAdmin sees a "Staff & Passwords" tab on `/administration` listing
  admins + porteiros fetched from `GET /api/v1/security/staff`.
- Triggering reset on a row calls `authService.resetUserPassword(userId)`; on
  success the page shows a delivery-feedback message ("dispatched by email" /
  "delivery failed" / "scheduled") — never a temp password.
- The "Staff & Passwords" tab is hidden for non-TenantAdmin viewers (rendered
  behind `@if (isTenantAdmin())` on the shared-shell route). Server-side
  authorization remains the source of truth.
- `SecurityApiService.resetUserPassword()` response type no longer carries a
  `tempPassword` field; `AuthService.resetUserPassword()` continues to re-export
  the new shape.
- The platform-admin reset modal (`/platform/condominiums`) no longer renders
  the temp password or offers a copy-to-clipboard action; it shows a
  delivery-state message and closes.

## Artifacts Touched

### Core services

- `src/Web/.../core/services/security-api.service.ts` —
  `ResetUserPasswordResponse` reshaped (drops `tempPassword`, adds
  `deliveryState`); `StaffMemberResponse` added; `listStaff()` method added.
- `src/Web/.../core/services/auth.service.ts` — re-exports `StaffMemberResponse`;
  `listStaff()` delegates to `SecurityApiService`.

### Pages

- `src/Web/.../features/administration/administration.page.ts` — injects
  `AuthService`; new signals `staff`, `staffLoading`, `staffLoadError`,
  `resettingUserId`, `resetFeedback`; new "Staff & Passwords" tab gated by
  `isTenantAdmin`; new `loadStaff()` + `onResetPassword(member)` methods;
  `setTab('staff')` is force-redirected to `'settings'` for non-TenantAdmin
  callers; existing settings/audit tabs unchanged.
- `src/Web/.../features/platform/condominiums.page.ts` — replaces the
  temp-password copy modal with a delivery-state message; drops
  `resetResultPassword` and `passwordCopied` signals in favor of
  `resetResultMessage` + `resetResultDeliveryState`.

### Tests

- `src/Web/.../features/administration/administration.page.spec.ts` — extends
  with `AuthService` mock; new tests:
  - Staff & Passwords tab renders for TenantAdmin; loads staff on activation
  - Reset invokes `resetUserPassword(userId)`; renders delivery feedback; no
    plaintext in the rendered DOM
  - Button disabled while resetting; re-enabled after completion
  - Tab hidden when `isTenantAdmin` is false
  - Response shape never contains `tempPassword`
- `src/Web/.../features/platform/condominiums.page.spec.ts` — replaces
  `resetResultPassword` assertions with `resetResultMessage` /
  `resetResultDeliveryState`; adds a `Failed` delivery-state assertion.

## Test Results

- Angular build: clean
- TypeScript: strict, 0 errors
- Backend unit + arch tests: green
- Fast CI gate: green

## Notes for Downstream Plans

- The `AuthService` mock in the administration page spec uses `signal` directly
  to simulate role changes; if Plan 20-04 needs the audit page to share the
  same staff source, use `authService.listStaff()` from a page-level signal.
- The platform-admin reset modal will now look identical to the TenantAdmin
  feedback banner on the administration page — both render the delivery state
  and never a temp password.