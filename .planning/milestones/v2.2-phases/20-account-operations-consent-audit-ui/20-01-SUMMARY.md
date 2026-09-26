---
phase: 20-account-operations-consent-audit-ui
plan: 01
type: execute
wave: 1
status: complete
---

# Phase 20 Plan 01 — Summary

## Scope

Security-module backend deltas for ACCNT-01 (TenantAdmin-reachable reset) and
ACCNT-02 (SMTP delivery + `MustChangePassword`), plus a new tenant-scoped staff
list endpoint that the TenantAdmin reset UI consumes.

## Truths Delivered

- A TenantAdmin can reset another admin's or porteiro's password within the same
  tenant (porteiro-only restriction lifted).
- The temp password is dispatched by `IEmailSender` (mirrors `ForgotPasswordHandler`'s
  SMTP pattern); no plaintext is returned in the JSON response body.
- The reset response carries `deliveryState` (`Sent`/`Failed`/`Pending`) so the UI
  can render delivery feedback.
- Cross-tenant reset attempts still return 403 Forbidden (PASS-02).
- The same-tenant non-staff role (e.g. Resident) returns 403 — TenantAdmin can only
  reset other staff (TenantAdmin or Porteiro).
- `GET /api/v1/security/staff` returns tenant-scoped admins + porteiros with
  `AttendantProfile.Id` exposed as `ProfileId` (the same key space as
  `ConsentAuditLog.PerformedByProfileId`, never `User.Id`).
- The staff list endpoint is guarded by the handler (TenantAdmin/PlatformAdmin
  only); non-staff callers receive 403.
- `UserRepository.ListByTenantAsync` carries a load-bearing
  `TenantId = @param0` predicate — the Users table sits outside the
  `TenantFilterInterceptor` so the predicate is the only tenant isolation.

## Artifacts Touched

- `src/Modules/Security/.../Contracts/SecurityDtos.cs` — `ResetUserPasswordResponse`
  replaced (no `TempPassword`; adds `DeliveryState`) and `StaffMemberResponse`
  added.
- `src/Modules/Security/.../Handlers/ResetUserPasswordHandler.cs` — role lift +
  `IEmailSender` injection + try/catch dispatch + `MarkSent`/`MarkFailed` flow
  (mirrors `ForgotPasswordHandler`).
- `src/Modules/Security/.../Handlers/ListStaffHandler.cs` — new sealed handler
  with TenantAdmin/PlatformAdmin guard + `AttendantProfile.Id → StaffMemberResponse.ProfileId` join.
- `src/Modules/Security/.../Abstractions/IUserRepository.cs` —
  `ListByTenantAsync(tenantId, ct)` added.
- `src/Modules/Security/.../Infrastructure/Persistence/UserRepository.cs` —
  `ListByTenantAsync` + `MapList` helper.
- `src/Modules/Security/.../Api/Endpoints/SecurityEndpoints.cs` —
  `GET /staff` endpoint + DI for `ListStaffHandler`.
- `src/Modules/Security/.../DI/SecurityModuleServiceCollectionExtensions.cs` —
  registers `ListStaffHandler` as scoped.

## Tests Added / Updated

- `tests/UnitTests/Modules/Security/ResetUserPasswordHandlerTests.cs` —
  expanded to 9 tests (same-tenant admin success, SMTP `Sent`/`Failed`,
  no-plaintext-in-response assertion, Resident 403, cross-tenant 403).
- `tests/IntegrationTests/Security/PasswordResetTests.cs` — replaced the
  non-porteiro 403 case with a same-tenant admin success case (asserts
  `MustChangePassword=true`, `DeliveryState=Sent`, no `tempPassword` in
  response body); Resident 403 added.
- `tests/IntegrationTests/Security/StaffListTests.cs` — NEW: tenant isolation,
  cross-tenant non-leak, role gate (Porteiro 403, unauth 401).

## Test Results (post-change)

- Unit: 255 / 255 passed
- Architecture: 20 / 20 passed
- Fast CI gate: green

## Notes for Downstream Plans

- `StaffMemberResponse.ProfileId` (AttendantProfile.Id) is the cross-plan key
  space that Plans 20-03 (porteiro filter dropdown) and 20-04 (porteiro name
  resolution in the audit row) key on. **Never** map by `User.Id`.
- `ResetUserPasswordResponse.deliveryState` is a string enum-ish value
  (`Pending`/`Sent`/`Failed`); clients should render it verbatim.
- `GetSession` returns `ProfileId` for the caller. The `IEmailSender.SendEmailAsync`
  contract has not changed.
- The platform-admin `/platform/condominiums` reset modal previously showed the
  plaintext temp password; that surface is updated in Plan 20-02 to use the
  delivery-state feedback only.