---
phase: 19
slug: ledger-reports-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-24
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

> **Nyquist reconciliation (2026-09-24):** This phase has no separate Wave 0
> test-authoring plan. Every task carries an inline `<automated>` verify, and the test
> scaffolding listed under "Wave 0 Requirements" below is delivered **inline by the tasks
> themselves** (19-01 Tasks 1–2 author the day-boundary integration + unit tests; 19-02
> Task 2 authors the spec assertions; 19-03 Task 2 authors the package-drop spec; 19-04
> Task 2 authors the CORS exposure test). The "Wave 0 Requirements" checklist is therefore
> the post-execution sign-off that flips `nyquist_compliant: true` — it is NOT a separate
> pre-implementation wave. `nyquist_compliant` and `wave_0_complete` remain `false` until
> execution completes and the sign-off checklist is checked.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | xUnit 2.9.2 + FluentAssertions 8.2.0 + NSubstitute 5.1.0 + Testcontainers.MySql 4.0.0 (backend) · Jasmine 5.2 + Karma 6.4 (Angular) |
| **Config file** | `tests/Directory.Build.props` (backend) · `angular.json` → `test` (Angular) |
| **Quick run command** | `dotnet test tests/ControlEasyReborn.UnitTests --filter "FullyQualifiedName~TenantDayBoundary"` |
| **Full suite command** | `scripts/verify-ci-local.sh` (full 6-stage gate) |
| **Estimated runtime** | ~3 s (--fast) / ~5 min (full) |

---

## Sampling Rate

- **After every task commit:** Run `scripts/verify-ci-local.sh --fast`
- **After every plan wave:** Run `dotnet test tests/ControlEasyReborn.IntegrationTests` + `npm test -- --no-watch --browsers=ChromeHeadless`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | LEDGER-01 | T-19-01 | Tenant-day bucketing (no raw UTC) | integration | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~ReportEndpointTests"` | ❌ W0 | ⬜ pending |
| 19-01-02 | 01 | 1 | LEDGER-01 | T-19-01 | `TenantDayBoundary.ToTenantDate` UTC→local-day | unit | `dotnet test tests/ControlEasyReborn.UnitTests --filter "FullyQualifiedName~TenantDayBoundaryTests"` | ⚠️ partial | ⬜ pending |
| 19-02-01 | 02 | 1 | LEDGER-02 | T-19-03 | Status filter offers only backend-returnable states | unit (Angular) | `npm test -- --no-watch --browsers=ChromeHeadless` (reports.page.spec.ts) | ❌ W0 | ⬜ pending |
| 19-02-02 | 02 | 1 | LEDGER-03 | T-19-03 | Search placeholder matches backend `q` scope | unit (Angular) | `npm test -- --no-watch --browsers=ChromeHeadless` (reports.page.spec.ts) | ❌ W0 | ⬜ pending |
| 19-03-01 | 03 | 1 | LEDGER-04 | T-19-04 | Condominium-level drop sends `subjectId = Guid.Empty` | unit (Angular) + integration | `npm test` (gatehouse-panel.page.spec.ts) + `dotnet test ... --filter ReportEndpointTests` | ⚠️ partial | ⬜ pending |
| 19-04-01 | 04 | 2 | LEDGER-05 | T-19-05 | `X-Total-Count` exposed via `WithExposedHeaders` | integration | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~ReportEndpointTests"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/ControlEasyReborn.IntegrationTests/ReportEndpointTests.cs` — day-boundary test seeding an off-midnight UTC visit and asserting tenant-local bucket date (LEDGER-01)
- [ ] `tests/ControlEasyReborn.UnitTests/Modules/Reports/` — `TenantDayBoundary.ToTenantDate(DateTime utc)` helper tests (LEDGER-01, if helper introduced)
- [ ] `tests/ControlEasyReborn.IntegrationTests/ReportEndpointTests.cs` — `X-Total-Count` exposure assertion (LEDGER-05)
- [ ] `src/Web/ControlEasyReborn.Web/src/app/features/reports/reports.page.spec.ts` — status-filter option set excludes `Recorded`/`Refused`; placeholder matches backend `q` scope (LEDGER-02/03)
- [ ] `src/Web/ControlEasyReborn.Web/src/app/features/gatehouse/gatehouse-panel.page.spec.ts` — condominium-level package-drop spec (LEDGER-04)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual confirmation of filter dropdown + search placeholder in browser | LEDGER-02/03 | UI vocabulary is visual | Open `/reports`, open status filter, confirm no Recorded/Refused; confirm placeholder text |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
