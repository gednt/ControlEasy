---
phase: 19-ledger-reports-polish
status: complete
date: 2026-09-26
plans_completed: [19-01, 19-02, 19-03, 19-04]
requirements_covered: [LEDGER-01, LEDGER-02, LEDGER-03, LEDGER-04, LEDGER-05]
---

# Phase 19 — Ledger & Reports Polish — VERIFICATION

## Goal Achievement

> The reports surface tells one honest story — the daily summary, status
> filters, search, pagination, and package-drop entry all match what the
> unified ledger backend actually serves.

**Status: ACHIEVED** — every ledger touchpoint is now consistent with the
backend vocabulary and behaviour.

## Per-requirement Verification

### LEDGER-01 — Tenant day-bucketing (INFRA-02 closeout) — DONE

- `TenantDayBoundary.ToTenantDate(DateTime utc)` helper added (reuses
  `ResolveTimeZone()`, normalizes `DateTimeKind.Unspecified` to UTC).
- `ReportReadRepository.GetVisitCountsByDayAsync` now normalizes its
  `from`/`to` UTC bounds via `TenantDayBoundary.GetDayBoundsUtc` and groups
  each row by tenant-local date.
- **Automated verification:**
  - 3 unit tests (`TenantDayBoundaryTests`) cover off-midnight UTC →
    previous day, post-midnight UTC → same day, and `DateTimeKind.Unspecified`
    normalization. All pass.
  - Integration test
    `GetVisitCountsByDay_BucketsOffMidnightUtcVisitToTenantLocalDay` seeds a
    visit at `2026-09-19T02:00:00Z` (= `23:00` São Paulo on `2026-09-18`),
    asserts the `2026-09-18` tenant-local bucket contains the visit AND the
    `2026-09-19` UTC bucket does NOT. Pass.
- ROADMAP Phase 19 success criterion 1 met.

### LEDGER-02 — Honest status filter vocabulary — DONE

- `reports.page.ts` `<option>` list (status filter) now contains only the
  empty "All statuses" plus the four visit-state values (`CheckedIn`,
  `Pending`, `CheckedOut`, `Cancelled`). Inert `Recorded` / `Refused`
  options removed.
- `getStateClass` CSS switch intentionally retains `case 'Refused'` /
  `case 'Recorded'` defensive branches (RESEARCH Pitfall 1).
- **Automated verification:**
  - Spec
    `only offers status options that map to backend NativeState values`
    asserts the option value set equals `['', 'CheckedIn', 'Pending',
    'CheckedOut', 'Cancelled']` and explicitly that neither `Recorded` nor
    `Refused` is present. Pass.
- ROADMAP Phase 19 success criterion 2 met.

### LEDGER-03 — Honest search scope — DONE

- `reports.page.ts` search placeholder changed from "Search by subject,
  document, or destination..." to "Search by subject, package description,
  or purpose..." (the lower-risk placeholder-alignment option per CONTEXT
  agent discretion — backend `q` SQL scope is unchanged).
- **Automated verification:**
  - Spec
    `search placeholder aligns to the backend q scope` asserts the
    placeholder contains "package description" and does NOT contain
    "document" or "destination". Pass.
- ROADMAP Phase 19 success criterion 3 met.

### LEDGER-04 — Condominium-level package drops — DONE

- `GatewayControlService.recordPackageDrop` accepts
  `destinationApartmentId: string | null` and sends
  `subjectId: payload.destinationApartmentId ?? '00000000-0000-0000-0000-000000000000'`.
- `gatehouse-panel.page.ts` modal now surfaces a "Record reception /
  condominium drop" trigger button (`data-testid="package-drop-condominium-btn"`).
  When activated, the submit path sends `destinationApartmentId: null` →
  `subjectId: Guid.Empty` (the deliberate backend condominium branch).
  `lookupAuditId` is still obtained via a `/api/v1/access-subjects/search`
  call (using the typed recipient query) since the backend requires it.
- `selectPackageRecipient` now also resets `packageDropCondominium` to `false`
  so the two paths are mutually exclusive.
- **Automated verification:**
  - Spec `records a condominium-level package drop with an empty subjectId`
      performs a subject search, activates the condominium trigger, and
      asserts the `POST /api/v1/access-events/manual` body has
      `subjectId: '00000000-0000-0000-0000-000000000000'` + `kind: 'package-drop'`.
      Pass.
  - The existing apartment-bound spec
      `records a package drop against the selected recipient apartment`
      still passes (regression coverage).
  - Backend condominium-level path is already covered by
      `History_returns_visit_package_and_legacy_rows_once_each` (which
      posts `SubjectId: Guid.Empty`); no backend change required.
- ROADMAP Phase 19 success criterion 4 met.

