---
phase: 20-account-operations-consent-audit-ui
plan: 03
type: execute
wave: 1
status: complete
---

# Phase 20 Plan 03 — Summary

## Scope

CONSU-01 (porteiro filter end-to-end): thread a `porteiro` parameter through the
entry-log read path (list + CSV export) and surface a porteiro dropdown in the
existing `ce-audit-filters` component.

## Truths Delivered

- `GET /api/v1/entry-log?porteiro=<AttendantProfile.Id>` returns only the rows
  with that `PerformedByProfileId` — the key space is the AttendantProfile.Id
  (never User.Id, which would silently miss every row).
- `GET /api/v1/entry-log/export?porteiro=<id>` honors the same porteiro filter
  — a filtered-list export that ignores the filter would be a correctness bug,
  so list and export share the same plumbing.
- `AuditFilters.porteiro?: string` is sent as a query param on both
  `EntryLogService.list()` and `EntryLogService.export()` deterministically.
- The audit filter UI exposes a porteiro dropdown keyed on `AttendantProfile.Id`
  (the consumer passes the staff list from Plan 20-01, mapped through
  `PorteiroOption = { profileId, displayName }`).

## Artifacts Touched

### Backend

- `src/Modules/Photos/.../Abstractions/IPhotoRepository.cs` —
  `IConsentAuditLogRepository.ListAsync` signature gains `Guid? porteiro`.
- `src/Modules/Photos/.../Infrastructure/Persistence/ConsentAuditLogRepository.cs`
  — parameterized `PerformedByProfileId = @param{n}` WHERE clause (no string
  concatenation). Tenant isolation from `ITenantAwareLinqFactory` untouched.
- `src/Modules/Photos/.../Application/Handlers/EntryLogHandlers.cs` —
  `ListEntryLogsHandler` forwards `porteiro`.
- `src/Modules/Photos/.../Application/Handlers/ExportEntryLogCsvHandler.cs` —
  `ExportEntryLogCsvHandler` forwards `porteiro` (CSV ms precision already
  shipped via `InvariantCulture` `yyyy-MM-dd HH:mm:ss.fff`).
- `src/Modules/Photos/.../Api/Endpoints/EntryLogEndpoints.cs` — both endpoints
  accept `Guid? porteiro` and forward it.

### Frontend

- `src/Web/.../features/entry-log/entry-log.service.ts` — `porteiro?: string`
  on `AuditFilters`; threaded into both `list()` and `export()`.
- `src/Web/.../design-system/components/audit-filters/audit-filters.component.ts`
  — exports `PorteiroOption` type; gains `porteiros` input signal; renders
  porteiro dropdown with "All porteiros" placeholder; emits `{ porteiro, skip: 0 }`
  on change; `reset()` clears porteiro via the existing `{ skip, take }` emit.

## Tests Added / Updated

- `tests/IntegrationTests/EntryLogEndpointTests.cs` — extended `SeedEntryAsync`
  to take `performedByProfileId`. New tests:
  - `List_WithPorteiroFilter_ReturnsOnlyMatchingProfileRows`
  - `List_WithPorteiroFilterMatchingNothing_ReturnsEmpty`
  - `ExportCsv_WithPorteiroFilter_ReturnsOnlyMatchingProfileRows`
- `tests/UnitTests/Modules/Photos/EntryLogHandlersTests.cs` — updated
  `ListAsync` mock signature to include `null` for the new `porteiro` parameter.
- `tests/UnitTests/Modules/Photos/ExportEntryLogCsvHandlerTests.cs` —
  updated `ListAsync` mock signature.
- `tests/Web/.../audit-filters/audit-filters.component.spec.ts` — assert 3
  dropdowns (category, state, porteiro); porteiro emits `profileId` and
  resets `skip` to 0; "All porteiros" emits `undefined`.

## Test Results (post-change)

- Unit: 255 / 255 passed
- Architecture: 20 / 20 passed
- Fast CI gate: green
- Angular build: clean

## Notes for Downstream Plans

- The `porteiro` query param value is an **AttendantProfile.Id**, not a User.Id.
  Plan 20-04's audit page should key its name map on `StaffMemberResponse.ProfileId`
  — never on `p.userId`.
- The dropdown's value type is `string` (UUID); no GUID parsing happens
  client-side.