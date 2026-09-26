---
phase: 20-account-operations-consent-audit-ui
plan: 04
type: execute
wave: 3
status: complete
---

# Phase 20 Plan 04 — Summary

## Scope

CONSU-02 (porteiro name resolution in the audit row) + CONSU-03 verify
(CSV ms precision is unchanged; covered by existing integration test).

## Truths Delivered

- The audit row's porteiro cell renders a human-readable name (resolved from
  the tenant staff list, keyed on `StaffMemberResponse.ProfileId` =
  `AttendantProfile.Id` — never `User.Id`), with an em-dash fallback when the
  name is unresolved.
- The override-row highlight, photo thumbnail + lightbox, reason cell, and
  state badge rendering are untouched (already correct from Phase 13).
- The audit page wires the same staff source into both the porteiro dropdown
  (from Plan 20-03) and the row name map: `ProfileId → displayName`. The map
  is rebuilt reactively via a `computed()` off the staff signal.
- CSV export still emits `yyyy-MM-dd HH:mm:ss.fff` (InvariantCulture) —
  verified by the existing `ExportCsv_ReturnsCsvWithMillisecondPrecision`
  integration test, not rebuilt.

## Artifacts Touched

- `src/Web/.../design-system/components/audit-row/audit-row.component.ts` —
  new `porteiroName = input<string | undefined>(undefined)`; template renders
  `porteiroName() || '—'` instead of `entry().performedByProfileId`; cell
  styling softened (no longer monospace GUID wrap).
- `src/Web/.../design-system/components/audit-row/audit-row.component.spec.ts`
  — three new tests:
  - renders the resolved porteiro name when supplied, never the raw GUID
  - falls back to em-dash when `porteiroName` is not supplied
  - still applies the override-row highlight when `entered_override` and a
    porteiro name is set
- `src/Web/.../features/audit/audit.page.ts` — injects `AuthService`;
  `porteiros = signal<StaffMemberResponse[]>([])`; `porteiroOptions = computed`
  projects to `PorteiroOption[]` (profileId + displayName); `porteiroNameById
  = computed` builds a `Map<ProfileId, displayName>`; loads staff in
  `ngOnInit` (failure leaves the map empty); template passes
  `[porteiroName]="porteiroNameById().get(entry.performedByProfileId ?? '')"`
  and `[porteiros]="porteiroOptions()"` to the filters.

## Test Results

- Angular build: clean
- TypeScript: strict, 0 errors
- Backend unit + arch tests: green
- Fast CI gate: green

## Notes

- The audit-row component is presentation-only: the name mapping is supplied
  by the page, exactly as the plan prescribes. No new shared domain model
  is introduced.
- The CSV export is intentionally untouched — `ExportEntryLogCsvHandler` and
  `ExportCsv_ReturnsCsvWithMillisecondPrecision` already cover CONSU-03.

## Key-Space Contract Reminder

The audit page's name map is keyed on `StaffMemberResponse.ProfileId` (an
`AttendantProfile.Id`). Keying on `p.userId` would silently miss every row,
because `ConsentAuditLog.PerformedByProfileId` is an `AttendantProfile.Id`,
not a `User.Id`.