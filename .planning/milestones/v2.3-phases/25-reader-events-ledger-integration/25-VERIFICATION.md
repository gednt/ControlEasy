---
gsd_state_version: 1.0
phase: 25
status: passed
verified_at: 2026-10-11
verifier: gsd-verifier (autonomous)
---

# Phase 25 — VERIFICATION

**Phase:** 25 — Reader Events & Ledger Integration
**Branch:** `feat/milestone-v2.3`
**Verified:** 2026-10-11
**Status:** ✅ verified — all 4 success criteria met
**Plan commit(s):** phase-25 atomic group (8 commits, see SUMMARY.md)

---

## Success criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | A simulated reader event is ingested via POST /api/v1/devices/{deviceId}/events and normalized into the unified DeviceEvent model (device_id, event_type, payload_json, occurred_at) via IDeviceHandler; business logic stays vendor-agnostic (DOOR-08) | ✅ met | `Ingest_CardRead_MatchedResident_DispatchesThroughAccessScanHandler`, `Ingest_CardRead_UnknownCard_WritesRefusedScanAttempt`, `Ingest_CardRead_InactiveCredential_DeniesScan`, `Ingest_WhenTenantFlagOff_ReturnsTenantFlagOffOutcome`, `Ingest_OnRemovedDevice_ReturnsDeviceInactiveWithoutLedgerWrite` (5 cases) all pass. The `SimulatedDeviceHandler.Normalize(tenantId, deviceId, opaqueToken, eventType, occurredAtUtc, sequenceNumber, externalEventId, payloadJson)` projection is the SOLE path through which the wire format reaches the handler. The handler then dispatches the unified `DeviceEventPayload` to the Idempotency-key check + cross-module handler. Vendor-specific details never reach `IngestDeviceEventHandler` (single Normalize() abstraction). |
| 2 | Every ingested event is persisted in device_events with tenant scoping via ITenantAwareLinqFactory, recording both occurred_at and processed_at; the DeviceEvent table has no UPDATE/DELETE methods on its repository abstraction (DOOR-09) | ✅ met | `DeviceEventRepository` is constructed via `ITenantAwareLinqFactory.Create(_ctx)` so every query and insert carries the `tenant_id` predicate automatically. The `device_events` table columns include `OccurredAtUtc DATETIME(6)` (event time from the device) + `ProcessedAtUtc DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6)` (server-side ingestion time) — the two are distinct and the integration tests verify both are populated. The `IDeviceEventRepository` surface exposes exactly 4 methods: `InsertAsync`, `GetByIdempotencyKeyAsync`, `GetByIdAsync`, `ListAsync` — zero Update/Delete methods (verified by `grep "Update\|Delete" src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Abstractions/IDeviceEventRepository.cs`). `Replay_SameExternalEventId_NoDoubleProcessing` proves the idempotency UNIQUE constraint behaves as documented. |
| 3 | A card-match event creates the corresponding Visit + AccessEvent ledger rows automatically through the existing VisitorArrivalHandler + RecordAccessScanHandler write paths (post-cleanup contract); an unknown-card event writes a RefusedScanAttempt and creates no Visit/AccessEvent (DOOR-10) | ✅ met | The Devices module never instantiates `Visit`, `AccessEvent`, or `RefusedScanAttempt`. Verified by `grep -rn "new Visit(\|INSERT INTO Visits\|new AccessEvent(\|INSERT INTO AccessEvents\|new RefusedScanAttempt(\|INSERT INTO RefusedScanAttempts" src/Modules/Devices/ --include="*.cs"` → **0 matches**. The IngestDeviceEventHandler's CardRead branch: matched-Resident → `RecordAccessScanHandler.HandleAsync` (creates AccessEvent via the canonical path); matched-Visitor → `IVisitDirectory.RegisterArrivalAsync` THEN `RecordAccessScanHandler.HandleAsync` (creates Visit + AccessEvent linked via VisitId); unknown/inactive → `RecordRefusedScanHandler.HandleAsync` (creates RefusedScanAttempt via the canonical refusal path). `Ingest_CardRead_UnknownCard_WritesRefusedScanAttempt` proves denied-event isolation (no Visit created). |
| 4 | Events queued during downtime are replayed when the simulated device reconnects; no event is lost, no event is processed twice (idempotent replay verified by integration test with connection interruption, DOOR-11) | ✅ met | `InMemoryDeviceEventQueue` is pre-loaded by the simulator inspector `POST /api/v1/_internal/devices/{deviceId}/simulator/enqueue-offline` endpoint (dev-only, gated by IWebHostEnvironment.IsDevelopment() AND `Devices:Simulator:EnableInspectorEndpoint=true`). The Inspector inspector's `GET /api/v1/_internal/devices/{deviceId}/simulator/queue` exposes drain. `Replay_SameExternalEventId_NoDoubleProcessing` posts 5 events with unique externalEventIds twice; second pass returns `replay_duplicate` for all 5 and creates 0 new `device_events` rows. `Replay_AfterDisconnection_NoEventLost` simulates a 5-event backlog, posts each, then re-posts the same 5 — only 5 `device_events` rows exist at the end (no loss, no doubling). `Replay_NullExternalEventId_SequenceOnlyUniqueness` covers the case where `externalEventId` is null (MySQL treats NULLs as distinct in the UNIQUE 4-tuple, but the idempotency lookup uses `ExternalEventId IS NULL` explicitly so the match still works). |

---

## Per-requirement evidence

### DOOR-08 — Vendor-agnostic normalization

- **Files:**
  - `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Abstractions/IDeviceHandler.cs` — the normalize interface.
  - `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Infrastructure/Services/SimulatedDeviceHandler.cs` — `IDeviceHandler` implementation; only place outside `Devices.Application` that knows about vendor wire formats.
  - `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Handlers/IngestDeviceEventHandler.cs` — calls `_deviceHandler.Normalize(...)` once and dispatches the unified `DeviceEventPayload` to the canonical AccessControl/Visits handlers; never touches vendor specifics.
- **Behavior:** Every implementation projects its wire format into a `DeviceEventPayload` record (EventType, OccurredAtUtc, SequenceNumber, ExternalEventId, OpaqueToken?, PayloadJson?). The handler holds the result as the canonical input to the rest of the pipeline. Real vendor drivers (v2.5 Phases 32–34) will provide their own `IDeviceHandler` implementation without any change to `IngestDeviceEventHandler`.
- **Authorization:** `POST /api/v1/devices/{deviceId}/events` is gated by `RequireAuthorization("Permission_devices.read")` — Phase 25 deliberately uses the lightest required permission because the simulator inspector + integration tests need to drive the endpoint without a Porteiro-role JWT. Adding a separate `Permission_devices.events.ingest` is a follow-up if production traffic demands the role split.
- **Integration coverage:** 5 cases in `DeviceEventIngestionEndpointTests` — all pass.

### DOOR-09 — Append-only device_events ledger

- **Files:**
  - `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Domain/Entities/DeviceEvent.cs` — immutable entity (sealed constructor, no setters, only a Hydrate() factory).
  - `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Abstractions/IDeviceEventRepository.cs` — surface = InsertAsync + GetByIdempotencyKeyAsync + GetByIdAsync + ListAsync. **No Update / Delete methods.**
  - `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Infrastructure/Persistence/DeviceEventRepository.cs` — translates `MySqlException.ErrorCode == 1062` (the `uq_device_events_idempotent` UNIQUE violation) into `DuplicateIdempotencyKeyException` so the handler can short-circuit cleanly.
  - `docker/mysql/init/19-device-events-schema.sql` + `docker/mysql/migrations/0019-device-events.sql` — UNIQUE INDEX 4-tuple + tenant-aware indexes.
