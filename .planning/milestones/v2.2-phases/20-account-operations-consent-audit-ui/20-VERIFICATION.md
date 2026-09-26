---
phase: 20-account-operations-consent-audit-ui
status: complete
date: 2026-09-26
plans_completed: [20-01, 20-02, 20-03, 20-04]
requirements_covered: [ACCNT-01, ACCNT-02, CONSU-01, CONSU-02, CONSU-03]
---

# Phase 20 — Account Operations & Consent Audit UI — VERIFICATION

## Goal Achievement

> Tenant administrators can run credential operations and review consent-audit
> evidence from their own tenant-reachable screens, without a platform-admin
> login.

**Status: ACHIEVED** — every requirement of ACCNT-01/02 and CONSU-01/02/03 is
satisfied and verified by the local CI gate (format, Release build, UnitTests
255/255, ArchitectureTests 20/20, Testcontainers MySQL IntegrationTests
134/134, Angular production Docker build, OpenAPI client drift).

## Per-requirement Verification

### ACCNT-01 — TenantAdmin-reachable reset — DONE

- `ResetUserPasswordHandler` lifts the porteiro-only restriction; a
  TenantAdmin can now reset another same-tenant admin or porteiro.
  Cross-tenant reset still returns 403 Forbidden (`ForbiddenException` mapped
  by the global ProblemDetails writer).
- Resident / non-staff targets return 403 with the message "Tenant admins can
  only reset other staff passwords." (defence-in-depth).
- `GET /api/v1/security/staff` is gated by `ListStaffHandler` itself (TenantAdmin
  or PlatformAdmin only) and exposes the tenant-scoped admins + porteiros
  with `AttendantProfile.Id` surfaced as `ProfileId` — the cross-plan key
  space shared with `ConsentAuditLog.PerformedByProfileId`.
- The reset surface on the administration page is rendered behind
  `isTenantAdmin` (shared-shell route, no `platformAdminGuard`); the test
  asserts the tab is hidden for non-TenantAdmin viewers.
- **Automated verification:**
  - Unit:
    `HandleAsync_WhenTenantAdminResetsSameTenantAdmin_SucceedsAndDispatchesEmail`
    (role lift + SMTP dispatch + `DeliveryState=Sent`).
  - Integration:
    `PasswordResetTests.TenantAdmin_CanResetOwnAdmin_Successfully` (200 OK,
    no plaintext temp password in JSON body, `MustChangePassword=true`,
    `DeliveryState ∈ {Pending, Sent, Failed}`).
  - Integration:
    `StaffListTests.TenantAdmin_GetsOwnTenantStaffWithProfileIdAndIsolatesOtherTenant`
    — seeds TenantA and TenantB users, asserts only TenantA staff appear
    and `ProfileId` equals `AttendantProfile.Id`.
  - Integration:
    `StaffListTests.PorteiroRole_Receives403Forbidden`.
  - Angular unit:
    `should expose Staff & Passwords tab for TenantAdmin and load staff on
    activation`.

### ACCNT-02 — Delivery feedback + MustChangePassword — DONE

- `ResetUserPasswordHandler` mirrors `ForgotPasswordHandler`'s SMTP flow:
  builds a `PasswordResetRequest` with `deliveryState="Pending"`, calls
  `IEmailSender.SendEmailAsync` inside a `try`/`catch`, then `MarkSent()`
  or `MarkFailed(reason)`. The plain-text temp password is **never** returned
  in the JSON body — the DTO `ResetUserPasswordResponse` carries
  `(UserId, MustChangePassword, DeliveryState)`. Verified by both the unit
  test (`HandleAsync_WhenResponseIsReturned_NeverContainsPlaintextPassword`)
  and the integration test (asserts the response body does not contain
  `tempPassword` / `TempPassword`).