### LEDGER-05 — X-Total-Count exposure — DONE

- `Program.cs` `AngularDev` CORS policy now includes
  `.WithExposedHeaders("X-Total-Count")`. The policy's origin list,
  `AllowAnyHeader()`, `AllowAnyMethod()`, and `AllowCredentials()` are
  unchanged.
- **Plan-vs-implementation deviation (forced by stack):** the plan prescribed
  endpoint-level `.WithExposedHeaders("X-Total-Count")` on the `/history`
  `MapGet` chain. That API does not exist in ASP.NET Core 8.0 SDK
  (verified by inspecting `Microsoft.AspNetCore.Cors.xml` — only
  `CorsPolicyBuilder.WithExposedHeaders` exists; the endpoint-level form
  was added in .NET 9). The policy-level form achieves the identical
  end-result: `Access-Control-Expose-Headers: X-Total-Count` is emitted on
  `/history` responses to `http://localhost:4200` and
  `https://localhost:8443`, no widening of the exposure surface for other
  endpoints. The deviation is documented in `19-04-SUMMARY.md`.
- **Automated verification:**
  - Integration test
    `History_exposes_XTotalCount_via_AccessControlExposeHeaders` seeds a
    visit, sends `GET /api/v1/reports/history` with
    `Origin: http://localhost:4200`, asserts (a) `X-Total-Count` is present
    and ≥ 1 and (b) `Access-Control-Expose-Headers` response header
    contains `X-Total-Count`. Pass.
- ROADMAP Phase 19 success criterion 5 met.

## Verification Cadence

- Per-turn fast gate (`scripts/verify-ci-local.ps1 -Fast`) after every plan
  commit: PASS (Release build succeeded; UnitTests 252/252; ArchitectureTests
  20/20).
- Angular unit tests (ChromeHeadlessNoSandbox via `docker run`):
  - 360/360 before Wave 2
  - 361/361 after Wave 1 (added 1 spec for condominium-level drop)
- Task-completion full gate (`scripts/verify-ci-local.ps1`): **PASS**
  - Stage 1 format: PASS
  - Stage 2 build: PASS
  - Stage 3 UnitTests 252/252 + ArchitectureTests 20/20: PASS
  - Stage 4 IntegrationTests (Testcontainers MySQL) 126/126: PASS
    - Includes the two new integration tests
      (`GetVisitCountsByDay_BucketsOffMidnightUtcVisitToTenantLocalDay` for
      LEDGER-01, `History_exposes_XTotalCount_via_AccessControlExposeHeaders`
      for LEDGER-05).
  - Stage 5 Angular production Docker build: PASS
  - Stage 6 OpenAPI client + swagger drift: PASS (zero content diff; the
    `git status` noise after the gate is purely EOL normalization from the
    SDK container's LF output vs. host CRLF — `git diff --ignore-cr-at-eol`
    is empty).

## Files Changed (Phase Total)

- Backend (C#):
  - `src/Modules/Reports/ControlEasyReborn.Modules.Reports.Application/Time/TenantDayBoundary.cs`
  - `src/Modules/Reports/ControlEasyReborn.Modules.Reports.Infrastructure/Persistence/ReportReadRepository.cs`
  - `src/Host/ControlEasyReborn.Api/Program.cs`
- Frontend (TypeScript):
  - `src/Web/ControlEasyReborn.Web/src/app/features/access-control/gateway-control.service.ts`
  - `src/Web/ControlEasyReborn.Web/src/app/features/reports/reports.page.ts`
  - `src/Web/ControlEasyReborn.Web/src/app/features/gatehouse/gatehouse-panel.page.ts`
- Tests:
  - `tests/ControlEasyReborn.UnitTests/Modules/Reports/TenantDayBoundaryTests.cs`
  - `tests/ControlEasyReborn.IntegrationTests/ReportEndpointTests.cs`
  - `src/Web/ControlEasyReborn.Web/src/app/features/reports/reports.page.spec.ts`
  - `src/Web/ControlEasyReborn.Web/src/app/features/gatehouse/gatehouse-panel.page.spec.ts`
- Planning artifacts:
  - `.planning/phases/19-ledger-reports-polish/19-01-SUMMARY.md`
  - `.planning/phases/19-ledger-reports-polish/19-02-SUMMARY.md`
  - `.planning/phases/19-ledger-reports-polish/19-03-SUMMARY.md`
  - `.planning/phases/19-ledger-reports-polish/19-04-SUMMARY.md`
  - `.planning/phases/19-ledger-reports-polish/19-VERIFICATION.md` (this file)

## No Outstanding Issues

All 4 plans completed, all 5 requirements satisfied, full local CI gate
PASSED. No blockers, no follow-up items.