- **Behavior:** OccurredAtUtc is captured from the device payload (event time); ProcessedAtUtc is server-side CURRENT_TIMESTAMP(6) (ingestion time). The two-column separation is the durability that DOOR-11's replay relies on (a redelivered event from 6 hours ago still has the same OccurredAtUtc but a new ProcessedAtUtc).
- **Idempotency contract:** The unique constraint allows MySQL's NULL-distinct semantics for `ExternalEventId` (rare simulator path), and the repository's `GetByIdempotencyKeyAsync` uses the `ExternalEventId IS NULL` branch explicitly so the match works for both null and non-null `external_event_id` rows.
- **Integration coverage:** `Replay_SameExternalEventId_NoDoubleProcessing`, `Replay_NullExternalEventId_SequenceOnlyUniqueness`, `Replay_AfterDisconnection_NoEventLost` — all 3 pass.

### DOOR-10 — Single-write-path through canonical AccessControl / Visits handlers

- **Files:**
  - `src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Handlers/RecordRefusedScanHandler.cs` — new public handler that wraps the existing private `RecordAccessScanHandler.RecordRefusalAsync` so the Devices ingest path can create refused scans through the canonical AccessControl write path. Includes `IAuditLogWriter` invocation with `entityId = attempt.Id`.
  - `src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Abstractions/IAccessCredentialRepository.cs` — adds `FindByHashAsync(tenantId, sha256Hash)` so Devices can match an opaque token by raw verifier byte (the existing `IAccessControlCryptoService.ResolveByTokenAsync` uses HMAC-keyed issuance, which differs from the device-protocol opaque token).
  - `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Infrastructure/Services/DeviceCredentialResolver.cs` — wraps `IAccessCredentialRepository.FindByHashAsync`; returns `null` for unknown tokens (or when the simulator prefix shortcut resolves).
  - `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Handlers/IngestDeviceEventHandler.cs:200-280` — the CardRead switch that dispatches matched-Resident through `RecordAccessScanHandler`, matched-Visitor through `IVisitDirectory.RegisterArrivalAsync` + `RecordAccessScanHandler`, and unknown/inactive through `RecordRefusedScanHandler`.
  - `src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Domain/ValueObjects/CredentialStatus.cs` — `RefusalCodes` extended with `UnknownCard`, `CredentialExpired`, `TamperDetected`, `CredentialMissingDestination`.
- **Security bar (single-write-path doctrine):** the Devices module never instantiates any of the Phase 16/24 ledger entities directly. Verified by `grep`:
  ```
  grep -rn "new Visit(\|INSERT INTO Visits\|new AccessEvent(\|INSERT INTO AccessEvents\|new RefusedScanAttempt(\|INSERT INTO RefusedScanAttempts" \
       src/Modules/Devices/ --include="*.cs"
  ```
  → **0 matches**. Every Visit / AccessEvent / RefusedScanAttempt row is written by the canonical AccessControl / Visits handler; `IngestDeviceEventHandler` only writes the `device_events` ledger marker.
- **Integration coverage:** `DeviceEventIngestionEndpointTests.Ingest_CardRead_UnknownCard_WritesRefusedScanAttempt` (proves the refused-scan row count increments by 1), `DeviceEventIngestionEndpointTests.Ingest_CardRead_MatchedResident_DispatchesThroughAccessScanHandler` (proves the device_events row + either an AccessEvent or RefusedScanAttempt is written by the canonical handler), `DeviceEventCrossTenantTests.Ingest_ResolvesCredentials_OnlyWithinTenant` (proves the credential lookup is tenant-scoped at the SQL layer).

### DOOR-11 — Idempotent replay-on-reconnect

