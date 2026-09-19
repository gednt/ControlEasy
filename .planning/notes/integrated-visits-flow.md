---
title: "Integrated visits flow — exploration decisions"
date: 2026-09-19
context: gsd-explore session on worktree feat-qr-entrance-frontend-routing
---

# Integrated visits flow — exploration decisions

## The problem

Three places register an entry today, backed by three separate data stores:

| Entry point | Route / API | Data store |
|---|---|---|
| Visits page + `VisitCreateModalComponent` (reused on Dashboard) | `/visits` → `POST /api/v1/visits` | `Visits` |
| Dashboard "Add visit" button | same modal, same endpoint | `Visits` |
| Gatehouse walk-in | `POST /api/v1/entry-log` (`CeEntryWorkflowComponent`) | `ConsentAuditLog` |
| QR scan | `POST /api/v1/access-events/scans` | `AccessEvents` |

The Shift ledger (`src/Modules/Reports/.../ReportReadRepository.cs:65-179`, fed by
`GET /api/v1/dashboard/stats`) reads only `Visits` + `ConsentAuditLog`. It never reads
`AccessEvents` — so QR scans are invisible to the ledger unless a pre-registered
`Pending` visit existed and `RecordAccessScanHandler.cs:196-198` mutated it via
`IVisitDirectory.CheckInAsync`. Unmatched QR visitors create no Visit row at all.

## Decisions (settled 2026-09-19)

1. **One data model.** Visits is the single operational record for visitor entries.
2. **Visitors only.** Visitor-subject QR scans create/check-in Visit rows.
   Resident/vehicle scans stay in `AccessEvents` only — it remains the security
   audit trail, not an operational record.
3. **Entry-log folds into Visits.** Gatehouse walk-ins become Visit rows.
   `ConsentAuditLog` reverts to its privacy-consent audit role and stops being a
   data silo.
4. **One gatehouse panel.** Scan QR, manual lookup, walk-in register, and
   check-in/out all run from `/gatehouse`. `/visits` becomes management/reporting
   for admins. Dashboard "Add visit" reuses the gatehouse modal.
5. **Unified stream ledger.** The Shift ledger reads Visits + AccessEvents as one
   chronological activity view.

## Design-system alignment (impeccable context)

DESIGN.md's "Shift Ledger" north star already describes exactly this: "a live,
ruled queue that joins arrivals, destinations, record states, and time in one
scan path", with a handover signature interaction. The unified ledger is the
design system's core concept finally fed unified data. The gatehouse panel is an
extension of an established surface — it inherits the existing world, no new
visual identity exercise.

## Key files for implementation

- `src/Modules/AccessControl/.../Handlers/RecordAccessScanHandler.cs` — must create/check-in Visit rows for visitor subjects
- `src/Modules/AccessControl/.../Handlers/LookupSubjectHandler.cs` — searches Pending visits already
- `src/Modules/Visits/.../Handlers/CreateVisitHandler.cs` + `VisitEndpoints.cs:42`
- `src/Modules/Reports/.../ReportReadRepository.cs:65-179` — ledger read model needs AccessEvents stream
- `src/Web/ControlEasyReborn.Web/src/app/features/entry-workflow/entry-workflow.page.ts` + `design-system/components/entry-workflow/entry-workflow.component.ts` — walk-in path posts to `POST /api/v1/entry-log` via `features/entry-log/entry-log.service.ts`
- `src/Web/ControlEasyReborn.Web/src/app/features/visits/visit-create-modal.component.ts` — modal to reuse
- `src/Web/ControlEasyReborn.Web/src/app/features/dashboard/dashboard.page.ts:33-55` — "Add visit" + ledger
- `src/Web/ControlEasyReborn.Web/src/app/app.routes.ts:42-59` — gatehouse routes (QR, manual, credentials)

## Open questions (not settled)

- Visit `VisitStatus` state machine is Pending → CheckedIn → CheckedOut (Cancelled
  blocked after CheckedOut/Cancelled, `Visit.cs:58-80`). Walk-in fold: does an
  entry-log walk-in land as `Pending` (awaiting check-in) or directly `CheckedIn`?
  Leans direct `CheckedIn` since the person is physically present.
- Does the unified ledger need a new read endpoint or can `GET /api/v1/dashboard/stats`
  be extended? ReportReadRepository already joins tables; extension is likely.