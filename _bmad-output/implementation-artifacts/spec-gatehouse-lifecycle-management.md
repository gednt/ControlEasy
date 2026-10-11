---
title: 'Gatehouse lifecycle management'
type: 'feature'
created: '2026-10-11'
status: 'done'
baseline_commit: 'e74d74a69756c44e9ddad4c02017de2065a2b187'
review_loop_iteration: 0
context:
  - 'AGENTS.POLICY.md'
  - 'AGENTS.STACK.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Administration can create gatehouses but cannot retire one, leaving obsolete locations available to operator workflows and new device assignments.

**Approach:** Add reversible disable/re-enable lifecycle management. Disabled gatehouses remain available to Administration and historical reads, but disappear from operational choices and are rejected for new access activity. Do not hard-delete records that may be referenced by devices, staff, visits, or access history.

## Boundaries & Constraints

**Always:** Default new gatehouses to active; persist lifecycle state tenant-safely; show both states in Administration; require explicit confirmation before disabling; keep historical `GatehouseId` references and names readable; make the server authoritative against stale browser state; preserve browser persistence for still-active selections.

**Ask First:** Hard deletion, clearing or rewriting historical references, force-unassigning devices or staff, or changing permissions beyond protecting the lifecycle mutation with the established administration/device-write permission.

**Never:** Allow an inactive or foreign gatehouse to record new QR, manual, package, or device-originated access activity; expose another tenant's inactive gatehouses; silently convert a disabled selection to another location.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Disable | Active tenant-owned gatehouse | State persists inactive; management list retains it; operational lists omit it | Failed persistence is not reported as success |
| Re-enable | Inactive tenant-owned gatehouse | State persists active and returns to operational choices | Idempotent requests return the current state |
| Stale client | Browser or device submits disabled gatehouse ID | No new access event is recorded | Existing validation ProblemDetails identifies invalid gatehouse |
| Tenant boundary | Tenant attempts to mutate another tenant's gatehouse | No state changes | Return `404` without disclosing ownership |
| Existing references | History/device/staff rows reference disabled gatehouse | References and display name remain readable | No cascade, nulling, or hard delete |

</frozen-after-approval>

## Code Map

- `docker/mysql/init/05-security-schema.sql`, `docker/mysql/migrations/`, `docker/docker-compose.yml` — active-state schema and existing-volume migration execution.
- `src/Modules/Security/**/Gatehouse*.cs`, `SecurityDtos.cs`, `SecurityEndpoints.cs` — lifecycle domain, persistence, contract, handler, authorization, and active-only/default listing.
- `src/Modules/Security/ControlEasyReborn.Modules.Security.Infrastructure/Services/GatehouseAccessValidator.cs` — server rejection of inactive operational locations.
- `src/Modules/Devices/**` — prevent new or changed device bindings to inactive gatehouses while retaining existing display names.
- `src/Web/ControlEasyReborn.Web/src/app/features/devices/components/door-integration-section.component.ts` — Administration status, confirmation, and Enable/Disable actions.
- `src/Web/ControlEasyReborn.Web/src/app/features/access-control/gatehouse-context.service.ts` — active-only reload clears a disabled persisted selection.
- `src/Web/ControlEasyReborn.Web/src/app/api/` — regenerated lifecycle request/response client.

## Tasks & Acceptance

**Execution:**

- [x] Add an `Active` gatehouse column for fresh and existing databases, including the migration runner path.
- [x] Extend the Security domain, contracts, tenant-aware repository, handler, endpoint, and DI with active-only default reads and authorized idempotent activation changes.
- [x] Reject inactive gatehouses at access-recording and device-assignment boundaries without damaging historical references.
- [x] Add Administration lifecycle controls with status, confirmation, pending/error feedback, and active-only device options; retain inactive rows for management/name display.
- [x] Regenerate the OpenAPI client and add backend, integration, Angular, persistence, tenant-isolation, and stale-browser-selection coverage.
- [x] Run focused suites, Web SPA gate, real-browser lifecycle validation, fast gate, and full local CI gate.

**Acceptance Criteria:**

- Given an administrator disables a gatehouse, when any operator view reloads, then it is absent from selectable locations and a persisted selection for it is removed.
- Given a stale client submits a disabled gatehouse, when recording any access path, then the API rejects it and persists no access event.
- Given an administrator re-enables a gatehouse, when operational data reloads, then it is selectable again without recreating the record.
- Given historical or configured records reference a disabled gatehouse, when they are read, then the original ID and display name remain intact.

