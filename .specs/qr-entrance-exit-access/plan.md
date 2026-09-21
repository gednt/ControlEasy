# Implementation Plan: Gatehouse Access and Visit Destinations

**Branch**: `feat/qr-entrance-exit-access` | **Date**: 2026-09-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `.specs/qr-entrance-exit-access/spec.md`

## Summary

Deliver a tenant-scoped gatehouse access workflow for residents, vehicles, visitors, and service providers. Tenant administrators issue, replace, and revoke opaque QR credentials; gatehouse attendants scan them for entrance or exit, or use a protected manual lookup by CPF, registered document, name, apartment, or block when no code is available. Every new or updated visit has a required active apartment destination with visible block and unit; resident and associated-vehicle selections resolve it automatically. Each decision produces an immutable access record or a safe refused-attempt record. The feature adds a dedicated Access Control module, extends resident documents and vehicle ownership links where required for manual lookup, tightens the existing Visits destination invariant, and integrates with—without repurposing—the existing consent ledger.

QR validation and access recording are software workflows only. They never operate a physical gate. Facial biometrics remains a deliberately unimplemented future credential method — see `docs/access-control.md#biometric-exclusion` for the architectural + schema-level enforcement (reserved enum, arch tests, Swagger filter).

## Technical Context

**Language/Version**: C# 12 on ASP.NET Core 8; TypeScript with Angular 18

**Primary Dependencies**: DBTools 1.4.3 (LINQ-first data access), FluentValidation, Mapster, JWT bearer authentication, Serilog, Swashbuckle/OpenAPI, Angular standalone components and signals

**Storage**: MySQL 8; new tenant-scoped access-control tables in the fresh schema and matching idempotent live migration; existing Residents, Vehicles, Apartments, and consent-policy data remain their respective modules' source of truth

**Testing**: xUnit + FluentAssertions + NSubstitute unit tests; Testcontainers.MySql integration tests through `WebApplicationFactory<Program>`; NetArchTest architecture tests; Angular Karma/Jasmine unit tests; Playwright gatehouse E2E tests

**Target Platform**: Docker Compose API and Angular web application, used by an authenticated gatehouse attendant on a camera-equipped browser or QR scanner

**Project Type**: Modular-monolith web application with a single API and SPA

**Performance Goals**: At least 95% of normal QR scans produce a final result in 3 seconds or less; at least 95% of normal manual lookups find and record the selected subject in 15 seconds or less

**Constraints**:

- Every new persisted record, query, and request is tenant-scoped through `ITenantAwareLinqFactory` and the JWT-derived tenant context.
- QR payloads are opaque bearer references: no CPF, name, apartment, plate, tenant identifier, or credential state appears in the code; raw QR values are neither persisted nor logged.
- Normal data reads remain DBTools LINQ-first. No raw read SQL is introduced for the cross-module manual lookup.
- Access events and refused scan attempts are append-only. Replacements and revocations preserve history rather than deleting credentials.
- Manual document searches require a complete normalized document. Name, apartment, and block searches require a sufficiently specific term, return a capped result set, and expose only the minimum tenant-local disambiguation data.
- A new or updated visit/access event that needs a destination never has a pending-destination state: it must resolve to an active apartment, block, and unit or return a correction-required result.
- Resident selections derive their destination from the resident's active apartment. Vehicle selections derive it from a verified resident owner when present, otherwise the vehicle's active apartment; completed records retain a destination snapshot.
- The feature does not unlock doors, use a physical reader protocol, enroll facial data, match faces, or reuse photo records as biometrics.
- Build, run, test, and restore verification executes inside Docker containers only.

**Scale/Scope**: One new `AccessControl` feature module, additive extensions to Residents, Vehicles, and Visits, both existing and new gatehouse SPA flows, new OpenAPI endpoints, and comprehensive tenant-isolation, destination, and audit coverage

## Constitution Check

### Phase 0 gate assessment

