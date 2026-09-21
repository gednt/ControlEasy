---
phase: 16
reviewed_at: 2026-09-19
status: resolved
depth: standard
files_reviewed: 146
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
---

# Phase 16 Code Review

Reviewed committed changes from `5d20194ddf9f61219023f061368bba8903827150..HEAD`, excluding `.planning/` and lockfiles. The detailed pass covered the authored AccessControl, Visits, Reports, migration, and test changes; generated Angular OpenAPI output was checked for the new history contract.

## Resolved Findings

### WR-01 — `CheckInNow` bypasses the required shared arrival/deduplication path
- Status: **Resolved** in commit `e8cfd1c`.
- Resolution: Injected `VisitorArrivalHandler` into `CreateVisitHandler` and routed `CheckInNow: true` through `VisitorArrivalHandler.HandleAsync`. Added integration test `CreateVisit_WithCheckInNow_TwiceWithSameDocument_DeduplicatesToOneVisit` confirming deduplication to a single visit row.

### WR-02 — Unified ledger places completed arrivals on the pre-registration date
- Status: **Resolved** in commit `e8cfd1c`.
- Resolution: Changed `ReportReadRepository` in `GetHistoryAsync` and `CountHistoryAsync` to use `COALESCE(v.CheckedInAtUtc, v.CreatedAtUtc)` for `OccurredAt` and range filtering. Added integration test `History_pending_visit_checked_in_today_shows_on_today_at_checkin_timestamp`.

### WR-03 — The generated client discards the new history response body
- Status: **Resolved** in commit `e8cfd1c`.
- Resolution: Added `.Produces<IReadOnlyList<HistoryRowResponse>>(StatusCodes.Status200OK)` in `ReportEndpoints.cs` and regenerated the Angular OpenAPI client, producing `HistoryRowResponse` model and typed `Observable<StrictHttpResponse<Array<HistoryRowResponse>>>`.

## Summary

All warnings resolved. Full test suite (230 unit tests, 19 architecture tests, 114 Testcontainers integration tests) passes cleanly.

