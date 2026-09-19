---
phase: 16
reviewed_at: 2026-09-19
status: issues_found
depth: standard
files_reviewed: 146
findings:
  critical: 0
  warning: 3
  info: 0
  total: 3
---

# Phase 16 Code Review

Reviewed committed changes from `5d20194ddf9f61219023f061368bba8903827150..HEAD`, excluding `.planning/` and lockfiles. The detailed pass covered the authored AccessControl, Visits, Reports, migration, and test changes; generated Angular OpenAPI output was checked for the new history contract.

## Findings

### WR-01 — `CheckInNow` bypasses the required shared arrival/deduplication path

- Severity: Warning
- Evidence: `CreateVisitHandler.HandleAsync` constructs and inserts a new `Visit` directly whenever `CheckInNow` is true ([CreateVisitHandler.cs:57](C:/Users/felipecoelhosilva/repos/ControlEasy/.worktrees/feat-qr-entrance-frontend-routing/src/Modules/Visits/ControlEasyReborn.Modules.Visits.Application/Handlers/CreateVisitHandler.cs:57), [CreateVisitHandler.cs:62](C:/Users/felipecoelhosilva/repos/ControlEasy/.worktrees/feat-qr-entrance-frontend-routing/src/Modules/Visits/ControlEasyReborn.Modules.Visits.Application/Handlers/CreateVisitHandler.cs:62), [CreateVisitHandler.cs:79](C:/Users/felipecoelhosilva/repos/ControlEasy/.worktrees/feat-qr-entrance-frontend-routing/src/Modules/Visits/ControlEasyReborn.Modules.Visits.Application/Handlers/CreateVisitHandler.cs:79)). `VisitorArrivalHandler`, which implements the `CheckedIn`/`Pending`/new-row state transitions, is never called from this path ([VisitorArrivalHandler.cs:52](C:/Users/felipecoelhosilva/repos/ControlEasy/.worktrees/feat-qr-entrance-frontend-routing/src/Modules/Visits/ControlEasyReborn.Modules.Visits.Application/Handlers/VisitorArrivalHandler.cs:52)).
- Impact: A walk-in with the same document as a currently checked-in visitor creates another checked-in Visit. This violates Phase 16's single-source/deduplication rule and creates duplicate ledger rows.
- Recommendation: Resolve the apartment snapshot in `CreateVisitHandler`, then delegate `CheckInNow` requests to `VisitorArrivalHandler` (or an interface exposing it). Preserve the existing direct construction only for `CheckInNow == false` pre-registrations. Add an integration test for a repeated walk-in document while the latest Visit is checked in.

### WR-02 — Unified ledger places completed arrivals on the pre-registration date

- Severity: Warning
- Evidence: The ledger exposes every Visit with `v.CreatedAtUtc AS OccurredAt` ([ReportReadRepository.cs:269](C:/Users/felipecoelhosilva/repos/ControlEasy/.worktrees/feat-qr-entrance-frontend-routing/src/Modules/Reports/ControlEasyReborn.Modules.Reports.Infrastructure/Persistence/ReportReadRepository.cs:269)). For a pending Visit, the shared handler changes its check-in timestamp later ([VisitorArrivalHandler.cs:60](C:/Users/felipecoelhosilva/repos/ControlEasy/.worktrees/feat-qr-entrance-frontend-routing/src/Modules/Visits/ControlEasyReborn.Modules.Visits.Application/Handlers/VisitorArrivalHandler.cs:60)); the corresponding AccessEvent is then linked to that Visit ([RecordAccessScanHandler.cs:193](C:/Users/felipecoelhosilva/repos/ControlEasy/.worktrees/feat-qr-entrance-frontend-routing/src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Handlers/RecordAccessScanHandler.cs:193), [RecordAccessScanHandler.cs:194](C:/Users/felipecoelhosilva/repos/ControlEasy/.worktrees/feat-qr-entrance-frontend-routing/src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Handlers/RecordAccessScanHandler.cs:194)) and the ledger excludes linked AccessEvents ([ReportReadRepository.cs:296](C:/Users/felipecoelhosilva/repos/ControlEasy/.worktrees/feat-qr-entrance-frontend-routing/src/Modules/Reports/ControlEasyReborn.Modules.Reports.Infrastructure/Persistence/ReportReadRepository.cs:296), [ReportReadRepository.cs:298](C:/Users/felipecoelhosilva/repos/ControlEasy/.worktrees/feat-qr-entrance-frontend-routing/src/Modules/Reports/ControlEasyReborn.Modules.Reports.Infrastructure/Persistence/ReportReadRepository.cs:298)).
- Impact: A visitor pre-registered yesterday and checked in today is absent from today's `/reports/history` results: its Visit is dated yesterday and its actual-arrival AccessEvent is suppressed. This breaks chronological and day-range ledger reporting for pending-visit arrivals.
- Recommendation: Use the operational arrival timestamp for checked-in Visit rows (for example, `COALESCE(v.CheckedInAtUtc, v.CreatedAtUtc)`) consistently for the Visit branch's range filter and `OccurredAt`, while retaining `CreatedAtUtc` for pending/pre-registration rows. Add a report integration test that creates a pending Visit before the selected day and checks it in within that day.

### WR-03 — The generated client discards the new history response body

- Severity: Warning
- Evidence: The new generated function is typed `Observable<StrictHttpResponse<void>>`, requests `responseType: 'text'`, and clones the response with `body: undefined` ([api-v-1-reports-history-get.ts:22](C:/Users/felipecoelhosilva/repos/ControlEasy/.worktrees/feat-qr-entrance-frontend-routing/src/Web/ControlEasyReborn.Web/src/app/api/fn/reports/api-v-1-reports-history-get.ts:22), [api-v-1-reports-history-get.ts:34](C:/Users/felipecoelhosilva/repos/ControlEasy/.worktrees/feat-qr-entrance-frontend-routing/src/Web/ControlEasyReborn.Web/src/app/api/fn/reports/api-v-1-reports-history-get.ts:34), [api-v-1-reports-history-get.ts:39](C:/Users/felipecoelhosilva/repos/ControlEasy/.worktrees/feat-qr-entrance-frontend-routing/src/Web/ControlEasyReborn.Web/src/app/api/fn/reports/api-v-1-reports-history-get.ts:39)). No generated `HistoryRowResponse` model exists, so this is API metadata drift rather than an intentional UI omission.
- Impact: Any frontend consumer of the advertised generated `/reports/history` API receives `undefined` instead of ledger rows, so Phase 17 cannot consume the settled endpoint contract.
- Recommendation: Declare the endpoint's 200 response metadata with the collection schema (for example `.Produces<IReadOnlyList<HistoryRowResponse>>(StatusCodes.Status200OK)`) and regenerate OpenAPI. Verify the generated operation returns `StrictHttpResponse<Array<HistoryRowResponse>>` and preserves the response body/header.

## Notes

- No critical findings.
- Generated Angular API formatting changes outside the new history operation were treated as generator output and not independently flagged.
- This was a static review only; no build, test, lint, restore, or installation command was run on the Windows host.
