---
phase: 16
plan: 03
subsystem: Reports, Photos, AccessControl
tags: [unified-ledger, entry-log, pagination, migrations, openapi]
requires:
  - 16-01 visits unification schema and day-boundary support
  - 16-02 package-drop AccessEvents
provides:
  - GET /api/v1/reports/history unified, tenant-predicated ledger
  - X-Total-Count pagination, history filters, and generated Angular client
  - consent-only entry-log writes and dashboard counts sourced from Visits
  - durable AccessEvent-to-Visit links with safe live migration/backfill
affects:
  - Phase 17 reports and gatehouse UI
tech-stack:
  added: []
  patterns:
    - CTE ledger with a metadata row for exact out-of-range page totals
    - VisitMutated arrival result distinguishes true Visit changes from re-scan audit events
    - live schema backfills only mutually unique event-to-Visit matches
key-files:
  created:
    - src/Modules/Reports/ControlEasyReborn.Modules.Reports.Application/Handlers/GetHistoryHandler.cs
    - docker/mysql/migrations/0011-visits-unification.sql
    - docker/mysql/migrations/0012-access-event-visit-link.sql
    - src/Web/ControlEasyReborn.Web/src/app/api/fn/reports/api-v-1-reports-history-get.ts
  modified:
    - src/Modules/Reports/ControlEasyReborn.Modules.Reports.Infrastructure/Persistence/ReportReadRepository.cs
    - src/Modules/Reports/ControlEasyReborn.Modules.Reports.Api/Endpoints/ReportEndpoints.cs
    - src/Modules/Photos/ControlEasyReborn.Modules.Photos.Application/Handlers/EntryLogHandlers.cs
    - src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Handlers/RecordAccessScanHandler.cs
    - src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Handlers/RecordManualAccessHandler.cs
decisions:
  - "A Visit-mutating arrival carries VisitId; an idempotent re-scan remains an access-event ledger row."
  - "Existing database schema upgrades run migrations 0011 and 0012 through db-migrate."
metrics:
  completed: 2026-09-19
status: complete
---

# Phase 16 Plan 03: Unified Ledger and Consent-only Entry Log Summary

Implemented `/api/v1/reports/history` as the single chronological ledger for Visits, AccessEvents (including package drops and refusals), and pre-cutoff legacy consent rows. Entry-log now records consent/audit states only, and dashboard statistics no longer add ConsentAuditLog records to Visit counts.

## Completed Tasks

| Task | Result |
| ---- | ------ |
| Unified ledger | Native state/source/kind fields, tenant predicates per UNION branch, server pagination, total header, and server-side carrier, text, apartment, status, and date filters. |
| Entry-log re-scope | Rejects new `gatehouse_only` writes; preserves supported consent states and legacy read-only history. |

## Hardening Added During Verification

- `AccessEvents.VisitId` is persisted only when visitor arrival actually creates or advances a Visit; idempotent re-scans remain visible audit entries.
- Live migrations add the Phase 16 package columns and Visit link for existing databases. The historical backfill accepts only mutually unique event-to-Visit pairs and uses binary comparisons to tolerate legacy collation differences.
- The ledger emits a metadata row internally so `X-Total-Count` remains accurate for pages beyond the final row.
- OpenAPI generation added the history client function and refreshed generated API files.

## Verification

- Full `scripts/verify-ci-local.ps1` gate passed: formatting, Release build (0 warnings/errors), 230 unit tests, 19 architecture tests, 112 integration tests, Docker web production build, and OpenAPI drift check.
- Focused report, entry-log, and visitor-scan integration suite: 22/22 passed.
- Migrations 0011 and 0012 ran twice successfully against a disposable MySQL 8 instance.
- Adversarial review: zero CRITICAL/HIGH findings.
