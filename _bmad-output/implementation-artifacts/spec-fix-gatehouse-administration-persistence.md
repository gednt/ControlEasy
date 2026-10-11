---
title: 'Fix gatehouse Administration persistence'
type: 'bugfix'
created: '2026-10-11'
status: 'done'
baseline_commit: '63a6aca4af6a91c78396d62980678a4e1f4902ec'
review_loop_iteration: 0
context:
  - 'AGENTS.POLICY.md'
  - 'AGENTS.STACK.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Administration reports a newly registered gatehouse as created, but the gatehouse is not durably stored and does not appear in later gatehouse reads. This prevents the operational selector from using locations configured by an administrator.

**Approach:** Correct the tenant-aware gatehouse insert so the physical tenant discriminator required by the database is written with the domain tenant identifier, and propagate DBTools' false insert result as a server failure. Lock the complete POST-to-GET behavior with integration coverage so a `201 Created` response cannot regress into a non-persisted result.

## Boundaries & Constraints

**Always:** Store both `TenantId` and `tenant_id` with the authenticated tenant; preserve tenant filtering and the existing endpoint/response contract; prove the created ID, name, and location are returned by a subsequent request; keep all test data synthetic.

**Ask First:** Any schema migration, endpoint shape change, or change to gatehouse authorization rules.

**Never:** Bypass tenant filtering, accept a tenant identifier from the request body, infer another tenant, or report creation before the repository operation succeeds.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Create gatehouse | Authenticated tenant submits valid name and optional location | API returns `201`; row contains matching `TenantId` and `tenant_id`; later GET includes the created gatehouse | Persistence failure must not be presented as successful creation |
| Tenant isolation | Another tenant lists gatehouses after creation | Created gatehouse is absent | Existing tenant filter remains authoritative |
| Null location | Valid name with no location | Gatehouse persists and GET returns a null location | No fabricated location value |

</frozen-after-approval>

## Code Map

- `src/Modules/Security/ControlEasyReborn.Modules.Security.Infrastructure/Persistence/GatehouseRepository.cs` — gatehouse insert and tenant-aware reads.
- `src/Modules/Security/ControlEasyReborn.Modules.Security.Application/Handlers/CreateGatehouseHandler.cs` — returns creation only after repository success.
- `src/BuildingBlocks/ControlEasyReborn.Infrastructure/MultiTenancy/TenantFilterInterceptor.cs` — read/update/delete tenant predicate; inserts must explicitly supply `tenant_id`.
- `docker/mysql/init/05-security-schema.sql` — `Gatehouses.tenant_id` is a required physical discriminator.
- `tests/ControlEasyReborn.IntegrationTests/SecurityEndpointTests.cs` — Security endpoint integration coverage.
- `src/Modules/Security/ControlEasyReborn.Modules.Security.Api/Endpoints/SecurityEndpoints.cs` — existing POST/GET contract to preserve.

## Tasks & Acceptance

**Execution:**

- [x] Update `GatehouseRepository.AddAsync` to insert the required `tenant_id` value from `gatehouse.TenantId` and throw when DBTools reports an unsuccessful insert.
- [x] Add an integration test that creates a uniquely named gatehouse, verifies `201`, then lists gatehouses and finds the exact created response.
- [x] Extend the integration assertion to prove another tenant cannot list the created gatehouse and cover a null location without changing the public contract.
- [x] Run focused Security integration coverage, the fast local gate, and the full local CI gate.

**Acceptance Criteria:**

- Given a tenant administrator submits a valid gatehouse in Administration, when creation returns `201`, then the same gatehouse is returned by a later GET for that tenant.
- Given tenant A creates a gatehouse, when tenant B lists gatehouses, then tenant A's gatehouse is not returned.
- Given a gatehouse is created without a location, when it is read later, then its location remains null.

## Spec Change Log

- Review hardening: enforce authenticated-tenant equality, preserve cancellation semantics, exercise failed inserts, verify both null/non-null locations, and add a functioning Tenant B control row.

## Verification

**Commands:**

- `dotnet test tests/ControlEasyReborn.IntegrationTests --filter SecurityEndpointTests` — attempted on the host; compilation succeeded, but test execution requires the unavailable .NET 8 host runtime. The full Docker gate covers this suite.
- `scripts/verify-ci-local.ps1 -Fast` — format, build, unit, and architecture stages pass.
- `scripts/verify-ci-local.ps1` — full integration, production Web build, and OpenAPI drift stages pass.

**Results:** Final fast gate passed (282 unit, 20 architecture). Final full gate passed (282 unit, 20 architecture, 196 integration), including C# formatting, production Web build, and OpenAPI drift verification. The host-only focused command compiled but could not execute because the host lacks the .NET 8 runtime; the full Docker gate executed the complete integration suite successfully.

## Suggested Review Order

**Tenant-safe persistence**

- Enforces authenticated tenant ownership before writing both database tenant columns.
  [`GatehouseRepository.cs:47`](../../src/Modules/Security/ControlEasyReborn.Modules.Security.Infrastructure/Persistence/GatehouseRepository.cs#L47)

- Converts silent DBTools failure into an error while preserving request cancellation.
  [`GatehouseRepository.cs:57`](../../src/Modules/Security/ControlEasyReborn.Modules.Security.Infrastructure/Persistence/GatehouseRepository.cs#L57)

**Behavioral regression coverage**

- Proves create-to-list durability for null and populated locations across tenants.
  [`SecurityEndpointTests.cs:123`](../../tests/ControlEasyReborn.IntegrationTests/SecurityEndpointTests.cs#L123)

- Locks tenant columns, failure propagation, mismatch rejection, and cancellation behavior.
  [`GatehouseRepositoryTests.cs:18`](../../tests/ControlEasyReborn.UnitTests/Modules/Security/GatehouseRepositoryTests.cs#L18)
