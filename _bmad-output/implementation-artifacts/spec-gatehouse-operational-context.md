---
title: 'Gatehouse operational context'
type: 'bugfix'
created: '2026-10-11'
status: 'done'
baseline_commit: 'b2cfcde5931e548f77c1d05a221a86923b79f8b6'
review_loop_iteration: 0
context:
  - 'AGENTS.POLICY.md'
  - 'AGENTS.STACK.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Gatehouses can be registered in Administration, but an attendant cannot see or select one while operating the Gatehouse panel. QR scans, manual access entries, and package drops therefore continue to send a null gatehouse identifier. Device health also gives a dead-end empty-state instruction, and the navigation throws a missing `activity` icon error.

**Approach:** Establish one tenant-scoped active-gatehouse context, visible at the operator desk and consumed by every access-recording action. Enforce submitted gatehouse ownership in the access-control backend as a defense in depth. Surface registered gatehouses in the health empty state with a clear configuration action, then keep repository instructions, audit evidence, and generated API client state truthful.

## Boundaries & Constraints

**Always:** Preserve tenant and role authorization; retrieve only the tenant's registered gatehouses; validate a submitted gatehouse belongs to the current tenant before recording an event; make the selected gatehouse explicit before an access event is recorded; retain current QR/manual/package workflows, directions, error handling, and accessibility; use the existing ControlEasy components and ledger visual language; test request payloads and no-gatehouse states.

**Ask First:** Adding a new backend endpoint, changing database schema, altering access-event history, or changing existing roles/permissions.

**Never:** Infer a gatehouse from a device, write cross-tenant data, silently assign a gatehouse the attendant did not select, or expose connection parameters. Do not change product data outside the isolated demo stack.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Active gatehouse | Tenant has one or more gatehouses; attendant selects one | Operator desk names the active gatehouse; scan, manual entry, and package drop include its ID | Retain selection across browser restarts until the operator changes it or it becomes invalid |
| No gatehouse | Tenant has no registered gatehouses | Desk explains that an operational location is needed and links an authorized admin to configuration | Disable new access-recording actions; never fabricate or submit a null location |
| Gatehouse retrieval failure | GET gatehouses fails | Context identifies that location data is unavailable | Show a concise non-blocking error and keep location-bound actions disabled |
| Invalid gatehouse submission | Request contains missing, unknown, or foreign gatehouse ID | Backend rejects the record before persistence | Return the established validation/authorization ProblemDetails; never write a cross-tenant reference |
| Device health empty | Gatehouses exist but no devices | Health view names registered locations and links to device registration | Keep standard no-devices message |

</frozen-after-approval>

## Code Map

- `src/Web/ControlEasyReborn.Web/src/app/features/access-control/gateway-control.service.ts` — access-event request seam.
- `src/Web/ControlEasyReborn.Web/src/app/features/access-control/qr-scan.page.ts` — QR payload construction.
- `src/Web/ControlEasyReborn.Web/src/app/features/access-control/manual-lookup.page.ts` — manual-event payload construction.
- `src/Web/ControlEasyReborn.Web/src/app/features/gatehouse/gatehouse-panel.page.ts` — operator context selector and package-drop payload.
- `src/Web/ControlEasyReborn.Web/src/app/features/devices/devices-health.page.ts` — discoverability after registration.
- `src/Modules/AccessControl/**` — tenant-safe validation before persisting the selected gatehouse ID.
- `src/Modules/Security/**` and generated Web API client — accurate gatehouse endpoint response types.
- `src/Web/ControlEasyReborn.Web/src/app/layout/sidebar/sidebar.component.ts` and icon registration — navigation icon failure.
- `AGENTS.md`, `.planning/v2.3-MILESTONE-AUDIT.md`, and generated OpenAPI files — truthful repository state.

## Tasks & Acceptance

**Execution:**

