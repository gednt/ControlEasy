---
phase: "27"
slug: "resident-access-foundation"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-15"
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from 27-RESEARCH.md `## Validation Architecture`; per-task map is refined as plans land.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | xUnit (dotnet test) — unit + Testcontainers.MySql integration + NetArchTest architecture |
| **Config file** | `tests/ControlEasyReborn.UnitTests/ControlEasyReborn.UnitTests.csproj` (+ IntegrationTests / ArchitectureTests) |
| **Quick run command** | `dotnet test tests/ControlEasyReborn.UnitTests --filter "FullyQualifiedName~ResidentCredential"` |
| **Full suite command** | `dotnet test tests/ControlEasyReborn.UnitTests && dotnet test tests/ControlEasyReborn.IntegrationTests && dotnet test tests/ControlEasyReborn.ArchitectureTests` |
| **Estimated runtime** | ~90–180 seconds (integration suite dominated by Testcontainers MySQL spin-up) |

---

## Sampling Rate

- **After every task commit:** Run the quick unit-filter command for the touched area
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

> Rows are seeded from the phase's requirement surface; the planner/executor refines with real plan task IDs.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 1 | RES-13 | T-27-01 | Resident JWT refused (403 ProblemDetails) on staff endpoint classes: tenant-wide visit lists, direct visit/detail reads, visit mutations, reports with caller-supplied `apartmentId` | integration | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~ResidentDenyMatrix"` | ❌ W0 | ⬜ pending |
| 27-01-02 | 01 | 1 | RES-13 | T-27-01 | Every mapped endpoint declares an explicit role policy — no bare `RequireAuthorization()` | architecture | `dotnet test tests/ControlEasyReborn.ArchitectureTests --filter "FullyQualifiedName~ExplicitRolePolicy"` | ❌ W0 | ⬜ pending |
| 27-02-01 | 02 | 1 | RES-02 | T-27-02 | Resident login via resolver-dispatched branch; uniform enumeration-safe constant-cost responses (unknown/wrong-password/inactive/revoked/suspended indistinguishable) | unit | `dotnet test tests/ControlEasyReborn.UnitTests --filter "FullyQualifiedName~LoginHandler"` | ❌ W0 | ⬜ pending |
| 27-03-01 | 02 | 2 | RES-01 | T-27-02 | issue live token → suspend → same token's NEXT request denied → reactivate → next request allowed | integration | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~ResidentSuspensionSequence"` | ❌ W0 | ⬜ pending |
| 27-04-01 | 03 | 2 | RES-03 | T-27-03 | Cross-apartment denial on every resident-reachable endpoint, two-apartment fixtures; per-request live scope via `ITenantAwareLinqFactory` | integration | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~ResidentApartmentIsolation"` | ❌ W0 | ⬜ pending |
| 27-05-01 | 03 | 2 | RES-01, RES-02 | T-27-03 | TenantAdmin reset covers resident credentials — BCrypt ≥ 11 hash, `MustChangePassword` re-armed, refresh-token revoke; resident forgot-password gets uniform denial | integration | `dotnet test tests/ControlEasyReborn.IntegrationTests --filter "FullyQualifiedName~ResidentPasswordReset"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/ControlEasyReborn.IntegrationTests/**/Resident*` — negative deny-matrix + isolation + suspension fixtures (two-apartment fixture set)
- [ ] `tests/ControlEasyReborn.UnitTests/**/Security/**` — resolver-dispatch login + enumeration-safety unit stubs
- [ ] `tests/ControlEasyReborn.ArchitectureTests/**` — explicit-role-policy architecture test stub
- [ ] `ResidentCredential` table migration + init-script + `03-tenant-backfill.sql` entry (SchemaBackfillSyncTests stay green)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Resident portal Login page accepts a provisioned resident and lands on the armed `/change-password` flow | RES-02 | Same visual surface as staff login (no new UI); login machinery verified by integration tests, but end-to-end browser entry covered by existing Playwright login specs | Run the existing Playwright login spec with a resident demo credential after `make up` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending