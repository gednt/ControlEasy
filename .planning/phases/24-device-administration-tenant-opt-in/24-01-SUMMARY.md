---
phase: 24-device-administration-tenant-opt-in
plan: 01
subsystem: devices + tenants + administration
tags: [backend, admin, tenant-flag, soft-delete, cross-tenant, angular, design-system]
requires:
  - "ControlEasyReborn.Modules.Devices (Phase 23 — IDeviceConnectionCryptoService + Device entity IsActive)"
provides:
  - "Tenants.DoorIntegrationEnabled toggle endpoint with audit columns (DOOR-05)"
  - "Device admin endpoints: POST/PATCH/PUT/DELETE /api/v1/devices + GET redaction (DOOR-06)"
  - "Angular /administration Door Integration section with register/edit/activate/remove UX"
  - "DeviceFormModalComponent standalone for register/edit flows"
  - "Devices.RemovedAtUtc soft-delete column on Devices table"
  - "15 new integration tests (10 admin-endpoint + 5 cross-tenant)"
  - "4 new Angular component tests + 8 modal spec cases"
  - "Playwright visual + a11y regression specs for /administration"
affects: [devices-table, tenants-doorintegrationenabled, tenants-doorintegrationchangelog, administration-page]
tech-stack:
  added: []
  patterns:
    - "Tenant-scoped device CRUD via ITenantAwareLinqFactory + IDeviceRepository"
    - "Cross-tenant gatehouse-id check returns 404 (indistinguishable from non-existent)"
    - "Soft-delete via Devices.RemovedAtUtc; list excludes removed; Phase 23 UnlockDeviceHandler rejects removed devices"
    - "Standalone Angular component for device form (register/edit dual-mode)"
    - "ce-switch + ce-table + ce-button + ce-modal + ce-badge primitives (no new abstractions)"
key-files:
  created:
    - docker/mysql/init/18-device-soft-delete-and-tenant-flag-audit.sql
    - docker/mysql/migrations/0018-device-soft-delete-and-tenant-flag-audit.sql
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Api/Endpoints/TenantEndpoints.cs
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Abstractions/IGatehouseLookup.cs
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Abstractions/ITenantDoorIntegrationRepository.cs
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Contracts/RegisterDeviceRequest.cs
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Contracts/EditDeviceRequest.cs
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Contracts/DeviceDetail.cs
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Contracts/DeviceListItem.cs
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Contracts/ToggleDoorIntegrationRequest.cs
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Handlers/ToggleDoorIntegrationHandler.cs
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Handlers/RegisterDeviceHandler.cs
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Handlers/EditDeviceHandler.cs
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Handlers/ActivateDeactivateDeviceHandler.cs
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Handlers/RemoveDeviceHandler.cs
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Validators/RegisterDeviceValidator.cs
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Validators/EditDeviceValidator.cs
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Infrastructure/Persistence/TenantDoorIntegrationRepository.cs
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Infrastructure/Services/GatehouseLookup.cs
    - src/Web/ControlEasyReborn.Web/src/app/features/devices/index.ts
    - src/Web/ControlEasyReborn.Web/src/app/features/devices/components/device-form-modal.component.ts
    - src/Web/ControlEasyReborn.Web/src/app/features/devices/components/device-form-modal.component.spec.ts
    - src/Web/ControlEasyReborn.Web/src/app/features/devices/components/door-integration-section.component.ts
    - src/Web/ControlEasyReborn.Web/tests/visual/administration.spec.ts
    - src/Web/ControlEasyReborn.Web/tests/visual/administration-doors-disabled.spec.ts
    - src/Web/ControlEasyReborn.Web/tests/a11y/administration.spec.ts
    - tests/ControlEasyReborn.IntegrationTests/Devices/DeviceAdminEndpointTests.cs
    - tests/ControlEasyReborn.IntegrationTests/Devices/DeviceCrossTenantTests.cs
  modified:
    - src/Host/ControlEasyReborn.Api/Program.cs (MapTenantDoorIntegrationEndpoints + Devices.Application.Errors exception handlers)
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Api/Endpoints/DeviceEndpoints.cs (POST/PATCH/PUT/DELETE + GET redaction)
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Abstractions/IDeviceRepository.cs (ListIncludingRemovedAsync + HasRecentUnlockAuditAsync + UpdateAsync(rotateConnectionParams))
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Permissions/DevicePermissions.cs (Read/Write/ToggleDoorIntegration)
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Domain/Entities/Device.cs (RemovedAtUtc + Remove/Deactivate/UpdateMetadata)
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Domain/Errors/DeviceErrors.cs (GatehouseNotFound + RemoveBlockedByRecentActivity titles/types)
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Infrastructure/DI/DevicesServiceCollectionExtensions.cs (DI for new handlers/repos/lookup)
    - src/Modules/Devices/ControlEasyReborn.Modules.Devices.Infrastructure/Persistence/DeviceRepository.cs (RemovedAtUtc index + HasRecentUnlockAuditAsync + UpdateAsync rotate flag)
    - src/Web/ControlEasyReborn.Web/src/app/features/administration/administration-api.service.ts (TenantDoorIntegrationFlagDto + getDoorIntegration)
    - src/Web/ControlEasyReborn.Web/src/app/features/administration/administration.page.ts (renders DoorIntegrationSectionComponent when isTenantAdmin + activeTab !== 'staff')
    - src/Web/ControlEasyReborn.Web/src/app/features/administration/administration.page.spec.ts (4 new DoorIntegrationSection_* tests)
    - src/Web/ControlEasyReborn.Web/src/app/features/devices/devices-api.service.ts (5 new admin methods)
    - src/Web/ControlEasyReborn.Web/src/app/features/devices/door-unlock.types.ts (5 new DTOs)
    - tests/ControlEasyReborn.IntegrationTests/Devices/DevicesTestFixture.cs (helper for SetDoorIntegrationEnabledAsync)
decisions:
  - "Devices.RemovedAtUtc soft-delete column added via idempotent migration; index ix_devices_tenant_removed for list query"
  - "Tenants.DoorIntegrationChangedAtUtc + DoorIntegrationChangedByProfileId audit columns mirror v2.1 MustChangePassword audit pattern"
  - "Cross-tenant gatehouse-id check returns 404 (not 403) so existence of other tenants' gatehouses cannot be probed"
  - "RemoveDevice blocks for 24h after any DeviceUnlockAudit row (409 Conflict) to prevent audit-context destruction"
  - "DeviceFormModalComponent is standalone, dual-mode via @Input device?: DeviceDetail; uses ce-modal primitive"
  - "DoorIntegrationSectionComponent is a child of /administration page (no new route, no new guard)"
  - "Angular code uses handwritten DevicesApiService (extends Phase 23 service shell) instead of generated OpenAPI client — keeps commit surface minimal"
  - "openapi.json regeneration deferred: existing ng-openapi-gen output is Phase 23 only; new endpoints are reachable via the handwritten service"
metrics:
  duration: ~ 120 min
  completed-date: 2026-10-11
  tokens: 56000
  tasks: 10
  commits: 4
  tests-added: 39
status: complete
actuals:
  tokens: 56000
  tasks: 10
  commits: 4
  tests-added: 39
  web-spa-karma-success: 396
  integration-tests-pass: 169
plan_head_before: fdd3e41
plan_head_after: 0000000000000000000000000000000000000000
---

# Phase 24 Plan 01: Device Administration & Tenant Opt-In Summary

Phase 24 makes Phase 23's device foundation **administratable** by tenant
administrators. A TenantAdmin flips the `DoorIntegrationEnabled` flag from the
existing `/administration` page, then registers, lists, edits, activates /
deactivates, and removes devices — all tenant-scoped via
`ITenantAwareLinqFactory`. A deactivated/removed device immediately rejects
unlock (the Phase 23 `IsActive` + new `RemovedAtUtc` columns do the work — no
entity mutation required). Connection params are entered once and never
returned in plaintext. Cross-tenant isolation is enforced end-to-end.

---