| Principle | Plan response | Status |
|-----------|---------------|--------|
| I. Spec-Driven Development | This plan, [research.md](research.md), [data-model.md](data-model.md), [contracts/access-api.md](contracts/access-api.md), and [quickstart.md](quickstart.md) are maintained under the active feature spec. Tasks are generated only after this plan. | PASS |
| II. Multi-Tenant Isolation by Default | Access credentials, events, attempts, lifecycle actions, and lookup audits carry both tenant columns; all reads use tenant-aware repositories; responses hide cross-tenant and unknown-token identities. Cross-tenant integration tests are required. | PASS |
| III. LINQ-First Data Access | New operational reads/writes use DBTools LINQ through tenant-aware factories. The manual directory composes owner-module read ports instead of raw SQL joins. Database DDL/triggers are limited to schema migrations and explicitly documented. | PASS |
| IV. Test-First & Verification Discipline | Tasks begin with failing unit/integration/architecture or UI tests as appropriate. Every completed implementation task requires the prescribed Compose rebuild, healthy services, and affected test slices. | PASS |
| V. Observability, Security, Runtime Container Parity | JWT and explicit Access permissions protect operations; RFC 7807 returns safe errors; Serilog records structured non-sensitive outcomes; Docker Compose is the only validation runtime. | PASS |
| VI. Workflow Tooling | spec-kit owns this feature's artifacts; the active requirement is listed in `.planning/PROJECT.md` and its decision in `.planning/STATE.md`; no separate change-tracking layer is used (OpenSpec removed at v1.7.0). | PASS |
| VII. Sub-Agent Orchestration & Concurrency Budget | Phase-0 research used two focused sub-agents, within the three-agent budget. No implementation-wave exception is proposed. | PASS |

### Post-design re-check

The design preserves each gate. The dedicated Access Control module avoids corrupting the consent-oriented `ConsentAuditLog`; owner-module lookup ports avoid raw cross-table reads; all planned tables are tenant-scoped and append-only where audit evidence is stored. No constitutional exception or Complexity Tracking entry is needed.

## Project Structure

### Documentation (this feature)

```text
.specs/qr-entrance-exit-access/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── access-api.md
└── tasks.md                 # Created by /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── Modules/
│   ├── AccessControl/
│   │   ├── ControlEasyReborn.Modules.AccessControl.Domain/
│   │   ├── ControlEasyReborn.Modules.AccessControl.Application/
│   │   ├── ControlEasyReborn.Modules.AccessControl.Infrastructure/
│   │   └── ControlEasyReborn.Modules.AccessControl.Api/
│   ├── Residents/
│   │   └── ...                         # resident identity-document directory port
│   ├── Vehicles/
│   │   └── ...                         # verified OwnerResidentId and directory port
│   ├── Visits/
│   │   └── ...                         # required destination and immutable destination snapshot
│   ├── Apartments/
│   │   └── ...                         # apartment/block directory port
│   └── Photos/
│       └── ...                         # consent-policy evaluator adapter only
├── Host/ControlEasyReborn.Api/
│   └── Program.cs                       # module registration and endpoint mapping
└── Web/ControlEasyReborn.Web/
    └── src/app/
        ├── features/entry-workflow/     # QR scan and protected fallback lookup
        ├── features/access-control/     # credential administration and event review
        ├── services/                    # generated/OpenAPI-based access API facade
        └── api/                         # regenerated API types after contract change

docker/mysql/
├── init/                                # fresh Access Control tables and source-model additions
└── migrations/                          # idempotent upgrade migration

tests/
├── ControlEasyReborn.UnitTests/Modules/AccessControl/
├── ControlEasyReborn.IntegrationTests/
│   └── AccessControlEndpointTests.cs
├── ControlEasyReborn.ArchitectureTests/
└── a11y/ and visual/                    # gatehouse control coverage when relevant
```

**Structure Decision**: A new Access Control module owns the access credential lifecycle and its immutable security ledger. Residents, Vehicles, Apartments, and Visits retain ownership of their master data and expose narrow, tenant-aware ports; Photos exposes a policy-evaluation port. The existing Visits module enforces and snapshots visit destinations, while both the existing visit UI and new access UI consume the same destination resolver. This prevents the consent-specific ledger from becoming a malformed general access ledger and keeps authorization logic out of resident/vehicle CRUD modules.

## Complexity Tracking

No constitution violations require justification.
