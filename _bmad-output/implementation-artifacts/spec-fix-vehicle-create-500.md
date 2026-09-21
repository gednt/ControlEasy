---
title: 'Fix vehicle creation 500'
type: 'bugfix'
created: '2026-09-20'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'b70363c7693d9193e676dcb09cf8e1a93d760e10'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Submitting the Add Vehicle form fails with an HTTP 500 and the generic error page. This prevents gatehouse or administrative staff from registering vehicles, despite the form accepting the selected vehicle type as normal user input.

**Approach:** Make every vehicle-creation UI request match the API's numeric `VehicleType` enum representation, then prove form-shaped requests create a record successfully. Preserve the existing REST route, validation rules, tenant boundaries, and user-facing fields.

## Boundaries & Constraints

**Always:** Keep vehicle creation tenant-scoped through the existing `ITenantAwareLinqFactory`; return RFC 7807 validation errors for invalid input; preserve all existing vehicle types and their numeric values; use the existing Angular standalone, signals, OnPush, and reactive-form conventions; add regression coverage for the actual form payload.

**Ask First:** Adding new vehicle type values, changing the public route or DTO shape beyond the enum wire format, altering database schema/migrations, or expanding the vehicle form to select an owner resident.

**Never:** Do not weaken authorization, bypass backend validation, store UI-only string labels in the database, or change unrelated vehicle listing/edit/photo behaviour.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Vehicle type selected | Management or inline form posts a selected vehicle type such as `0` for Car | API binds the numeric enum value and returns `201 Created`; the new vehicle appears in the intended flow | N/A |
| Vehicle type omitted | Form posts `null` or no type | API retains the existing default of Car and returns `201 Created` | N/A |
| Invalid vehicle data | Missing/oversized plate or invalid referenced apartment | API returns RFC 7807 `400`/`404`, and the form retains input with a recoverable message | Existing validation/error presentation |

</frozen-after-approval>

## Code Map

- `src/Web/ControlEasyReborn.Web/src/app/features/vehicles/vehicles.page.ts` -- Reactive create/edit forms currently use string option values and pass them into the API request.
- `src/Web/ControlEasyReborn.Web/src/app/features/vehicles/vehicles-api.service.ts` -- Handwritten frontend DTO declares the vehicle type as a string although the API DTO is an enum.
- `src/Web/ControlEasyReborn.Web/src/app/features/access-control/access-credentials.page.ts` -- Inline credential flow has a second vehicle-create request using a string label instead of the enum value.
- `src/Modules/Vehicles/ControlEasyReborn.Modules.Vehicles.Application/Contracts/VehicleDtos.cs` -- Canonical `CreateVehicleRequest` and `VehicleType` API contract.
- `src/Modules/Vehicles/ControlEasyReborn.Modules.Vehicles.Api/Endpoints/VehicleEndpoints.cs` -- Authenticated create route whose JSON binding must accept the corrected request.
- `tests/ControlEasyReborn.IntegrationTests/VehicleEndpointTests.cs` -- API regression coverage for successful vehicle creation.
- `src/Web/ControlEasyReborn.Web/src/app/features/vehicles/vehicles.page.spec.ts` -- Browser-level regression coverage for the Add Vehicle request shape.

## Tasks & Acceptance

**Execution:**

- [x] `src/Web/ControlEasyReborn.Web/src/app/features/vehicles/vehicles-api.service.ts` -- align the frontend vehicle-type request type with the numeric API enum -- prevents selected form values from being serialized as incompatible strings.
- [x] `src/Web/ControlEasyReborn.Web/src/app/features/vehicles/vehicles.page.ts` -- bind vehicle-type options and submit values as numbers while retaining label rendering -- makes the real Add Vehicle interaction produce the API contract.
- [x] `src/Web/ControlEasyReborn.Web/src/app/features/access-control/access-credentials.page.ts` -- submit the existing Car default as enum value `0` -- keeps inline vehicle creation compatible with the same API contract.
- [x] `src/Web/ControlEasyReborn.Web/src/app/features/vehicles/vehicles.page.spec.ts` -- add a focused browser regression test that selects a type and asserts the POST body -- guards the user-observed failure.
- [x] `tests/ControlEasyReborn.IntegrationTests/VehicleEndpointTests.cs` -- assert numeric vehicle-type creation returns `201` and preserves the type -- verifies the server contract.

**Acceptance Criteria:**

- Given a writer opens Add Vehicle and selects Motorcycle, when they submit valid details, then the API receives numeric `vehicleType: 1`, returns `201 Created`, and the UI advances to the existing photo step without a generic 500.
- Given a writer leaves vehicle type blank, when they submit valid details, then a Car is created using the existing default behaviour.
- Given a gatehouse user creates the inline vehicle needed for an access credential, when the default Car type is used, then that request also sends numeric `vehicleType: 0` and succeeds.
- Given a server-side validation error, when the Add Vehicle request fails, then the page displays a recoverable form error and does not silently lose the entered values.

## Spec Change Log

## Verification

**Commands:**

- `dotnet test tests/ControlEasyReborn.IntegrationTests --filter FullyQualifiedName~VehicleEndpointTests` -- expected: vehicle create cases pass with `201 Created`.
- `npm test -- --no-watch --browsers=ChromeHeadless --include=src/app/features/vehicles/vehicles.page.spec.ts` -- expected: selected type POST body uses a number and the request succeeds.
- `scripts/verify-ci-local.sh` -- expected: full local CI suite passes before commit.

## Suggested Review Order

**Vehicle request contract**

- Use the generated numeric enum type in handwritten vehicle request shapes.
  [`vehicles-api.service.ts:4`](../../src/Web/ControlEasyReborn.Web/src/app/features/vehicles/vehicles-api.service.ts#L4)

- Bind option values as numbers so the create and edit forms serialize correctly.
  [`vehicles.page.ts:15`](../../src/Web/ControlEasyReborn.Web/src/app/features/vehicles/vehicles.page.ts#L15)

**Secondary creation flow**

- Send the same numeric Car value when credential issuance creates a vehicle inline.
  [`access-credentials.page.ts:1623`](../../src/Web/ControlEasyReborn.Web/src/app/features/access-control/access-credentials.page.ts#L1623)

**Regression coverage and neutral fixtures**

- Assert the Add Vehicle form posts a numeric vehicle type.
  [`vehicles.page.spec.ts:51`](../../src/Web/ControlEasyReborn.Web/src/app/features/vehicles/vehicles.page.spec.ts#L51)

- Prove the API accepts numeric enum payloads and returns the selected type.
  [`VehicleEndpointTests.cs:35`](../../tests/ControlEasyReborn.IntegrationTests/VehicleEndpointTests.cs#L35)

- Replace the requested resident and apartment fixture data with neutral values.
  [`access-credentials.page.spec.ts:83`](../../src/Web/ControlEasyReborn.Web/src/app/features/access-control/access-credentials.page.spec.ts#L83)
