---
phase: 20
slug: account-operations-consent-audit-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-24
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | xUnit 2.9.2 + FluentAssertions 8.2.0 + NSubstitute 5.1.0 + Testcontainers.MySql 4.0.0 (backend) · Jasmine 5.2 + Karma 6.4 (Angular) · Playwright 1.49 (E2E) |
| **Config file** | `tests/Directory.Build.props` (backend) · `angular.json` → `test` (Angular) |
| **Quick run command** | `./scripts/verify-ci-local.sh --fast` |
| **Full suite command** | `./scripts/verify-ci-local.sh` (6-stage) |
| **Estimated runtime** | ~3 s (--fast) / ~5 min (full) |

---

## Sampling Rate

- **After every task commit:** Run `./scripts/verify-ci-local.sh --fast`
- **After every plan wave:** Run `dotnet test src/ControlEasyReborn.sln` + `npm test -- --no-watch --browsers=ChromeHeadless`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 s

---

## Per-Task Verification Map

> Reconciled 2026-09-26 with the per-plan STRIDE registers (Plans 20-01..20-04): threat IDs below reference the owning plan's register (e.g. T-20-05/T-20-06 now denote the Plan 20-01 staff-endpoint authz and reset DoS rows; the SQLi row for the porteiro filter is Plan 20-03's T-20-06 — register scope is per-plan).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | ACCNT-01 | T-20-02 (P01) | TenantAdmin resets admin's password; cross-tenant → 403 | integration | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~PasswordResetTests"` | ⚠️ extend | ⬜ pending |
| 20-01-02 | 01 | 1 | ACCNT-01 | T-20-02 (P01) | Reset endpoint not platformAdmin-only | integration | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~PasswordResetTests"` | ⚠️ extend | ⬜ pending |
| 20-01-03 | 01 | 1 | ACCNT-02 | T-20-01, T-20-03 (P01) | SMTP dispatch; deliveryState Sent/Failed; no plaintext temp password in response | unit + integration | `dotnet test tests/ControlEasyReborn.UnitTests --filter "FullyQualifiedName~ResetUserPasswordHandler"` + `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~PasswordResetTests"` | ❌ W0 (extend) | ⬜ pending |
| 20-01-04 | 01 | 1 | ACCNT-01 | T-20-04, T-20-05 (P01) | GET /staff tenant-scoped (no interceptor → load-bearing TenantId predicate); TenantAdmin/PlatformAdmin-only (403 otherwise); ProfileId = AttendantProfile.Id join | integration | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~StaffListTests"` | ❌ W0 | ⬜ pending |
| 20-02-01 | 02 | 2 | ACCNT-02 | T-20-01, T-20-02 (P02) | Reset UI shows delivery feedback (no plaintext); TenantAdmin-only render on shared-shell route | unit (Angular) | `npm test -- --no-watch --browsers=ChromeHeadless` (administration.page.spec.ts) | ❌ W0 (extend) | ⬜ pending |
| 20-03-01 | 03 | 1 | CONSU-01 | T-20-06, T-20-07 (P03) | entry-log list AND export filter by porteiro (AttendantProfile.Id, parameterized) | integration | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~EntryLogEndpointTests"` | ⚠️ extend | ⬜ pending |
| 20-03-02 | 03 | 1 | CONSU-01 | T-20-08 (P03) | porteiro dropdown emits filter (keyed on AttendantProfile.Id) | unit (Angular) | `npm test` → `audit-filters.component.spec.ts` | ⚠️ extend | ⬜ pending |
| 20-04-01 | 04 | 3 | CONSU-02 | T-20-09, T-20-10 (P04) | override row shows reason + porteiro name (ProfileId key space); thumbnail→lightbox; badges | unit (Angular) | `npm test` → `audit-row.component.spec.ts`, `entry-state-badge.component.spec.ts` | ⚠️ extend | ⬜ pending |
| 20-04-02 | 04 | 3 | CONSU-03 | T-20-11 (P04) | CSV export ms precision | integration | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~ExportCsv_ReturnsCsvWithMillisecondPrecision"` | ✅ passing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/ControlEasyReborn.UnitTests/Modules/Security/ResetUserPasswordHandlerTests.cs` — SMTP dispatch + MustChangePassword + role lift (ACCNT-02)
- [ ] `tests/ControlEasyReborn.IntegrationTests/Security/PasswordResetTests.cs` — extend: TenantAdmin resets admin; cross-tenant porteiro reset → 403
- [ ] `tests/ControlEasyReborn.IntegrationTests/Security/StaffListTests.cs` — NEW: staff endpoint tenant isolation (no interceptor on Users seam), TenantAdmin/PlatformAdmin-only 403, ProfileId = AttendantProfile.Id join
- [ ] `tests/ControlEasyReborn.IntegrationTests/EntryLogEndpointTests.cs` — extend: porteiro-filter case (list + export)
- [ ] Angular `*.spec.ts` for new TenantAdmin reset surface + porteiro name resolution in `audit-row`
- [ ] No new framework install needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Mailpit inbox shows dispatched temp password | ACCNT-02 | SMTP delivery to dev catch-all | Trigger reset, open Mailpit (docker-compose `mailpit`), confirm email |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
