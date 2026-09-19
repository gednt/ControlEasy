---
phase: 17
plan: 01
subsystem: Gatehouse / Navigation / Visits
tags: [gatehouse, operator-panel, walk-in, visits-redirection, shift-ledger]
requires:
  - Phase 16 CheckInNow walk-in support in Visits backend
  - QrScanPage and ManualLookupPage components
provides:
  - GatehousePanelPage consolidated operator panel at /gatehouse
  - Deep-link query param routing (?tab=qr|manual|walkin|visits) and route parity (/gatehouse/qr, /gatehouse/manual)
  - Inline walk-in registration with CheckInNow: true
  - Active on-site visits list with quick checkout
  - Dashboard navigation links repointed to /gatehouse
  - VisitsPage clarified as administrative pre-registration and records register
affects:
  - 17-02 (QR Scanner camera persistence within the gatehouse panel)
  - 17-03 (Navigation and reports integration)
tech-stack:
  added: []
  patterns:
    - Tabbed operator workstation with URL query synchronization
    - Standalone Angular 18 components with Signals
    - Shift Ledger design system typography, tokens, and badge styling
key-files:
  created:
    - src/Web/ControlEasyReborn.Web/src/app/features/gatehouse/gatehouse-panel.page.ts
    - src/Web/ControlEasyReborn.Web/src/app/features/gatehouse/gatehouse-panel.page.spec.ts
  modified:
    - src/Web/ControlEasyReborn.Web/src/app/app.routes.ts
    - src/Web/ControlEasyReborn.Web/src/app/features/dashboard/dashboard.page.ts
    - src/Web/ControlEasyReborn.Web/src/app/features/visits/visits.page.ts
    - src/Web/ControlEasyReborn.Web/src/app/features/visits/visits.page.spec.ts
    - src/Web/ControlEasyReborn.Web/src/app/layout/sidebar/sidebar.component.ts
decisions:
  - "GatehousePanelPage composes QR scan, manual lookup, walk-in registration, and open visits with responsive tabs"
  - "Walk-in registration in gatehouse panel sets checkInNow: true for immediate on-site arrival without secondary check-in step"
  - "VisitsPage is demoted to administrative register (pre-registration with checkInNow: false and records)"
  - "Dashboard action buttons repoint to /gatehouse (QR tab) and /gatehouse?tab=walkin"
metrics:
  duration: ~25 min
  completed: 2026-09-19
status: complete
actuals:
  tasks: 4
  commits: 1
---

# Plan 17-01 Summary: Gatehouse Operator Panel & Navigation

Delivered the consolidated `/gatehouse` operator workstation, unifying gatehouse operations (QR scan, manual lookup, walk-in registration, and on-site visits) into a responsive, tablet-friendly panel. Repointed dashboard quick actions and preserved deep-link parity for existing routes.

## Implementation Details

1. **GatehousePanelPage (`gatehouse-panel.page.ts`)**:
   - 4 tabs: `qr` (Scan QR code), `manual` (Manual lookup), `walkin` (Walk-in registration), `visits` (Active on-site visits).
   - Reactive query parameter synchronization (`?tab=...`) with default fallback to `qr`.
   - Dedicated walk-in form that creates visits directly `CheckedIn` via `POST /api/v1/visits` with `checkInNow: true`, apartment selector, and immediate feedback card.
   - On-site visits table with active elapsed time badges and single-click checkout action.
2. **Route Parity (`app.routes.ts`)**:
   - `/gatehouse` loads `GatehousePanelPage`.
   - `/gatehouse/qr` loads `GatehousePanelPage` with initialTab `qr`.
   - `/gatehouse/manual` loads `GatehousePanelPage` with initialTab `manual`.
3. **Dashboard Quick Actions (`dashboard.page.ts`)**:
   - "Record access" navigates to `/gatehouse`.
   - "Add visit" navigates to `/gatehouse?tab=walkin`.
4. **Administrative Visits Page (`visits.page.ts`)**:
   - Updated header and copy to reflect the Administrative Register role.
   - Pre-registration modal sets `checkInNow: false`.
5. **Unit Tests**:
   - `gatehouse-panel.page.spec.ts` covers tab switching, query parameter changes, walk-in form submission, and checkout handling.