- [x] Add a focused tenant-scoped gatehouse-context service and tests; it loads the existing security endpoint, holds a deliberate active selection, and clears stale saved selections when the signed-in tenant/profile changes or a gatehouse disappears.
- [x] Update the Gatehouse panel to present and change operational location accessibly; bind QR, manual lookup, and package-drop record calls to that context, and disable those actions with an explanation until a location is selected.
- [x] Add module-local, tenant-aware gatehouse validation to the access-control record handlers so missing, unknown, and foreign IDs are rejected before persistence.
- [x] Improve the Device health empty state so registered gatehouses and the device-registration route are actionable.
- [x] Register the sidebar activity icon and add regression coverage for the rendered navigation.
- [x] Declare concrete gatehouse endpoint responses, synchronize generated OpenAPI sources with the committed contract, remove stale plugin instructions, and amend the audit to record the prior integration gap and its verification.
- [x] Run focused Angular tests, the canonical Web SPA gate, Playwright desktop/mobile inspection, Impeccable detector, and the full local CI gate before committing independent documentation/maintenance changes and the feature change.

**Acceptance Criteria:**

- Given an administrator has registered two gatehouses, when an attendant opens the Gatehouse panel, then both are available in an accessible location selector and the selected name is shown in the working context.
- Given an attendant has selected a gatehouse, when the browser is closed and later reopened for the same tenant and profile, then the still-valid selection is restored.
- Given a gatehouse is selected, when the attendant records a QR scan, manual lookup, or package drop, then the request includes that exact gatehouse ID.
- Given no gatehouses exist or location data cannot load, when an attendant opens the panel or health page, then the UI explains the next authorized configuration step and prevents a location-less record.
- Given a request supplies a gatehouse outside the current tenant, when the backend records an access event, then it rejects the request and persists no event.
- Given the sidebar renders Device health, when an authorized user signs in, then no missing-icon console error is emitted.

## Design Notes

The active location is working context, not a decorative filter: render it adjacent to the operator panel title, use a compact labelled selector, and retain warm-paper/ledger visual hierarchy. The device health empty state should link directly to the Door Integration section rather than making operators decipher a textual path.

## Verification

**Commands:**

- `npm test -- --no-watch --browsers=ChromeHeadlessNoSandbox` — focused and full Angular suites pass.
- `npm run lint` — no ESLint errors.
- `scripts/verify-ci-local.ps1` — six-stage local CI gate passes with no generated drift.
- Playwright against the isolated demo stack — active gatehouse is visible and passed into each record operation.

## Suggested Review Order

**Operational context**

- Start with the tenant/profile-scoped durable selection and stale-context safeguards.
  [`gatehouse-context.service.ts:14`](../../src/Web/ControlEasyReborn.Web/src/app/features/access-control/gatehouse-context.service.ts#L14)

- Review the visible selector, readiness status, retry path, and authorization-aware guidance.
  [`gatehouse-panel.page.ts:100`](../../src/Web/ControlEasyReborn.Web/src/app/features/gatehouse/gatehouse-panel.page.ts#L100)

**Backend boundary**

- Required API contracts make missing operational location invalid for every client.
  [`AccessControlDtos.cs:9`](../../src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Contracts/AccessControlDtos.cs#L9)

- Scan handling validates tenant ownership before any access-event persistence.
  [`RecordAccessScanHandler.cs:92`](../../src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Handlers/RecordAccessScanHandler.cs#L92)

- Manual and package handling applies the same defense-in-depth boundary.
  [`RecordManualAccessHandler.cs:74`](../../src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Handlers/RecordManualAccessHandler.cs#L74)

- Security owns the concrete tenant-aware gatehouse lookup implementation.
  [`GatehouseAccessValidator.cs:12`](../../src/Modules/Security/ControlEasyReborn.Modules.Security.Infrastructure/Services/GatehouseAccessValidator.cs#L12)

**Discoverability and evidence**

- Device health names registered locations and surfaces retrieval failures with retry.
  [`devices-health.page.ts:110`](../../src/Web/ControlEasyReborn.Web/src/app/features/devices/devices-health.page.ts#L110)

- Browser-restart persistence is locked by focused storage regression coverage.
  [`gatehouse-context.service.spec.ts:53`](../../src/Web/ControlEasyReborn.Web/src/app/features/access-control/gatehouse-context.service.spec.ts#L53)

- Cross-tenant endpoint coverage proves rejection without access-event persistence.
  [`QrScanEndpointsTests.cs:205`](../../tests/ControlEasyReborn.IntegrationTests/AccessControl/QrScanEndpointsTests.cs#L205)