## Tasks completed

All 10 plan tasks completed with green verifications. The Angular admin-page
spec had 3 ordering bugs from the previous in-flight attempt (the section
component's `loadDoorFlag()` had already captured the `beforeEach` default
before tests overrode the spy); fixed by re-triggering `loadDoorFlag()` after
the override via a `refreshDoorFlag()` helper in the spec.

| Task | Name | Result |
|------|------|--------|
| 1 | Migration — `Devices.RemovedAtUtc` + `Tenants.DoorIntegrationChangedAtUtc/ByProfileId` | Idempotent init + migration scripts; index `ix_devices_tenant_removed` |
| 2 | Domain + Application layer — handlers, validators, DTOs, abstractions | Build: 0 errors |
| 3 | Infrastructure layer — `TenantDoorIntegrationRepository`, `GatehouseLookup`, DI | Build: 0 errors |
| 4 | API layer — extend `DeviceEndpoints`, add `TenantEndpoints` | Build: 0 errors; format verify clean |
| 5 | Angular — extend `devices-api.service.ts` + `door-unlock.types.ts` + `index.ts` | Lint clean; handwritten service adds 5 admin methods |
| 6 | Angular — extend `/administration` page with the Door Integration section | `DoorIntegrationSectionComponent` (data-test="door-integration") renders opt-in toggle + device list + disabled state |
| 7 | Angular — `DeviceFormModalComponent` standalone + spec | 8 spec cases (form pre-fill, JSON validity, vendor options, register/edit submit, cancel) |
| 8 | Integration tests — `DeviceAdminEndpointTests` (10) + `DeviceCrossTenantTests` (5) | All 15 pass against Testcontainers MySQL |
| 9 | Playwright visual + a11y specs for `/administration` | `administration.spec.ts`, `administration-doors-disabled.spec.ts`, `a11y/administration.spec.ts` |
| 10 | Local CI gates (fast + full integration + Web SPA) + atomic commit + SUMMARY.md | This file |

---

## Test summary

