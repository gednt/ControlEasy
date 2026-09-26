---
phase: 19-ledger-reports-polish
plan: 01
type: summary
date: 2026-09-26
status: complete
requirements: [LEDGER-01]
commit: 4bd95be
---

# Plan 19-01 — Tenant-day bucketing (LEDGER-01) — Summary

## Outcome

`GET /api/v1/reports/visit-counts-by-day` now buckets visits by tenant-local day,
not raw UTC. The "Daily visit volume" card agrees with the unified ledger near
midnight.

## Changes

- `src/Modules/Reports/ControlEasyReborn.Modules.Reports.Application/Time/TenantDayBoundary.cs:33`
  — new public static helper `ToTenantDate(DateTime utc)` reuses
  `ResolveTimeZone()` and normalizes `DateTimeKind.Unspecified` to UTC before
  converting to the tenant-local calendar date.
- `src/Modules/Reports/ControlEasyReborn.Modules.Reports.Infrastructure/Persistence/ReportReadRepository.cs:172`
  — `BuildDateRangeClause` now derives its `from`/`to` UTC bounds from
  `TenantDayBoundary.GetDayBoundsUtc` (mirroring `GetHistoryHandler`), so the
  SQL filter window is the tenant-local day, not raw-UTC midnight.
- `src/Modules/Reports/ControlEasyReborn.Modules.Reports.Infrastructure/Persistence/ReportReadRepository.cs:185`
  — `MapVisitDate` now calls `TenantDayBoundary.ToTenantDate(value)` so each
  row groups into its tenant-local date.
- `tests/ControlEasyReborn.UnitTests/Modules/Reports/TenantDayBoundaryTests.cs`
  — added three `ToTenantDate` tests covering the off-midnight UTC (→
  previous day), post-midnight UTC (→ same day), and `DateTimeKind.Unspecified`
  paths.
- `tests/ControlEasyReborn.IntegrationTests/ReportEndpointTests.cs:51` — new
  `GetVisitCountsByDay_BucketsOffMidnightUtcVisitToTenantLocalDay` test seeds
  a `Visits.CreatedAtUtc` of `2026-09-19T02:00:00Z` and asserts the
  `2026-09-18` tenant-local bucket contains it while the `2026-09-19` UTC
  bucket does not.

## Verification

- Per-turn fast gate (`scripts/verify-ci-local.ps1 -Fast`):
  - Stage 1: format check skipped (no .cs files modified since last commit — not the case here, but the gate pre-staged it)
  - Stage 2: Release build succeeded (0 warnings, 0 errors)
  - Stage 3: UnitTests 252/252 pass, ArchitectureTests 20/20 pass
- Integration test runs only in the FULL gate (Testcontainers MySQL); not run
  per turn per the AGENTS.md / VALIDATION.md cadence rule.

## Files Changed

- 4 files: 2 production (TenantDayBoundary.cs, ReportReadRepository.cs), 2 tests
  (TenantDayBoundaryTests.cs, ReportEndpointTests.cs)
- +97 / −3 lines

## Notes

- The pre-existing `GetVisitCountsByDay_ReturnsAggregatedRows` test continues
  to pass — the bucketing change does not break the "non-empty" assertion, only
  the new test now proves the bucket boundary.
- No backend contract change; the response shape (DateOnly + Count) is
  unchanged. Frontend `reports.page.ts` parses the same DTO and renders the
  same labels — no UI change required for this requirement.
- Default timezone remains `America/Sao_Paulo`; no per-tenant timezone config
  this phase (deferred per CONTEXT).