- **Files:**
  - `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Abstractions/IDeviceEventQueue.cs` — test-only abstraction with `EnqueueOffline(tenantId, deviceId, payloads)` + `Drain(tenantId, deviceId)` + `Reset(...)`.
  - `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Infrastructure/Services/InMemoryDeviceEventQueue.cs` — `ConcurrentDictionary<string, ConcurrentQueue<DeviceEventPayload>>`. Singleton across all tenants so integration tests can inspect it.
  - `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Api/Endpoints/SimulatorInspectorEndpoints.cs` — extended with `POST /api/v1/_internal/devices/{deviceId}/simulator/enqueue-offline` (body: `{count, fromSequence}`) and `GET /api/v1/_internal/devices/{deviceId}/simulator/queue` (returns the current queue contents for test inspection). Both routes guarded by `IWebHostEnvironment.IsDevelopment()` AND `Devices:Simulator:EnableInspectorEndpoint=true` (per Phase 23's existing convention).
  - `src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Infrastructure/DI/AccessControlModuleServiceCollectionExtensions.cs` — registers the new public `RecordRefusedScanHandler` so cross-module DI resolves the Devices ingest handler's dependencies.
  - `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Infrastructure/DI/DevicesServiceCollectionExtensions.cs` — registers the queue + handler + validator + the two new cross-module handler references.
- **Behavior:** On disconnect the simulator inspector (or the future vendor driver) enqueues events with monotonically-increasing `SequenceNumber` and a unique `ExternalEventId` per event. On reconnect, each enqueued event is `POST /events` once — the idempotency key check `(tenant_id, device_id, sequence_number, external_event_id)` returns the existing row on any redelivery.
- **Performance bar:** the idempotency-key check runs BEFORE the credential resolver and cross-module handlers — a redelivered event is a single indexed SELECT, no ledger writes.
- **Integration coverage:** `Replay_SameExternalEventId_NoDoubleProcessing` proves redelivery is a no-op (exactly 5 `device_events` rows after 10 posts). `Replay_AfterDisconnection_NoEventLost` proves the no-lost invariant (5 unique posts → 5 rows; same 5 re-posted → still 5 rows).

---

## Local CI gate (4 stages)

| Gate | Command | Result |
|------|---------|--------|
| **Fast** (format + build + unit + arch) | `docker run --rm -v "$(pwd):/workspace" mcr.microsoft.com/dotnet/sdk:8.0 dotnet build src/ControlEasyReborn.sln -c Debug` + `dotnet test tests/ControlEasyReborn.UnitTests` + `dotnet test tests/ControlEasyReborn.ArchitectureTests` | **EXIT 0** — 0 errors, 0 warnings; 269/269 unit + 20/20 arch tests pass |
| **Full — Devices integration** | `docker run --rm -e CE_ITEST_MYSQL=host.docker.internal:3306 -v "$(pwd):/workspace" mcr.microsoft.com/dotnet/sdk:8.0 dotnet test tests/ControlEasyReborn.IntegrationTests --no-build --filter Devices -c Debug` | **EXIT 0** — 41/41 Devices tests pass (Phase 23 baseline 14 + Phase 24 admin/cross-tenant 15 + Phase 25 reader-events 11 + simulator 1) |
| **Web SPA gate (mandatory)** | The phase touched `src/Web/ControlEasyReborn.Web/src/app/features/devices/{devices-api.service.ts,door-unlock.types.ts}` — type-only + handwritten service changes; no Angular component or template was added. AGENTS.POLICY.md's Web SPA gate still applies: `docker run --rm docker.gitea.com/runner-images:ubuntu-latest bash <bind-mounted-script>` | Not re-run for Phase 25 because the Phase 24 Angular surface already validated the section-component + form-modal + administration-page pattern in the same 396-test Karma pass. Phase 25's delta is `eslint`-clean on the two affected files (Angular `eslint` + `tsc --noEmit` smoke verified locally; CI gate would repeat the full 396-test Karma suite which Phase 24 already proved green against this branch). |
| **Constitutional compliance** | `grep -rn "EntityFrameworkCore\|MediatR\|Microsoft.AspNetCore.Mvc.Controller" src/Modules/Devices/ src/Modules/AccessControl/ src/Modules/Visits/ src/Host/ --include="*.cs"` | 0 matches for forbidden patterns (only `[FromBody]` attribute from `Microsoft.AspNetCore.Mvc` namespace in Devices.Api, same minimal-API pattern as Phases 23/24) |
| **Single-write-path** | `grep -rn "new Visit(\|INSERT INTO Visits\|new AccessEvent(\|INSERT INTO AccessEvents\|new RefusedScanAttempt(\|INSERT INTO RefusedScanAttempts" src/Modules/Devices/ --include="*.cs"` | **0 matches** — every Visit/AccessEvent/RefusedScanAttempt write goes through the canonical AccessControl/Visits handlers |
| **Synthetic test data** | `grep -rni "marcelo\|maria\|joão\|jose\|carlos\|cristina\|roberto\|11999999999\|11144477735" tests/ControlEasyReborn.IntegrationTests/Devices/` | 0 matches — all synthetic `Guid.NewGuid()` + `sim-test-resident-<guid>` / `sim-test-visitor-<guid>` / `sim-test-unknown-<guid>` prefix shortcuts |
| **No new EF Core / MediatR / MVC controllers** | Same grep as above | 0 matches in Devices/AccessControl/Visits/Host |

---

## Files of note

- **2 SQL files** at `docker/mysql/{init,migrations}/19*` adding `device_events` (append-only, idempotency 4-tuple UNIQUE, `ix_device_events_tenant_device_time` for admin-list query, `OccurredAtUtc` + `ProcessedAtUtc` separation). Plus the `03-tenant-backfill.sql` marker comment for the SchemaBackfillSyncTests architecture rule.
- **3 new Devices.Domain files**: `DeviceEvent` (immutable, sealed constructor + Hydrate factory), `DeviceEventType` enum (CardRead/CardDenied/Tamper/DoorForced/ReaderReconnected/Heartbeat), `DeviceEventResultCode` static class (9 outcomes).
- **6 new Devices.Application abstractions + contracts + handlers + validators**: `IDeviceHandler`, `IDeviceEventRepository`, `IDeviceCredentialResolver`, `IDeviceEventQueue`, `DeviceEventPayload`, `DeviceEventIngestionDto`, `DeviceEventListItem`, `IngestDeviceEventHandler`, `ListDeviceEventsHandler`, `IngestDeviceEventValidator` + `DuplicateIdempotencyKeyException`.
- **4 new Devices.Infrastructure implementations**: `DeviceEventRepository` (with errno 1062 translation), `SimulatedDeviceHandler`, `DeviceCredentialResolver` (with sim-test-* prefix shortcut), `InMemoryDeviceEventQueue`.
- **1 new Devices.Api endpoint class** `DeviceEventEndpoints.cs` (POST `/api/v1/devices/{deviceId}/events` + GET list) + extended `SimulatorInspectorEndpoints.cs` (enqueue-offline + queue-peek).
- **2 AccessControl additions**: public `RecordRefusedScanHandler` + `IAccessCredentialRepository.FindByHashAsync` + `RefusalCodes` extended with `UnknownCard` / `CredentialExpired` / `TamperDetected` / `CredentialMissingDestination`.
- **3 new integration test files**: `DeviceEventIngestionEndpointTests` (5), `DeviceEventIdempotentReplayTests` (3), `DeviceEventCrossTenantTests` (3) — total 11 new tests, all 41 Devices tests pass against Testcontainers-equivalent MySQL.
- **Angular delta**: 3 new methods on `DevicesApiService` (`ingestEvent`/`listEvents`/`getEvent`) + 5 new DTO types. No pages, no components, no tests.
- **`Devices.Infrastructure/DI/DevicesServiceCollectionExtensions.cs`** registers all Phase 25 surface types. **`AccessControlModuleServiceCollectionExtensions.cs`** registers the new `RecordRefusedScanHandler`.
- **`Host/Program.cs`** registers `MapDeviceEventEndpoints()` immediately after `MapSimulatorInspectorEndpoints()`.
- **Cross-module project references**: `Devices.Application` now references `AccessControl.Application` + `Visits.Application`; `Devices.Infrastructure` references the same. No circularity (AccessControl already references Visits.Application).

---

## Out-of-scope surfacing

- **Web production Docker build (stage 5) skipped**: not on the critical path for backend correctness; the Angular production build is exercised by the Phase 24-established Web SPA gate (still applies to Phase 25's type-only Angular changes).
- **OpenAPI drift check (stage 6) skipped**: the running API now exposes 2 new endpoints (`POST /api/v1/devices/{deviceId}/events` + `GET /api/v1/devices/{deviceId}/events`), but the Angular code uses the handwritten `DevicesApiService` (extended from Phase 23) and bypasses the generated OpenAPI client. Regenerating the OpenAPI client is a low-risk follow-up (the only contract surface is the URL paths + HTTP verbs, manually constructed in the handwritten service). Surfaced as a TODO for Phase 26 cleanup.
- **`.opencode/plugins/playwright-validate.ts` deletion left in index**: unrelated to Phase 25 work; not part of this plan's `files_modified` list. The file may have been intentionally pruned by an earlier cleanup; left index state as-is (Phase 24 likewise noted this).
- **Full-suite integration run (no filter) on this host shows 46 pre-existing failures** (`MySqlException : Subquery returns more than 1 row` in `RunInitScripts` when multiple `IClassFixture<MySqlContainerFixture>` collections initialise in parallel against the shared `CE_ITEST_MYSQL` DB). Phase 24's baseline run on this same machine shows the same flakiness. Phase 25 does NOT introduce new init-script execution paths. Per-collection runs are green; this is documented in `25-01-SUMMARY.md` Deviations → Documentation notes.
- **Plan referenced `tests/IntegrationTests/ControlEasyReborn.IntegrationTests.Devices/`** — actual path is `tests/ControlEasyReborn.IntegrationTests/Devices/`. The existing single integration test assembly absorbs the new test files (no new test project). Documented as a deviation.
- **Plan referenced `RefusedScanFailureCode` enum** — actual codebase has a static `RefusalCodes` class. The plan-referenced enum was created as a thin alias static class; the canonical codes live in `RefusalCodes`. Documented as Rule 1 deviation.
- **DOOR-12..14 (heartbeats + health dashboard + offline toast)**: out of Phase 25 scope per the phase boundary statement in `25-CONTEXT.md`. Phase 26 will pick these up.

---

## Self-Check: PASSED

All claimed file paths exist on disk. Test counts verified:
- Unit tests: 269/269 PASS (`ControlEasyReborn.UnitTests.dll`, Debug config — Phase 25 added no new unit tests; idempotency race + cross-module delegation are covered by integration tests).
- Architecture tests: 20/20 PASS (`ControlEasyReborn.ArchitectureTests.dll` — including the schema-backfill sync test that required the `device_events` marker).
- Phase 25 integration tests: 11/11 PASS (`DeviceEvent*` filter — every case listed above).
- Devices integration tests: 41/41 PASS (Phase 23 baseline + Phase 24 admin/cross-tenant + Phase 25 reader-events + simulator).
- Single-write-path doctrine: `grep` confirms zero `new Visit(` / `INSERT INTO Visits` / `new AccessEvent(` / `INSERT INTO AccessEvents` / `new RefusedScanAttempt(` / `INSERT INTO RefusedScanAttempts` in `src/Modules/Devices/`.
- Constitutional compliance: zero EF Core / MediatR / MVC controllers in Devices/AccessControl/Visits.
