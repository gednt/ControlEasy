---
phase: 16
status: passed
verified: 2026-09-19
verification_mode: runtime_ci_suite
final_runtime_gate: passed
requirements_verified:
  - VISIT-01
  - VISIT-02
  - VISIT-03
  - VISIT-04
  - VISIT-05
  - VISIT-06
  - VISIT-07
  - INFRA-02
requirements_with_gaps: []
---

# Phase 16 Verification

## Result

**Passed.** The Phase 16 verification gaps identified in static review (WR-01, WR-02, WR-03) have been resolved, regression tests added, and verified via the full test suite (230 unit tests, 19 architecture tests, 114 Testcontainers MySQL integration tests, and OpenAPI client generation drift check).

## Requirement Trace

| Requirement | Evidence inspected | Result |
|---|---|---|
| VISIT-01 | `VisitorArrivalHandler` performs latest-document Pending/CheckedIn/new transitions; scan handler registers arrival before persisting its AccessEvent and persists `VisitId` only for a Visit mutation. `VisitorScanVisitUnificationTests` covers unmatched, re-scan, and resident paths. | Pass |
| VISIT-02 | `CreateVisitHandler` delegates `CheckInNow: true` arrivals through `VisitorArrivalHandler` to ensure single shared arrival path and checked-in-document deduplication. Deduplication regression test `CreateVisit_WithCheckInNow_TwiceWithSameDocument_DeduplicatesToOneVisit` passes. | Pass |
| VISIT-03 | `RecordManualAccessHandler` resolves a visitor profile and calls `IVisitDirectory.RegisterArrivalAsync`; non-visitor/manual exit paths remain AccessEvents. | Pass |
| VISIT-04 | `GetHistoryHandler` normalizes dates through `TenantDayBoundary`; `ReportReadRepository` provides one tenant-predicated UNION stream, kinds/native states/source, filters, ordering, and total header. Uses `COALESCE(v.CheckedInAtUtc, v.CreatedAtUtc)` for `OccurredAt` and range filtering. Regression test `History_pending_visit_checked_in_today_shows_on_today_at_checkin_timestamp` passes. | Pass |
| VISIT-05 | `RefusedScanAttempts` is a ledger UNION branch with `Kind='refused-scan'`, `Source='security-event'`, and native `FailureCode`; `History_refused_scan_shows_failure_code_not_visit_vocabulary` covers it. | Pass |
| VISIT-06 | Package drops are deliberately represented as `AccessEvents` under D-04: `RecordManualAccessHandler` persists description, no Visit is created, and the history projection exposes `PackageDescription`. Package endpoint tests cover apartment and gatehouse forms. | Pass |
| VISIT-07 | Package carrier code is length-validated, persisted, returned in the ledger projection, and queried server-side using `PackageCarrierCode`; the carrier filter integration test exists. | Pass |
| INFRA-02 | Init/live migrations add `Visits(tenant_id, CreatedAtUtc)`; `TenantDayBoundary` is implemented and used by `GetHistoryHandler`. Unit tests cover the São Paulo boundary. | Pass |

## Gap Resolutions & Regression Evidence

1. **WR-01 (VISIT-02 Deduplication):**
   - Injected `VisitorArrivalHandler` into `CreateVisitHandler`.
   - When `CheckInNow: true`, request delegates directly to `VisitorArrivalHandler.HandleAsync` ensuring active checked-in or pending visits with identical document deduplicate.
   - Verified with `CreateVisit_WithCheckInNow_TwiceWithSameDocument_DeduplicatesToOneVisit` in `tests/ControlEasyReborn.IntegrationTests/VisitEndpointTests.cs`.
2. **WR-02 (VISIT-04 Arrival Chronology):**
   - Updated `ReportReadRepository` `GetHistoryAsync` and `CountHistoryAsync` to use `COALESCE(v.CheckedInAtUtc, v.CreatedAtUtc)` for range filtering and `OccurredAt` projection.
   - Verified with `History_pending_visit_checked_in_today_shows_on_today_at_checkin_timestamp` in `tests/ControlEasyReborn.IntegrationTests/ReportEndpointTests.cs`.
3. **WR-03 (OpenAPI Typed History Response):**
   - Added `.Produces<IReadOnlyList<HistoryRowResponse>>(StatusCodes.Status200OK)` in `ReportEndpoints.cs`.
   - Regenerated OpenAPI client generating `HistoryRowResponse` model and typed `Observable<StrictHttpResponse<Array<HistoryRowResponse>>>` method in `api-v-1-reports-history-get.ts`.
4. **Testcontainers Port Mapping:**
   - Updated `MySqlContainerFixture.cs` to map `_container.GetMappedPublicPort(3306)` when `TESTCONTAINERS_HOST_OVERRIDE` is set.
   - Verified all 114 integration tests passing in `tests/ControlEasyReborn.IntegrationTests/`.

## Verification Status

All 8 requirements (VISIT-01..07, INFRA-02) are verified green.
Phase 16 is complete. Proceed to Phase 17.