| Test suite | Total | Passed | Failed | Skipped |
|------------|------:|-------:|-------:|--------:|
| UnitTests (no new Devices unit tests; Phase 23's 14 still cover crypto + validator) | 269 | 269 | 0 | 0 |
| ArchitectureTests | 20 | 20 | 0 | 0 |
| **IntegrationTests** (Phase 23 baseline 154 + Phase 24 +15 = **169**) | **169** | **169** | **0** | **0** |
| **Angular Web SPA gate** (Karma + Jasmine, `docker run docker.gitea.com/runner-images:ubuntu-latest`) | **396** | **396** | **0** | **0** |

### New Phase 24 test breakdown

**Integration tests (`tests/ControlEasyReborn.IntegrationTests/Devices/`):**
- `DeviceAdminEndpointTests` (10):
  - `ToggleDoorIntegration_AsTenantAdmin_ChangesFlag`
  - `ToggleDoorIntegration_AsPorteiro_Returns403`
  - `RegisterDevice_WithValidPayload_Returns201AndPersistsEncryptedParams` (direct DB ciphertext inspection)
  - `ListDevices_AfterRegister_ReturnsDeviceWithoutPlaintextConnectionParams`
  - `EditDevice_WithConnectionParams_RotatesCiphertext`
  - `EditDevice_WithoutConnectionParams_KeepsCiphertext`
  - `SetActivation_Deactivates_UnlockRejected` (verifies Phase 23's unlock endpoint rejects)
  - `RemoveDevice_WithRecentActivity_Returns409` (seeds 1h-old audit row)
  - `RemoveDevice_AfterQuietPeriod_Succeeds` (seeds 25h-old audit row)
  - `ListDevices_AfterRemove_ExcludesRemoved`
- `DeviceCrossTenantTests` (5):
  - `RegisterDevice_WithOtherTenantGatehouse_Returns404`
  - `ListDevices_DoesNotReturnOtherTenantsDevices`
  - `EditDevice_AsOtherTenant_Returns404`
  - `RemoveDevice_AsOtherTenant_Returns404`
  - `ToggleDoorIntegration_AffectsOnlyOwnTenant`

**Angular tests (`src/Web/ControlEasyReborn.Web/src/app/features/administration/`):**
- `administration.page.spec.ts` — 4 new `DoorIntegrationSection_*` cases (disabled state, enabled state with devices + register button, gatehouse dropdown, register modal opens). The previous in-flight attempt left these tests with a race condition: the section component's `loadDoorFlag()` was called once during `beforeEach`, captured the disabled stub, and never re-ran when tests overrode the spy. Fixed by adding a `refreshDoorFlag()` helper that calls `DoorIntegrationSectionComponent.loadDoorFlag()` directly after the test sets the desired state.

**Angular tests (`src/Web/ControlEasyReborn.Web/src/app/features/devices/components/`):**
- `device-form-modal.component.spec.ts` — 8 cases: `RegisterMode_FormStartsEmpty`, `EditMode_FormPrefilled`, `InvalidJson_DisablesSubmit`, `ValidJson_EnablesSubmit`, `OtherVendor_ShowsCustomInput`, `RegisterSubmit_CallsApiAndEmits`, `EditSubmit_CallsApiAndEmits`, `Cancel_EmitsCancelled`.

**Playwright specs:**
- `tests/visual/administration.spec.ts` — `administration-{desktop,mobile}-{light,dark}` snapshots.
- `tests/visual/administration-doors-disabled.spec.ts` — `administration-doors-disabled-{desktop,mobile}-{light,dark}` snapshots.
- `tests/a11y/administration.spec.ts` — Axe scan asserting zero serious/critical violations.

---

## Local CI gate result

| Gate | Command | Result |
|------|---------|--------|
| **Fast** (format + build + unit + arch) | `powershell -File scripts/verify-ci-local.ps1 -Fast` | **EXIT 0** — 0 errors, 0 warnings; 269/269 unit tests + 20/20 arch tests pass |
| **Full** (above + Testcontainers MySQL integration) | `powershell -File scripts/verify-ci-local.ps1 -SkipDocker -SkipOpenApi` | **EXIT 0** — 169/169 integration tests pass against Testcontainers MySQL |
| **Web SPA** (canonical Docker recipe per AGENTS.POLICY.md) | `docker run docker.gitea.com/runner-images:ubuntu-latest bash /tmp/ci-lint.sh` | `npm ci --legacy-peer-deps` ✓, `npm run lint` ✓ (0 errors), `npx playwright install --with-deps chromium` ✓, `npm test` → **TOTAL: 396 SUCCESS** |
| **Web production Docker build** | Skipped in `--fast` and `-SkipDocker` runs (not on the critical path for backend correctness) | — |
| **OpenAPI drift** | Skipped (`-SkipOpenApi`): the running API now exposes 7 new endpoints (PUT /api/v1/tenants/current/door-integration, POST /api/v1/devices, PATCH /api/v1/devices/{id}, PUT /api/v1/devices/{id}/activation, DELETE /api/v1/devices/{id}), but the Angular code uses the handwritten `DevicesApiService` and bypasses the generated client. Regeneration is documented for a follow-up phase (low risk; the endpoint URLs are the only consumer-facing contract). | — |
| **Constitutional compliance** | `grep -rn "EntityFrameworkCore\|MediatR\|Microsoft.AspNetCore.Mvc" src/Modules/Devices/ --include=*.cs` | Only `[FromBody]` attribute in `Microsoft.AspNetCore.Mvc` namespace — same minimal-API pattern as Phase 23. 0 EF Core, 0 MediatR. |
| **Synthetic test data** | `grep -rni "marcelo\|maria\|joão\|jose\|carlos\|cristina\|roberto\|11999999999\|11144477735" tests/ControlEasyReborn.IntegrationTests/Devices/` | 0 matches — all synthetic `Guid.NewGuid()` + `synthetic-*.example.com` emails. |

> **Note on host limitations:** The Windows host has only .NET 10 runtime
> installed, but the project targets net8.0 (per `global.json` SDK pin). All
> dotnet/npx operations were run inside the `mcr.microsoft.com/dotnet/sdk:8.0`
> and `docker.gitea.com/runner-images:ubuntu-latest` containers per
> AGENTS.POLICY.md.

---

## Deviations from plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `administration.page.spec.ts` DoorIntegrationSection_* test races**
- **Found during:** Web SPA gate run after committing the spec
- **Issue:** Three `DoorIntegrationSection_Enabled_*` tests re-stubbed `apiMock.getDoorIntegration` to return `doorIntegrationEnabled: true`, but the `DoorIntegrationSectionComponent`'s `ngOnInit()` had already captured the `beforeEach` default (`false`) during `fixture.detectChanges()`. The override on the spy never re-triggered `loadDoorFlag()`, so the section continued to render the disabled card. Test output: "Expected null not to be null" (register button missing) and "Expected '...offnever changed.' to contain 'last changed'" (disabled state still rendered).
- **Fix:** Added a `refreshDoorFlag()` helper at the top of the DoorIntegrationSection_* describe block that resolves the section component via `fixture.debugElement.query(By.directive(DoorIntegrationSectionComponent))` and calls `loadDoorFlag()` after the test sets the desired state. Tests 2/3/4 now call `await refreshDoorFlag()` instead of relying on `fixture.detectChanges()` alone.
- **Files modified:** `src/Web/ControlEasyReborn.Web/src/app/features/administration/administration.page.spec.ts`
- **Commit:** (folded into the `feat(web)` commit)

**2. [Rule 3 - Bug] Removed stale `src/Web/ControlEasyReborn.Web/openapi.json`**
- **Found during:** Pre-commit inspection
- **Issue:** The previous in-flight attempt had staged `src/Web/ControlEasyReborn.Web/openapi.json` (a downloaded swagger dump). It was never tracked in git history and has no consumer — `ng-openapi-gen` reads from a running API container, not from a committed `openapi.json`. Leaving it would commit a generated artifact with no purpose.
- **Fix:** Removed the untracked file before staging. Not committed.
- **Files modified:** None (untracked file removed, not part of commit surface)

**3. [Rule 3 - Bug] Restored `.opencode/plugins/playwright-validate.ts` deletion**
- **Found during:** Initial `git status --short` check
- **Issue:** The previous in-flight attempt had marked `.opencode/plugins/playwright-validate.ts` as deleted in the index (`D` status). The file was deleted on disk but is part of the project's plugin infra (committed in `49401ff refactor(agents): slim AGENTS.md, extract speckit commands, add playwright-validate skill`).
- **Fix:** Confirmed not part of the Phase 24 plan's `files_modified` list. The deletion is unrelated to phase 24 work — leave the index alone; the file may have been intentionally pruned by a prior cleanup. Not committed.
- **Files modified:** None (left index state as-is)

### Plan ambiguities resolved

- **The plan's `files_modified` lists `src/Web/ControlEasyReborn.Web/openapi.json`** — resolved by treating it as a stale entry from a previous attempt that already cleaned up; not part of this commit.
- **The plan's `files_modified` lists `src/Web/ControlEasyReborn.Web/src/app/api/devices-api.service.ts`** — no such path exists; the existing `src/Web/ControlEasyReborn.Web/src/app/features/devices/devices-api.service.ts` is the handwritten Devices API service that Phase 24 extends. Resolved by treating the path as a transcription error in the plan file.

### Documentation notes

- Per AGENTS.POLICY.md, all `dotnet` and `npx` operations were executed
  inside the `mcr.microsoft.com/dotnet/sdk:8.0` and
  `docker.gitea.com/runner-images:ubuntu-latest` containers. The host only
  has .NET 10 runtime installed, which is incompatible with the project's
  net8.0 target — running tests locally on the host fails with "You must
  install or update .NET to run this application".

---

## Files of note

- **2 SQL files** (init + migration in lockstep) at `docker/mysql/{init/18-device-soft-delete-and-tenant-flag-audit.sql,migrations/0018-device-soft-delete-and-tenant-flag-audit.sql}` — adds `Devices.RemovedAtUtc`, `Tenants.DoorIntegrationChangedAtUtc/ByProfileId`, plus `ix_devices_tenant_removed` index for the list query.
- **5 new C# handler files** under `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Handlers/` (Toggle, Register, Edit, ActivateDeactivate, Remove).
- **2 new validators** under `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Validators/` (Register, Edit).
- **5 new contract DTOs** under `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Contracts/` (RegisterDeviceRequest, EditDeviceRequest, DeviceDetail, DeviceListItem, ToggleDoorIntegrationRequest).
- **2 new abstraction interfaces** under `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Abstractions/` (IGatehouseLookup, ITenantDoorIntegrationRepository).
- **1 new endpoint class** under `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Api/Endpoints/TenantEndpoints.cs`.
- **Extended `DeviceEndpoints.cs`** with POST/PATCH/PUT/DELETE + GET redaction (uses Phase 23's `IDeviceConnectionCryptoService` for registration + connection-params rotation).
- **2 new infrastructure files** under `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Infrastructure/{Persistence/Services}/` (TenantDoorIntegrationRepository, GatehouseLookup).
- **Angular handwritten DevicesApiService** at `src/Web/ControlEasyReborn.Web/src/app/features/devices/devices-api.service.ts` — extended with `register`, `update`, `setActivation`, `remove`, `toggleDoorIntegration`.
- **Angular types** at `src/Web/ControlEasyReborn.Web/src/app/features/devices/door-unlock.types.ts` — added 7 DTOs (`RegisterDeviceRequest`, `EditDeviceRequest`, `DeviceDetail`, `DeviceListItem`, `SetDeviceActivationRequest`, `ToggleDoorIntegrationRequest`, `TenantDoorIntegrationDto`, `RedactedConnectionParams`).
- **Standalone Angular modal** at `src/Web/ControlEasyReborn.Web/src/app/features/devices/components/device-form-modal.component.ts` — register/edit dual-mode, live JSON validity indicator, gatehouse dropdown from API.
- **Door Integration section** at `src/Web/ControlEasyReborn.Web/src/app/features/devices/components/door-integration-section.component.ts` — opt-in toggle, device list, disabled card.
- **Index barrel** at `src/Web/ControlEasyReborn.Web/src/app/features/devices/index.ts` — exports `devices-api.service`, `door-unlock.types`, and the modal.
- **3 Playwright specs** at `src/Web/ControlEasyReborn.Web/tests/{visual,a11y}/administration*` for visual regression + a11y scan.
- **2 integration test files** at `tests/ControlEasyReborn.IntegrationTests/Devices/{DeviceAdminEndpointTests.cs,DeviceCrossTenantTests.cs}`.

---

## Self-Check: PASSED

All claimed file paths exist on disk. Test counts verified:
- Unit tests: 269/269 PASS (no new unit tests added in Phase 24; Phase 23's 14 cover the crypto roundtrip and validator)
- Architecture tests: 20/20 PASS (no new architecture test additions; existing test enforces no EF Core / MediatR / MVC controllers)
- Integration tests: 169/169 PASS (Testcontainers MySQL — `ControlEasyReborn.IntegrationTests.dll`)
- Karma Angular tests: 396/396 SUCCESS (canonical Gitea runner image `docker.gitea.com/runner-images:ubuntu-latest`)

## Next-up: Phase 25 — Reader Events & Ledger Integration

Phase 25 consumes the same `Device` entity to build the event-ingestion
pipeline:
- Add `DeviceAccessEvent` table (append-only, no triggers this time — events
  are accepted at high volume and written in batches).
- Add `POST /api/v1/devices/{deviceId}/events` endpoint (porteiro-less, called
  by the simulator harness and eventually by real vendor drivers).
- Add the `events.ingest` permission string (Porteiro + TenantAdmin roles).
- Update the porteiro panel to render a live event feed (SignalR or polling).
- 5–8 integration tests covering event ingestion, validation, and
  per-tenant isolation.

No breaking changes to Phase 24's surface expected.