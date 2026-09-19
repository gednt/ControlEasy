---
phase: 16
status: gaps_found
verified: 2026-09-19
verification_mode: static_review
final_runtime_gate: reported_passed_not_rerun
requirements_verified:
  - VISIT-01
  - VISIT-03
  - VISIT-05
  - VISIT-06
  - VISIT-07
  - INFRA-02
requirements_with_gaps:
  - VISIT-02
  - VISIT-04
---

# Phase 16 Verification

## Result

**Gaps found.** This is a static verification of the completed Phase 16 plans,
summaries, requirement set, review report, implementation, migrations, and
test sources. No build, test, lint, restore, install, or runtime command was
run from the Windows host. `16-03-SUMMARY.md` reports a previously passing full
local gate, but that result was not re-executed for this verification.

Two review findings are requirement-level phase blockers: the CheckInNow
walk-in path bypasses the shared arrival/deduplication handler (WR-01), and
the unified ledger dates checked-in pre-registrations by creation time rather
than the operational arrival time (WR-02). Both have missing regression tests.

## Requirement Trace

| Requirement | Evidence inspected | Result |
|---|---|---|
| VISIT-01 | `VisitorArrivalHandler` performs latest-document Pending/CheckedIn/new transitions; scan handler registers arrival before persisting its AccessEvent and persists `VisitId` only for a Visit mutation. `VisitorScanVisitUnificationTests` covers unmatched, re-scan, and resident paths. | Pass |
| VISIT-02 | `CreateVisitHandler` makes a `CheckInNow` request directly CheckedIn; entry-log validator/handler reject `gatehouse_only`; ledger has a pre-cutoff legacy branch. However direct creation bypasses the required single shared arrival path and its checked-in-document dedupe (WR-01). | **Gap** |
| VISIT-03 | `RecordManualAccessHandler` resolves a visitor profile and calls `IVisitDirectory.RegisterArrivalAsync`; non-visitor/manual exit paths remain AccessEvents. | Pass by static evidence |
| VISIT-04 | `GetHistoryHandler` normalizes dates through `TenantDayBoundary`; `ReportReadRepository` provides one tenant-predicated UNION stream, kinds/native states/source, filters, ordering, and total header. However the Visit branch filters and emits `CreatedAtUtc`, hiding a pre-registered visitor who checks in during the requested day after the linked AccessEvent is excluded (WR-02). | **Gap** |
| VISIT-05 | `RefusedScanAttempts` is a ledger UNION branch with `Kind='refused-scan'`, `Source='security-event'`, and native `FailureCode`; `History_refused_scan_shows_failure_code_not_visit_vocabulary` covers it. | Pass |
| VISIT-06 | Package drops are deliberately represented as `AccessEvents` under D-04: `RecordManualAccessHandler` persists description, no Visit is created, and the history projection exposes `PackageDescription`. Package endpoint tests cover apartment and gatehouse forms. | Pass (D-04 interpretation) |
| VISIT-07 | Package carrier code is length-validated, persisted, returned in the ledger projection, and queried server-side using `PackageCarrierCode`; the carrier filter integration test exists. | Pass |
| INFRA-02 | Init/live migrations add `Visits(tenant_id, CreatedAtUtc)`; `TenantDayBoundary` is implemented and used by `GetHistoryHandler`. Unit tests cover the São Paulo boundary. | Pass |

## Must-have and Plan Link Assessment

- Plans 16-01 and 16-02 provide the intended visitor arrival and package-drop write paths, including the migration/index, package columns, destination snapshots, and AccessEvent-to-Visit link.
- Plan 16-03 provides the endpoint, explicit `tenant_id = @param0` predicates in each UNION branch, context rows, legacy cutoff, pagination, and server-side filters.
- The Phase 16 write-path objective requires QR, manual lookup, and walk-in arrivals to use one shared handler. `CreateVisitHandler` instead constructs/adds a checked-in `Visit` itself for `CheckInNow`; therefore a second same-document walk-in while the first is CheckedIn creates a duplicate row.
- The ledger's Visit branch uses `v.CreatedAtUtc` for both date range and `OccurredAt`. When a pending visit created before the selected day is checked in during it, the linked AccessEvent is correctly suppressed but the Visit is omitted from that day's result. This fails the promised chronological/day-range behavior.

## Review Warning Adjudication

| Finding | Adjudication | Required disposition |
|---|---|---|
| WR-01 — CheckInNow bypasses shared arrival/dedupe | **Valid, blocking.** It conflicts with the phase objective and 16-01/16-03 settled D-02 design. The current `CreateVisitHandler` has no `VisitorArrivalHandler`/`IVisitDirectory` dependency and directly calls `_visits.AddAsync`. | Route `CheckInNow` through the shared arrival seam after apartment resolution; add a repeat-walk-in same-document integration test. |
| WR-02 — ledger uses pre-registration date | **Valid, blocking.** It violates VISIT-04's one chronological stream and makes tenant-local day filtering operationally incorrect for pending-to-checked-in arrivals. | Use operational `COALESCE(CheckedInAtUtc, CreatedAtUtc)` consistently for the Visit projection and range predicate; add a cross-day pending-then-check-in ledger test. |
| WR-03 — generated history client returns `void` | **Valid, non-requirement-blocking but must be fixed before Phase 17 consumes the API.** The runtime endpoint returns rows, but it lacks 200 response metadata, leaving generated OpenAPI with `StrictHttpResponse<void>` and no history-row model. This does not independently falsify VISIT-01..07 or INFRA-02, but it fails Plan 16-03's stated generated-client/OpenAPI integration intent. | Add the collection response metadata, regenerate, and assert a typed generated body/header response. |

## Missing Regression Coverage

1. POST two `CheckInNow` walk-ins with the same normalized document while the first remains CheckedIn; assert one Visit row.
2. Create a Pending Visit before a tenant-local selected day, check it in during the selected day, then assert one `visit` history row on that day at the check-in timestamp.
3. Validate the generated history operation has a `HistoryRowResponse[]` body type rather than `void` after OpenAPI regeneration.

## Closure Condition

Run the Phase 16 gap fixes, add the three regressions above, execute the required full local CI gate in the devcontainer, then regenerate this verification report with `status: passed` only if the repaired behavior and gate evidence are clean.
