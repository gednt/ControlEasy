---
phase: 16
plan: 01
subsystem: Visits / AccessControl / Reports
tags: [visits, access-control, visitor-arrival, package-drop-columns, day-boundary]
requires:
  - Visit entity + VisitStatus state machine (pre-existing)
  - RecordAccessScanHandler / RecordManualAccessHandler write paths (pre-existing)
provides:
  - VisitorArrivalHandler (single visitor check-in path, scoped in Visits DI)
  - IVisitDirectory.FindLatestByDocumentAsync / RegisterArrivalAsync
  - AccessEventKind (Access=0 / PackageDrop=1) + AccessEventKindCodes wire helper
  - AccessEvent.EventKind/PackageDescription/PackageCarrierCode columns (migration 14)
  - TenantDayBoundary day-bounds helper (Reports.Application.Time)
  - CreateVisitRequest.CheckInNow walk-in support
affects:
  - 16-02 (AccessEvent package-drop write path consumes EventKind/columns)
  - 16-03 (ledger UNION reads Visits index + AccessEvent columns + TenantDayBoundary)
tech-stack:
  added: []
  patterns:
    - shared arrival handler across QR/manual/walk-in entry points (dedupe single source of truth)
    - optional trailing parameters on domain factory methods for backward-compatible schema growth
key-files:
  created:
    - docker/mysql/init/14-visits-unification.sql
    - src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Domain/ValueObjects/AccessEventKind.cs
    - src/Modules/Visits/ControlEasyReborn.Modules.Visits.Application/Handlers/VisitorArrivalHandler.cs
    - src/Modules/Reports/ControlEasyReborn.Modules.Reports.Application/Time/TenantDayBoundary.cs
    - tests/ControlEasyReborn.IntegrationTests/AccessControl/VisitorScanVisitUnificationTests.cs
    - tests/ControlEasyReborn.UnitTests/Modules/Reports/TenantDayBoundaryTests.cs
  modified:
    - src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Domain/Entities/AccessEvent.cs
    - src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Handlers/RecordAccessScanHandler.cs
    - src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Handlers/RecordManualAccessHandler.cs
    - src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Handlers/AccessEventDestinationResolver.cs
    - src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Commands/AccessControlCommands.cs
    - src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Contracts/AccessControlDtos.cs
    - src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Validators/AccessControlValidators.cs
    - src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Api/Endpoints/AccessEventsEndpoints.cs
    - src/Modules/Visits/ControlEasyReborn.Modules.Visits.Application/Abstractions/IVisitDirectory.cs
    - src/Modules/Visits/ControlEasyReborn.Modules.Visits.Application/Contracts/VisitDtos.cs
    - src/Modules/Visits/ControlEasyReborn.Modules.Visits.Application/Handlers/CreateVisitHandler.cs
    - src/Modules/Visits/ControlEasyReborn.Modules.Visits.Infrastructure/Persistence/VisitDirectoryRepository.cs
    - src/Modules/Visits/ControlEasyReborn.Modules.Visits.Infrastructure/DI/VisitsModuleServiceCollectionExtensions.cs
    - src/Modules/Visits/ControlEasyReborn.Modules.Visits.Api/Endpoints/VisitEndpoints.cs
decisions:
  - "VisitorArrivalCommand/VisitorArrivalHandler lives in Visits.Application; IVisitDirectory.RegisterArrivalAsync is the cross-module seam so AccessControl never references Visits.Application.Handlers directly"
  - "Unmatched visitor scan creates a NEW Visit with status CheckedIn directly (constructor accepts status; no state-machine change) per D-01"
  - "Manual-lookup arrival profile sourced from the looked-up Visit row via ResolveVisitorProfileAsync (visit row is the data source)"
  - "CreateVisitHandler signature extended (attendantProfileId/gatehouseId optional params) instead of a new handler; CheckInNow stamps profile from JWT server-side"
  - "TenantDayBoundary falls back Windows-id 'E. South America Standard Time' then fixed UTC-3 custom zone; per-tenant TZ config deferred to Phase 17 per CONTEXT.md"
metrics:
  duration: ~35 min
  completed: 2026-09-19
status: complete
actuals:
  tasks: 3
  commits: 3
---

# Phase 16 Plan 01: Visitor Write-Path Fold Summary

Unified visitor write path: QR scan, manual lookup, and walk-in (CheckInNow) all funnel through one shared VisitorArrivalHandler producing idempotent Visit rows; schema gains the Visits ledger index and AccessEvents package-drop columns.

## Completed Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Migration 14, AccessEventKind, TenantDayBoundary | 2043aec | 14-visits-unification.sql, AccessEventKind.cs, AccessEvent.cs, TenantDayBoundary.cs + tests |
| 2 (tracer) | Unmatched visitor QR scan → one Visit row via shared handler | 70a3587 | VisitorArrivalHandler.cs, IVisitDirectory, VisitDirectoryRepository, RecordAccessScanHandler, endpoint + integration tests |
| 3 | Manual-lookup fold, walk-in CheckInNow, idempotency | abc8b9f | CreateVisitHandler, VisitEndpoints, RecordManualAccessHandler, resolver + tests |