## Spec Change Log

## Design Notes

Disable means “stop new operation at this location,” including device-originated access recording. Existing device/staff assignments remain visible and can be reassigned; re-enabling restores operation. Administration requests all lifecycle states, while existing operational consumers keep the default active-only list. This separation lets the existing tenant/profile-scoped `localStorage` reconciliation remove a disabled selection naturally without changing the persistence model.

## Verification

**Commands:**

- `scripts/verify-ci-local.ps1 -Fast` — C# format, Release build, unit, and architecture tests pass.
- Canonical Web SPA gate from `AGENTS.POLICY.md` — lint and Angular tests pass in the runner image.
- `scripts/verify-ci-local.ps1` — full gate passed: format, Release build, 284 unit tests, 20 architecture tests, 200 MySQL integration tests, production Web build, and OpenAPI drift.

**Manual checks:**

- In headless Chromium with a persistent browser profile: created and selected a gatehouse, closed and reopened the browser to confirm selection persistence, disabled it in Administration, confirmed the operator option and `localStorage` selection were removed, then re-enabled it and confirmed the option returned without silent reselection.
- With door integration disabled, confirmed Administration still displays gatehouse lifecycle controls.

## Suggested Review Order

**Lifecycle API and persistence**

- Start here for authorization, active-only reads, and the lifecycle mutation contract.
  [`SecurityEndpoints.cs:202`](../../src/Modules/Security/ControlEasyReborn.Modules.Security.Api/Endpoints/SecurityEndpoints.cs#L202)

- Idempotent tenant-scoped mutation preserves the gatehouse identity and historical references.
  [`SetGatehouseActivationHandler.cs:16`](../../src/Modules/Security/ControlEasyReborn.Modules.Security.Application/Handlers/SetGatehouseActivationHandler.cs#L16)

- Repository filtering separates operational reads from explicit management reads.
  [`GatehouseRepository.cs:35`](../../src/Modules/Security/ControlEasyReborn.Modules.Security.Infrastructure/Persistence/GatehouseRepository.cs#L35)

- Idempotent migration defaults existing and new gatehouses to active.
  [`0022-gatehouse-lifecycle.sql:1`](../../docker/mysql/migrations/0022-gatehouse-lifecycle.sql#L1)

**Operational enforcement**

- Access validation rejects inactive and cross-tenant gatehouses server-side.
  [`GatehouseAccessValidator.cs:22`](../../src/Modules/Security/ControlEasyReborn.Modules.Security.Infrastructure/Services/GatehouseAccessValidator.cs#L22)

- Device event ingestion preserves replay idempotency before enforcing active gatehouses.
  [`IngestDeviceEventHandler.cs:139`](../../src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Handlers/IngestDeviceEventHandler.cs#L139)

- Device edits permit unchanged historical bindings but reject new inactive assignments.
  [`EditDeviceHandler.cs:67`](../../src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Handlers/EditDeviceHandler.cs#L67)

**Administration and browser persistence**

- Administration exposes status and reversible actions independently of door integration.
  [`door-integration-section.component.ts:104`](../../src/Web/ControlEasyReborn.Web/src/app/features/devices/components/door-integration-section.component.ts#L104)

- Lifecycle action confirms destructive intent and refreshes management state.
  [`door-integration-section.component.ts:690`](../../src/Web/ControlEasyReborn.Web/src/app/features/devices/components/door-integration-section.component.ts#L690)

- Persistent selection survives browser closure while stale inactive IDs are removed.
  [`gatehouse-context.service.ts:46`](../../src/Web/ControlEasyReborn.Web/src/app/features/access-control/gatehouse-context.service.ts#L46)

**Verification**

- Integration coverage exercises disable, idempotency, filtering, re-enable, and tenant isolation.
  [`SecurityEndpointTests.cs:161`](../../tests/ControlEasyReborn.IntegrationTests/SecurityEndpointTests.cs#L161)

- Stale QR submissions prove rejection occurs without persisting an access event.
  [`QrScanEndpointsTests.cs:225`](../../tests/ControlEasyReborn.IntegrationTests/AccessControl/QrScanEndpointsTests.cs#L225)
