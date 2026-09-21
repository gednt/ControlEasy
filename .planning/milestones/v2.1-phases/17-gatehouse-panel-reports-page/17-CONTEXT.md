# Phase 17 Context: Gatehouse Panel + Reports Page

## Purpose
Phase 17 connects the backend unified ledger and arrival models created in Phase 16 to the operator and administrator frontends. Gatehouse operators get a consolidated panel at `/gatehouse` with fast tab switching between QR scanning, manual lookup, walk-in registration, and open visits. The QR scanner persists camera direction in `localStorage` per device. Administrators get a dedicated `/reports` page that fixes the dashboard dead link and delivers date ranges, visit counts, residents-per-apartment counts, server-side ledger search, and millisecond-precision CSV export.

## Requirements
- **PANEL-01**: Consolidated gatehouse operator panel at `/gatehouse` (tabs composing QR scan, manual lookup, walk-in registration, open visits list; deep-link parity; Shift Ledger design system)
- **PANEL-02**: `/visits` demoted to admin pre-registration/management; dashboard "Add visit" and "Record access" buttons repointed to the gatehouse panel
- **PANEL-03**: QR scan screen remembers camera facingMode in browser localStorage per device
- **PANEL-04**: `/reports` page with date ranges (Today/7d/30d/custom), visit counts by day, residents per apartment, unified history table, CSV export; consumes generated OpenAPI report client; fixes dashboard handover link
- **PANEL-05**: Ledger filtering and server-side search on the unified stream (date, status, subject, destination, origin)

## Execution Plans
- `17-01-PLAN.md`: Gatehouse Operator Panel & Navigation (PANEL-01, PANEL-02)
- `17-02-PLAN.md`: QR Scanner Camera Orientation Persistence (PANEL-03)
- `17-03-PLAN.md`: Reports Page, Unified Ledger Server-Side Filtering & CSV Export (PANEL-04, PANEL-05)
