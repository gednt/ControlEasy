---
title: "Implement integrated visits flow"
date: 2026-09-19
priority: high
resolves_phase: 16
context: Derived from gsd-explore session; decisions in .planning/notes/integrated-visits-flow.md
---

# Implement integrated visits flow

Decisions: one data model (Visits), visitor-only QR→Visit, entry-log folds into
Visits, one gatehouse panel, unified-stream Shift ledger. See
`.planning/notes/integrated-visits-flow.md` for file references.

## Backend unification

- [ ] QR visitor scans create/check-in Visit rows: extend `RecordAccessScanHandler.cs` so a visitor-subject scan with no matching Pending visit creates one (CheckedIn); a matching one gets `IVisitDirectory.CheckInAsync`. Resident/vehicle scans unchanged.
- [ ] Walk-in registration becomes a Visit: route gatehouse walk-ins through the Visits module (`POST /api/v1/visits` or a new gatehouse-scoped endpoint) landing as CheckedIn; `POST /api/v1/entry-log` writes ConsentAuditLog only.
- [ ] Decide + implement walk-in landing status (Pending vs direct CheckedIn) — lean direct CheckedIn; record the decision in the note.

## Unified ledger

- [ ] Extend `ReportReadRepository.cs:65-179` so the Shift ledger merges Visits + visitor AccessEvents into one chronological stream (open visits, today's count, recent list).
- [ ] Update `GET /api/v1/dashboard/stats` DTO and `dashboard-api.service.ts` types (`npm run openapi-check` must pass).

## Gatehouse panel consolidation

- [ ] Make `/gatehouse` the single operator surface: QR scan (`/gatehouse/qr`), manual lookup (`/gatehouse/manual`), walk-in register, check-in/out — all writing to Visits.
- [ ] Reduce `/visits` to management/reporting for admins; keep `VisitCreateModalComponent` for pre-registration there.
- [ ] Repoint Dashboard "Add visit" (`dashboard.page.ts:33-55`) to reuse the gatehouse register modal.
- [ ] Retire/redirect the entry-workflow walk-in path (`entry-workflow.page.ts`, `CeEntryWorkflowComponent`) once the gatehouse panel covers it; keep consent-audit behavior.
- [ ] Gatehouse panel follows DESIGN.md Shift Ledger language (ruled rows, mono labels, brick stamps, handover interaction).

## Verification

- [ ] Unit + architecture tests green; integration tests for scan→Visit and walk-in→Visit.
- [ ] `npm run openapi-check`, lint, Angular unit tests green.
- [ ] Manual check: QR scan of an unregistered visitor appears in the Shift ledger; walk-in appears; pre-registered flow unchanged.