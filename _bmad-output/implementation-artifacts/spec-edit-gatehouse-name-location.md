---
title: 'Edit gatehouse name and location'
type: 'feature'
created: '2026-10-11'
status: 'done'
review_loop_iteration: 0
baseline_commit: '1807ec5666f3e3cbdcda52998959d641c32119ab'
context:
  - '{project-root}/AGENTS.POLICY.md'
  - '{project-root}/AGENTS.STACK.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Administrators can register, disable, and re-enable a gatehouse, but cannot correct or update its name and location. Incorrect labels then propagate into operator location selection and device administration without a supported correction path.

**Approach:** Add a tenant-scoped, authorized gatehouse update operation and an inline edit flow in Administration > Door Integration. Editing changes only the gatehouse name and optional location while preserving its identity, lifecycle state, assignments, and history.

## Boundaries & Constraints

**Always:** Require a non-blank name of at most 120 characters; allow location to be cleared or set up to 500 characters; trim submitted values; use the existing `devices.write` permission; resolve the record through tenant-aware persistence; return the updated gatehouse contract; keep active and inactive gatehouses editable; surface pending, validation, and persistence feedback accessibly; immediately refresh every name/location projection held by the Administration component.

**Ask First:** Changing uniqueness rules, renaming historical snapshots that intentionally store text rather than a gatehouse reference, changing gatehouse activation, or broadening edit permission beyond the existing gatehouse-management permission.

**Never:** Replace the gatehouse ID, create a second record, alter device or attendant assignments, disclose a foreign tenant's record, allow operators without management permission to edit, or report success before persistence succeeds.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Edit details | Tenant administrator submits a trimmed valid name and location | Existing row and all live UI projections show the new values; ID and active state are unchanged | N/A |
| Clear location | Location contains only whitespace or is intentionally emptied | Persist and return `null`; UI omits the secondary location line | N/A |
| Invalid name or location | Blank name, name over 120 characters, or location over 500 characters | No update is persisted | Return validation ProblemDetails and retain the edit form values for correction |
| Tenant boundary | Caller targets another tenant's or unknown gatehouse ID | No row is changed and ownership is not disclosed | Return `404` |
| Save failure | API or persistence fails while editing | Existing displayed record remains authoritative and form stays open | Show concise inline error and allow retry/cancel |
| Concurrent lifecycle change | Gatehouse activation changes separately while details are edited | Details update without overwriting activation state | Return the server's current complete gatehouse response |

</frozen-after-approval>

## Code Map

- `src/Modules/Security/ControlEasyReborn.Modules.Security.Domain/Entities/Gatehouse.cs` -- add the domain operation that normalizes editable details without changing identity or lifecycle.
- `src/Modules/Security/ControlEasyReborn.Modules.Security.Application/Contracts/SecurityDtos.cs`, `Validators/`, `Handlers/` -- define, validate, and execute the update request through the tenant-scoped repository.
- `src/Modules/Security/ControlEasyReborn.Modules.Security.Infrastructure/Persistence/GatehouseRepository.cs` -- harden the existing unused details update path with tenant checks, nullable-location persistence, and failed-write handling.
- `src/Modules/Security/ControlEasyReborn.Modules.Security.Api/Endpoints/SecurityEndpoints.cs` and infrastructure DI -- expose the authorized `PUT /api/v1/security/gatehouses/{id}` endpoint and register its handler/validator.
- `tests/ControlEasyReborn.UnitTests/Modules/Security/` and `tests/ControlEasyReborn.IntegrationTests/SecurityEndpointTests.cs` -- cover normalization, persistence, validation, permission, tenant isolation, and lifecycle preservation.
- `src/Web/ControlEasyReborn.Web/src/app/features/devices/components/door-integration-section.component.ts` -- add accessible inline Edit/Save/Cancel behavior within each gatehouse ledger row.
- `src/Web/ControlEasyReborn.Web/src/app/features/administration/administration.page.spec.ts` -- verify edit population, save payload/result propagation, clearing location, cancellation, and failure behavior.
- `src/Web/ControlEasyReborn.Web/src/app/api/` -- regenerate the Angular client from the final OpenAPI contract.

## Tasks & Acceptance

**Execution:**
- [x] Add the update contract, shared field validation, domain behavior, handler, and DI registration so create and edit enforce consistent name/location rules.
- [x] Make repository detail updates tenant-safe and failure-aware, preserving `Active` and nullable `Location` semantics.
- [x] Map an authorized update endpoint that returns typed success, validation, and not-found responses; regenerate the Web API client.
- [x] Add a single-row inline edit mode with prefilled values, explicit Save/Cancel actions, disabled conflicting row actions while saving, and inline error feedback that preserves user input.
- [x] Add focused backend, integration, and Angular regression tests for every matrix scenario.
- [x] Run the Web SPA gate, Impeccable detector, real-browser desktop/mobile smoke check, fast gate, and full local CI gate.