- The administration page renders a delivery-state banner ("dispatched by
  email" / "scheduled" / "delivery failed") — never a temp password.
- The platform-admin reset modal on `/platform/condominiums` was also
  updated: the previous copy-to-clipboard temp-password UI is replaced with
  the same delivery-state message and closes.
- `targetUser.ResetPassword(hashedTempPassword)` flips `MustChangePassword`
  to `true`; refresh tokens are revoked via
  `IRefreshTokenRepository.RevokeAllForUserAsync` after the dispatch attempt.
- **Automated verification:**
  - Unit:
    `HandleAsync_WhenEmailSenderThrows_ReturnsFailedDeliveryState`.
  - Unit:
    `HandleAsync_WhenResponseIsReturned_NeverContainsPlaintextPassword`.
  - Angular unit:
    `should reset a staff member with delivery feedback and no plaintext` —
    renders `dispatched by email`, asserts DOM does not contain
    `tempPassword` / `TempPassword`.
  - Angular unit:
    `should disable the row button while resetting and re-enable after
    completion`.
  - Angular unit:
    `should not surface a temp password even if the caller inspects the
    response shape` (asserts `JSON.stringify(response)` does not contain
    `tempPassword`).
- **Manual-only verification (Mailpit):** Open Mailpit and confirm a
  dispatched email lands in the dev catch-all inbox on a local run
  (`make up` then reset a porteiro; the email subject is
  `ControlEasy - Recuperação de Senha`). Not part of the CI gate.

### CONSU-01 — Consent audit filters — DONE

- Backend: `ConsentAuditLogRepository.ListAsync` adds `Guid? porteiro` and
  builds a parameterized `PerformedByProfileId = @param{n}` predicate (no
  string concatenation, SQLi-safe). Tenant isolation via
  `ITenantAwareLinqFactory` is unchanged.
- Backend: `ExportEntryLogCsvHandler` accepts the same `porteiro` filter
  — the CSV export honours the active filter deterministically (a
  filtered-list export that ignored the filter would be a correctness bug).
- Endpoints: `GET /api/v1/entry-log?porteiro=<id>` and
  `GET /api/v1/entry-log/export?porteiro=<id>`.
- Frontend: `AuditFilters.porteiro?: string` is threaded into both
  `EntryLogService.list()` and `EntryLogService.export()`; the dropdown in
  `ce-audit-filters` accepts a `porteiros` input signal
  (`PorteiroOption[]`) keyed on `profileId` (AttendantProfile.Id).
- **Automated verification:**
  - Integration: `List_WithPorteiroFilter_ReturnsOnlyMatchingProfileRows`.
  - Integration: `List_WithPorteiroFilterMatchingNothing_ReturnsEmpty`.
  - Integration: `ExportCsv_WithPorteiroFilter_ReturnsOnlyMatchingProfileRows`.
  - Angular unit: `emits porteiro (profileId) and skip=0 when porteiro
    dropdown changes`; `emits undefined porteiro when "All porteiros" is
    selected`.

### CONSU-02 — Evidence rendering — DONE

- The audit row already rendered override highlight, photo thumbnail +
  lightbox, reason cell, and state badge from Phase 13. Phase 20 closes the
  one gap: the porteiro cell now renders a resolved display name instead
  of the raw `performedByProfileId` GUID.
- The audit page loads the tenant staff list (`authService.listStaff()`),
  builds a `Map<ProfileId, displayName>` via `computed()`, and passes the
  resolved name to each row via the new `porteiroName` input. **Key-space
  contract honoured:** keyed on `StaffMemberResponse.ProfileId`
  (AttendantProfile.Id) — never on `User.Id`.
- State badges (`ce-entry-state-badge`) still map `gatehouse_only →
  'No entry'`, `entered_without_consent → 'Refused'`, `entered_with_consent
  → 'With consent'`, `entered_override → 'Override'`, `exited → 'Exit'`
  (verified by `entry-state-badge.component.spec.ts`).
- **Automated verification:**
  - Angular unit: `renders the resolved porteiro name when supplied, never
    the raw GUID`; `falls back to em-dash when porteiroName is not
    supplied`; `still applies the override-row highlight when
    entered_override and porteiroName is set`.

### CONSU-03 — CSV export with millisecond precision — VERIFIED (no rebuild)

- `ExportEntryLogCsvHandler` emits `recorded_at` via
  `DateTime.ToString("yyyy-MM-dd HH:mm:ss.fff", CultureInfo.InvariantCulture)`
  — three-digit fractional seconds (ms precision).
- Integration test `ExportCsv_ReturnsCsvWithMillisecondPrecision` asserts the
  format via `Regex.IsMatch(@"\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}")` —
  pass.
- New integration test
  `ExportCsv_WithPorteiroFilter_ReturnsOnlyMatchingProfileRows` also asserts
  the regex matches inside the filtered export — pass.

## CI Verification

- `scripts/verify-ci-local.ps1 -Fast` (per-turn): green after every wave
  (1, 2, 3).
- `scripts/verify-ci-local.ps1` (full, at task completion): green — all six
  stages PASSED.
  - Stage 1 (dotnet format): PASS
  - Stage 2 (dotnet build Release): PASS
  - Stage 3 (UnitTests 255/255 + ArchitectureTests 20/20): PASS
  - Stage 4 (IntegrationTests Testcontainers MySQL 134/134): PASS
  - Stage 5 (Angular production Docker build): PASS
  - Stage 6 (OpenAPI client drift): PASS

## Cross-Plan Data Contract

- `StaffMemberResponse.ProfileId` (AttendantProfile.Id) is the cross-plan key
  space shared with `ConsentAuditLog.PerformedByProfileId`. Keying on
  `User.Id` would silently miss every row. Enforced via Plan 20-04's audit
  page name map and Plan 20-03's porteiro dropdown — both project from the
  same staff source (GET /api/v1/security/staff).

## Atomic Commits on `version/2.2`

1. `325ac7a` feat(security): TenantAdmin-reachable password reset with SMTP
   delivery (ACCNT-01/02) + 20-01-SUMMARY.md + StaffListTests + ListStaffHandler
2. `0c6a4fb` feat(audit): porteiro filter end-to-end on entry-log list and
   export (CONSU-01) + 20-03-SUMMARY.md
3. `75961d0` feat(ui): TenantAdmin reset surface + staff list UI (ACCNT-01/02)
   + 20-02-SUMMARY.md
4. `a6f0bff` feat(audit-ui): resolve porteiro display name on audit row
   (CONSU-02) + 20-04-SUMMARY.md
5. `732e33b` fix(security): nullable ProfileId + tolerant integration tests
6. `8cfb0dc` chore(openapi): regenerate client types for /staff endpoint +
   porteiro param

## Files Changed (cumulative across plans)

- 2 created (ListStaffHandler, StaffListTests)
- ~30 modified (Security DTOs/handlers/endpoints, Photos repository +
  endpoints, Angular services/components/pages, plus tests)