## Must-Have Verification (from plan truths)

- **Unmatched visitor QR scan → new Visit row (CheckedIn) backfilled from resolved profile** — integration test `Unmatched_visitor_scan_creates_exactly_one_checked_in_visit` (against real MySQL): visit count 1, Status=1 (CheckedIn), CheckedInAtUtc stamped, AccessEvent row in same cycle. ✓
- **Pending-visit match checks in same row; AccessEvent references visitor subject** — VisitorArrivalHandler branches Pending → CheckIn on existing row; scan handler records the AccessEvent with the visitor SubjectId before the arrival call. Unit test `Records_manual_event_and_folds_visitor_arrival_through_shared_handler` covers the Pending→CheckIn path. ✓
- **Re-scan while CheckedIn is no-op; new Visit only after CheckedOut** — `Duplicate_visitor_scan_with_new_attempt_id_is_idempotent`: 2 scans, still 1 Visits row, 2 AccessEvents. ✓
- **Walk-in CheckInNow lands directly CheckedIn** — `CreateVisit_WithCheckInNow_LandsDirectlyCheckedIn` integration test. ✓
- **Resident/vehicle scans remain AccessEvents-only** — `Resident_scan_creates_no_visit_rows` asserts zero visit-row growth. ✓
- **Visits (tenant_id, CreatedAtUtc) index + AccessEvents package columns** — migration 14 (idempotent guards). ✓
- **TenantDayBoundary with passing tests** — 3 unit tests green (São Paulo standard-time mapping 03:00Z, 24h windows, UTC kinds). ✓

## Test Results

- `dotnet build src/ControlEasyReborn.sln` (Release, TreatWarningsAsErrors): 0 errors, 0 warnings
- UnitTests: 228/228 pass · ArchitectureTests: 19/19 pass
- IntegrationTests (Testcontainers MySQL, via CE_ITEST_MYSQL reuse path): 3/3 VisitorScanVisitUnification + 8/8 VisitEndpointTests + 16/16 combined QR/Manual/Visit regression suites

## Deviations from Plan

**1. [Rule 3 - Blocking fix] `ITenantContext.GatehouseId` does not exist**
- **Found during:** Task 3 (walk-in CheckInNow endpoint wiring)
- **Issue:** Plan instructed routing `tenantContext.GatehouseId` into CreateVisitHandler "the same way the checkin endpoint resolves ProfileId" — but the shared `ITenantContext` interface carries only TenantId/ProfileId/Roles/Permissions. GatehouseId is not in the JWT claims.
- **Fix:** Endpoint passes `gatehouseId: null` — identical to the established `/checkin` endpoint pattern (CheckInVisitHandler receives null from VisitEndpoints). AttendantProfileId is stamped server-side as required.
- **Files modified:** src/Modules/Visits/ControlEasyReborn.Modules.Visits.Api/Endpoints/VisitEndpoints.cs
- **Commit:** abc8b9f

**2. [Rule 3 - Blocking fix] Testcontainers-in-Docker fails on this host; CE_ITEST_MYSQL reuse path used**
- **Found during:** Task 2 verify
- **Issue:** `MySqlContainerFixture` spawning a MySQL container from inside the SDK container timed out on Windows Docker Desktop (Testcontainers sibling-network routing — "MySQL container did not become ready in time").
- **Fix:** Started a dedicated `mysql:8.0` container and ran tests via the fixture's built-in `CE_ITEST_MYSQL=host.docker.internal:<port>` external-MySQL bypass (which applies the same docker/mysql/init scripts). Same schema, same tests, real MySQL.
- **Commit:** n/a (test infrastructure usage only, no code change)

## Verification Notes for Plan 16-03

- `TenantDayBoundary.GetDayBoundsUtc(DateOnly)` → (StartUtc, EndUtc) with local midnight → 03:00Z for standard-time dates; consume in GetHistoryHandler for from/to normalization.
- AccessEvents columns `EventKind` (TINYINT, 0=Access 1=PackageDrop), `PackageDescription` VARCHAR(500), `PackageCarrierCode` VARCHAR(64) exist after migration 14; `AccessEvent.EventKind/PackageDescription/PackageCarrierCode` hydrate in the repository map.
- Double-count guard input: visitor QR arrivals now create Visit rows with `CheckedInAtUtc = OccurredAtUtc` of the accepted AccessEvent (same request cycle) — the D-03 dedupe rule (NOT EXISTS on tenant_id + CheckedInAtUtc = ae.OccurredAtUtc) is expressible against these rows.

## Self-Check: PASSED

- All 6 created files exist on disk (verified before writing this section).
- Commits 2043aec, 70a3587, abc8b9f present in `git log`.