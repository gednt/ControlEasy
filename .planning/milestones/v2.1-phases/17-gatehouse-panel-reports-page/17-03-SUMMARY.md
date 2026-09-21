---
phase: 17
plan: 03
subsystem: Reports / History / OpenAPI
tags: [reports, unified-ledger, csv-export, server-side-filtering, date-ranges]
requires:
  - Phase 16 Reports API endpoints (visit counts, residents per apartment, unified history ledger)
  - Generated OpenAPI client in src/app/api/
provides:
  - ReportsPage route registered at /reports under authGuard
  - Resolution of dead dashboard link /reports
  - Date range selector (Today, 7d, 30d, Custom) with tenant-local boundary formatting
  - Summary cards for daily visit counts and residents per apartment breakdown
  - Unified history ledger with server-side pagination, search, status, and carrier filters
  - Millisecond-precision CSV export (yyyy-MM-dd HH:mm:ss.fff)
affects:
  - 17-01 (Dashboard handover link resolution)
tech-stack:
  added: []
  patterns:
    - Angular 18 Signals and computed state
    - OpenAPI client consumption via ReportsService
    - Shift Ledger design tokens and responsive tabular layout
key-files:
  created:
    - src/Web/ControlEasyReborn.Web/src/app/features/reports/reports.page.ts
    - src/Web/ControlEasyReborn.Web/src/app/features/reports/reports.page.spec.ts
  modified:
    - src/Web/ControlEasyReborn.Web/src/app/app.routes.ts
    - src/Web/ControlEasyReborn.Web/src/app/layout/sidebar/sidebar.component.ts
decisions:
  - "ReportsPage registered at /reports and added to navigation sidebar"
  - "Dashboard handover link /reports resolves directly to the new ReportsPage"
  - "Summary cards consume ReportsService.apiV1ReportsVisitCountsByDayGet and apiV1ReportsResidentsPerApartmentGet"
  - "Unified stream consumed via ReportsService.apiV1ReportsHistoryGet$Response to parse X-Total-Count header and records"
  - "CSV export formats timestamp with millisecond precision: yyyy-MM-dd HH:mm:ss.fff with standard RFC 4180 escaping"
metrics:
  duration: ~30 min
  completed: 2026-09-19
status: complete
actuals:
  tasks: 5
  commits: 1
---

# Plan 17-03 Summary: Reports Page, Unified Ledger Server-Side Filtering & CSV Export

Delivered the `/reports` page within the authenticated application shell, resolving the dead dashboard handover link. Implemented date range presets, summary breakdown metrics, server-side search and filtering on the unified ledger stream, and millisecond-precision CSV export.

## Implementation Details

1. **Route & Navigation (`app.routes.ts`, `sidebar.component.ts`)**:
   - Registered `/reports` under `authGuard` with breadcrumb `'Reports & History'`.
   - Added sidebar navigation entry with `file-text` icon.
   - Verified dashboard handover link `<a routerLink="/reports">` resolves seamlessly.
2. **Date Range Presets (`reports.page.ts`)**:
   - `Today`: Tenant-local midnight start to current time.
   - `7 Days`: Last 7 calendar days.
   - `30 Days`: Last 30 calendar days.
   - `Custom`: Interactive start and end date inputs with boundary checks.
3. **Summary Breakdown Cards**:
   - Consumes `ReportsService.apiV1ReportsVisitCountsByDayGet` to render day-by-day visit volume breakdown.
   - Consumes `ReportsService.apiV1ReportsResidentsPerApartmentGet` to display resident counts per apartment unit.
4. **Unified History Ledger with Server-Side Filtering (PANEL-05)**:
   - Queries `ReportsService.apiV1ReportsHistoryGet$Response` with `page`, `pageSize`, `from`, `to`, `status`, `carrierCode`, and `q`.
   - Extracts total count from `X-Total-Count` HTTP response header.
   - Renders event badges (`visit`, `security-event`, `package-drop`, `refused-scan`), subject details, destination, and native state.
5. **Millisecond-Precision CSV Export (PANEL-04)**:
   - Formats timestamp column using `formatTimestampWithMs`: `yyyy-MM-dd HH:mm:ss.fff`.
   - Implements RFC 4180 escaping with `escapeCsvField` for commas, quotes, and newlines.
   - Triggers client-side blob download named `reports-history-YYYY-MM-DDTHH-mm-ss.fffZ.csv`.
6. **Unit Tests (`reports.page.spec.ts`)**:
   - Tests date range changes, API queries, filter parameters, table rendering, and CSV export generation.
