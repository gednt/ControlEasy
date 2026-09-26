---
phase: 19-ledger-reports-polish
plan: 02
type: summary
date: 2026-09-26
status: complete
requirements: [LEDGER-02, LEDGER-03]
commit: 96fb7a8
---

# Plan 19-02 — Honest status filter & search placeholder (LEDGER-02/03) — Summary

## Outcome

The reports ledger UI only offers status options that map to backend
`NativeState` values, and the search placeholder no longer promises fields the
backend `q` filter does not match.

## Changes

- `src/Web/ControlEasyReborn.Web/src/app/features/reports/reports.page.ts:234`
  — search placeholder changed from "Search by subject, document, or
  destination..." to "Search by subject, package description, or purpose..."
  (lower-risk option per CONTEXT agent discretion).
- `src/Web/ControlEasyReborn.Web/src/app/features/reports/reports.page.ts:247`
  — status filter `<option>` list now contains only the empty "All statuses"
  plus the four visit-state values (`CheckedIn`, `Pending`, `CheckedOut`,
  `Cancelled`). Inert `Recorded`/`Refused` options removed.
- `src/Web/ControlEasyReborn.Web/src/app/features/reports/reports.page.ts`
  — `getStateClass` CSS switch left intact (the research's "stale switch"
  warning — `case 'Refused'` / `case 'Recorded'` are harmless defensive
  branches, not selected by any rendered `<option>` value).
- `src/Web/ControlEasyReborn.Web/src/app/features/reports/reports.page.spec.ts`
  — two new specs:
  - `only offers status options that map to backend NativeState values`
    asserts the option value set equals `['', 'CheckedIn', 'Pending',
    'CheckedOut', 'Cancelled']` and explicitly that neither `Recorded` nor
    `Refused` is present.
  - `search placeholder aligns to the backend q scope` asserts the
    placeholder contains "package description" and does NOT contain
    "document" or "destination".

## Verification

- Per-turn fast gate (`scripts/verify-ci-local.ps1 -Fast`):
  - Stage 2: Release build succeeded
  - Stage 3: UnitTests 252/252, ArchitectureTests 20/20
- Angular unit tests (ChromeHeadlessNoSandbox via `docker run`):
  - 360/360 specs pass — includes the 2 new spec assertions and the existing
    `reports.page.spec.ts` cases (filters by search/status, pagination,
    CSV helpers, etc.)

## Files Changed

- 2 files: 1 production (reports.page.ts), 1 test (reports.page.spec.ts)
- +35 / −3 lines

## Notes

- The `getStateClass` switch case for `'Refused'` / `'Recorded'` is retained
  defensively per RESEARCH Pitfall 1: removing the cases could break the
  `state-refused` CSS class if those NativeState strings ever flow from a
  legacy ConsentAuditLog row.
- The search placeholder wording deliberately keeps "subject" (the most-used
  free-text match). The two over-promised fields ("document" — no SQL column,
  and "destination" — concatenation of `DestinationBlock + DestinationUnit`,
  never matched) were dropped.