**Acceptance Criteria:**
- Given a tenant administrator views an active or inactive gatehouse, when they edit its valid name and location, then the same record displays the persisted values without changing its ID, active state, or assignments.
- Given another operational surface reloads after a rename, when it retrieves gatehouses, then it displays the new server-provided name and location.
- Given a caller lacks `devices.write`, when they submit an edit, then the API rejects it and persists no changes.

## Spec Change Log

## Design Notes

Keep editing in the existing ruled gatehouse row so the administrator retains status context. Only one row enters edit mode at a time; its text presentation becomes two labelled fields and Save/Cancel controls. Preserve the Shift Ledger visual system: paper fields, visible record lines, compact mono labels, and no modal or decorative card layer for this small correction task.

## Verification

**Commands:**
- Focused `dotnet test` filters for Security gatehouse tests -- expected: all update, validation, tenant-isolation, and lifecycle assertions pass.
- Focused Angular `administration.page.spec.ts` run -- expected: edit interaction and error-state tests pass.
- Canonical containerized `npm run lint` and Karma Web SPA gate -- expected: lint exits 0 and every `TOTAL` result is `SUCCESS`.
- `.opencode/skills/impeccable/scripts/impeccable.cmd detect --json <changed UI targets>` -- expected: no unresolved applicable findings.
- `scripts/verify-ci-local.ps1 -Fast`, followed by `scripts/verify-ci-local.ps1` -- expected: both repository gates pass with no OpenAPI drift.
- Real-browser smoke test through the `webapp-testing` skill -- expected: editing works with keyboard and pointer at desktop and mobile widths, including validation, cancel, and retry states.

**Results:**
- Final focused Administration suite passed (`23/23`); canonical Gitea-runner ESLint and full Karma gate passed (`434/434`).
- Final Impeccable detector returned `[]`.
- Final browser smoke passed desktop edit/cancel/save focus restoration and mobile edit/cancel focus restoration at 390 px with zero page or console errors.
- Final fast gate passed with a zero-warning Release build, `299/299` unit tests, and `20/20` architecture tests.
- Final full gate passed all six stages: format, zero-warning Release build, `299/299` unit tests, `20/20` architecture tests, `202/202` integration tests, production Web build, and OpenAPI drift. Stage 6 used an isolated temporary Git index containing the intended generated API tree so the real index remained untouched while regeneration was compared to the final task output.

## Suggested Review Order

**Tenant-safe mutation boundary**

- Start with the authorized HTTP contract and typed response boundary.
  [`SecurityEndpoints.cs:228`](../../src/Modules/Security/ControlEasyReborn.Modules.Security.Api/Endpoints/SecurityEndpoints.cs#L228)

- Validation, lookup, persistence, and authoritative lifecycle re-read converge here.
  [`UpdateGatehouseHandler.cs:8`](../../src/Modules/Security/ControlEasyReborn.Modules.Security.Application/Handlers/UpdateGatehouseHandler.cs#L8)

- Tenant-scoped writes preserve nullable location and reject failed persistence.
  [`GatehouseRepository.cs:79`](../../src/Modules/Security/ControlEasyReborn.Modules.Security.Infrastructure/Persistence/GatehouseRepository.cs#L79)

**Domain and client contract**

- Domain normalization preserves identity and lifecycle while clearing blank locations.
  [`Gatehouse.cs:21`](../../src/Modules/Security/ControlEasyReborn.Modules.Security.Domain/Entities/Gatehouse.cs#L21)

- Generated client exposes the required-name update request and exact PUT path.
  [`api-v-1-security-gatehouses-id-put.ts:18`](../../src/Web/ControlEasyReborn.Web/src/app/api/fn/security/api-v-1-security-gatehouses-id-put.ts#L18)

**Administration interaction**

- Inline ledger-row editing keeps status context and locks conflicting actions.
  [`door-integration-section.component.ts:120`](../../src/Web/ControlEasyReborn.Web/src/app/features/devices/components/door-integration-section.component.ts#L120)

- Save/cancel behavior normalizes inputs, refreshes projections, and restores focus.
  [`door-integration-section.component.ts:835`](../../src/Web/ControlEasyReborn.Web/src/app/features/devices/components/door-integration-section.component.ts#L835)

**Regression evidence**

- Integration coverage proves validation, authorization, tenant isolation, and lifecycle preservation.
  [`SecurityEndpointTests.cs:233`](../../tests/ControlEasyReborn.IntegrationTests/SecurityEndpointTests.cs#L233)

- Angular coverage exercises focus, cancel, persistence, clearing, concurrency, and HTTP errors.
  [`administration.page.spec.ts:506`](../../src/Web/ControlEasyReborn.Web/src/app/features/administration/administration.page.spec.ts#L506)

- Validator coverage locks blank, trimmed-length, and overlong-name boundaries.
  [`GatehouseRequestValidatorTests.cs:38`](../../tests/ControlEasyReborn.UnitTests/Modules/Security/GatehouseRequestValidatorTests.cs#L38)
