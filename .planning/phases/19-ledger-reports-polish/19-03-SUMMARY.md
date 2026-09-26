---
phase: 19-ledger-reports-polish
plan: 03
type: summary
date: 2026-09-26
status: complete
requirements: [LEDGER-04]
commit: c2061f6
---

# Plan 19-03 — Condominium-level package drop (LEDGER-04) — Summary

## Outcome

Operators can register a reception / condominium-level package drop from the
gatehouse panel without fabricating an apartment. The drop lands in the same
ledger with `SubjectId = Guid.Empty` (the backend's deliberate condominium
branch), sitting alongside apartment-bound drops.

## Changes

- `src/Web/ControlEasyReborn.Web/src/app/features/access-control/gateway-control.service.ts:71`
  — `recordPackageDrop` signature accepts
  `destinationApartmentId: string | null`. The POST body now sets
  `subjectId: payload.destinationApartmentId ?? '00000000-0000-0000-0000-000000000000'`,
  keeping `subjectType: 'visitor'`, `direction: 'entrance'`,
  `gatehouseId: null`, `kind: 'package-drop'` exactly as before.
- `src/Web/ControlEasyReborn.Web/src/app/features/gatehouse/gatehouse-panel.page.ts`
  - Added `readonly packageDropCondominium = signal(false)` state.
  - Added a secondary trigger button
    `data-testid="package-drop-condominium-btn"` ("Record reception /
    condominium drop") that appears when neither a recipient nor the
    condominium path is selected yet. Clicking it either uses the existing
    `lookupAuditId` from a prior search or runs a fresh
    `/api/v1/access-subjects/search` using the typed recipient query to
    satisfy the backend's required `LookupAuditId`.
  - `submitPackageDrop` branches on `packageDropCondominium()`: when true,
    sends `destinationApartmentId: null` (→ Guid.Empty `subjectId`).
    Toast message adapts ("reception / condominium" vs. apartment block/unit).
  - The submit button's `[disabled]` binding now allows submission when EITHER
    `packageDropRecipient()` is set OR `packageDropCondominium()` is true
    (and the form is valid and not submitting).
  - `closePackageDrop` resets `packageDropCondominium.set(false)`.
- `src/Web/ControlEasyReborn.Web/src/app/features/gatehouse/gatehouse-panel.page.spec.ts`
  — new spec `records a condominium-level package drop with an empty subjectId`
  performs a subject search (empty `items` is fine — backend only requires
  the audit id), activates the condominium trigger, and asserts the
  `POST /api/v1/access-events/manual` body has
  `subjectId: '00000000-0000-0000-0000-000000000000'` + `kind: 'package-drop'`.

## Verification

- Per-turn fast gate (`scripts/verify-ci-local.ps1 -Fast`): Stage 2 build +
  Stage 3 UnitTests/ArchitectureTests (no backend change here — fast gate
  passes on the unchanged state).
- Angular unit tests (ChromeHeadlessNoSandbox via `docker run`):
  - 361/361 specs pass — includes the new condominium spec, the existing
    apartment-bound spec, and the existing `search/select/submit` paths.

## Files Changed

- 3 files: 1 service (gateway-control.service.ts), 1 component
  (gatehouse-panel.page.ts), 1 spec (gatehouse-panel.page.spec.ts)
- +121 / −6 lines

## Notes

- `lookupAuditId` remains required for the condominium path — the backend's
  `RecordManualAccessHandler` validates it regardless of `SubjectId`. The
  trigger button transparently runs a `/api/v1/access-subjects/search`
  using the typed recipient query (≥ 3 chars) to obtain the audit id, so the
  operator UX is unchanged from the apartment-bound flow.
- The `selectPackageRecipient` path now also resets `packageDropCondominium`
  to `false` so the two paths are mutually exclusive (avoiding a stale
  condominium flag from corrupting an apartment-bound submission).