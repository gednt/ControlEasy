---
phase: 16
plan: 02
subsystem: AccessControl
tags: [package-drop, access-events, gatehouse, d-04]
requires:
  - AccessEventKind (from 16-01)
  - AccessEvents EventKind/PackageDescription/PackageCarrierCode columns (from 16-01 migration 14)
provides:
  - POST /api/v1/access-events/manual with kind=package-drop (apartment-bound and condominium-level)
  - RecordManualAccessCommand.Kind/PackageDescription/PackageCarrierCode
  - AccessEventRepository round-trip of package columns
affects:
  - 16-03 (ledger branch reads EventKind=PackageDrop rows with carrierCode/description filters)
tech-stack:
  added: []
  patterns:
    - package drops as AccessEvents directly (never VisitorArrivalHandler / never Visit rows) per D-04
    - server-side apartment re-resolution before snapshot recording (anti-spoofing)
key-files:
  created:
    - tests/ControlEasyReborn.IntegrationTests/AccessControl/PackageDropEndpointTests.cs
  modified:
    - src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Commands/AccessControlCommands.cs
    - src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Handlers/RecordManualAccessHandler.cs
    - src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Handlers/AccessEventDestinationResolver.cs
    - src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Validators/AccessControlValidators.cs
    - src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Infrastructure/Persistence/AccessEventRepository.cs
    - src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Api/Endpoints/AccessEventsEndpoints.cs
    - src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Contracts/AccessControlDtos.cs
decisions:
  - "SubjectType=Visitor with SubjectId=Guid.Empty for package rows (packages have no subject); documented in handler XML docs"
  - "Condominium-level drops: DestinationApartmentId Guid.Empty + GATEHOUSE/RECEPTION snapshot (DestinationApartmentId NOT NULL preserved)"
  - "Carrier code free-form string (no lookup table/enum this phase) per D-04 — Phase 17 UI dropdown only"
  - "Validation rejects package fields on kind=access to prevent contract pollution"
metrics:
  duration: ~25 min
  completed: 2026-09-19
status: complete
actuals:
  tasks: 2
  commits: 3
---

# Phase 16 Plan 02: Package Drops as AccessEvents Summary

Package deliveries are recorded as AccessEvents PackageDrop rows — description + carrier code + optional destination apartment — through the existing gatehouse registration path, with no Visit row (D-04).

## Completed Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Package-drop write path (command/handler/validator/repository) | 49f0de9 | AccessControlCommands.cs, RecordManualAccessHandler.cs, AccessControlValidators.cs, AccessEventRepository.cs, AccessEventDestinationResolver.cs + unit tests |
| 2 (tracer) | Package-drop endpoint (apartment-bound + condominium-level) | bfe9ea5 | AccessEventsEndpoints.cs, AccessControlDtos.cs, PackageDropEndpointTests.cs |

## Must-Have Verification (from plan truths)

- **Package drop → AccessEvent (EventKind=PackageDrop) with description + carrier code, NO Visit row** — unit tests assert the handler never calls VisitorArrivalHandler/IVisitRepository; integration test `Apartment_bound_package_drop_persists_access_event_row` asserts Visits count unchanged after a drop. ✓
- **Apartment-bound records destination apartment; condominium-level omits it** — integration tests assert apartment snapshot populated (Block echoed) for apartment-bound, and `DestinationApartmentId=Guid.Empty` + `DestinationBlock='GATEHOUSE'`/`'RECEPTION'` for condominium-level. ✓
- **Rows appear in the unified ledger with description/carrier on the row** — columns persisted and round-tripped through `AccessEventRepository` (hydrated in `MapRow`); ledger consumption verified in plan 16-03. ✓

## Threat Mitigations Applied

- T-16-02-01 (free-text tampering): FluentValidation length caps 500/64; parameterized SQL via DBTools (no interpolation).
- T-16-02-02 (forged apartment id): `ResolveApartmentPublicAsync` re-resolves server-side; stale/forged id → 400 ProblemDetails (`Package_drop_with_unknown_apartment_is_refused` unit test).
- T-16-02-SC: no package installs — gate not triggered.

## Test Results

- `dotnet build src/ControlEasyReborn.sln` (Release): 0 errors, 0 warnings
- UnitTests: 231/231 pass (228 + 3 new package-drop tests) · ArchitectureTests: 19/19
- IntegrationTests (Testcontainers MySQL): 3/3 PackageDropEndpointTests; 20/20 combined access/regression suite (ManualLookup, QrScan, VisitorScanUnification, VisitEndpoint)

## Deviations from Plan

**1. [Rule 3 - Blocking fix] ProblemDetails content-type assertion**
- **Found during:** Task 2 verify
- **Issue:** The global exception handler writes ProblemDetails via `WriteAsJsonAsync` (content type `application/json`); asserting the wire media type `application/problem+json` failed.
- **Fix:** Test asserts the RFC-7807 shape instead (status=400, `errors.PackageDescription` array) — the acceptance criterion (400 ProblemDetails) still holds.
- **Files modified:** tests/.../PackageDropEndpointTests.cs
- **Commit:** bfe9ea5

**2. [Plan adjustment] Lookup audit established via real search endpoint**
- **Found during:** Task 2 test authoring
- **Issue:** Tests need an AccessLookupAudit row owned by the acting JWT profile. Direct seeding cannot know the profile id (it is a random Guid inside `JwtTestHelper.GenerateTenantToken`).
- **Fix:** Followed the established `ManualLookupEndpointsTests` pattern: perform a real `POST /api/v1/access-subjects/search` first (which writes the audit under the acting profile), then register the drop against that audit id.
- **Commit:** bfe9ea5

## Verification Notes for Plan 16-03

- Ledger branch-2 filter surface: `EventKind=1` rows carry `PackageDescription` (free text, `q` filter) and `PackageCarrierCode` (exact-match `carrierCode` filter); apartment-bound rows carry a real `DestinationApartmentId` (apartment filter), condominium-level rows carry Guid.Empty + GATEHOUSE/RECEPTION.
- `ManualAccessResponse` now echoes `Kind`/`PackageDescription`/`PackageCarrierCode` (optional trailing fields — wire shape backward compatible).

## Self-Check: PASSED

- All created files exist on disk; commits 49f0de9, bfe9ea5 present in `git log`.