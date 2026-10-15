# Phase 23: Device Foundation & Simulator Harness - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous mode — decisions sourced from `.planning/milestones/v2.3-REQUIREMENTS.md`, `.specs/door-integration/requirements.md`, constitution v1.7.0, AGENTS.POLICY.md, and v2.1/v2.2 prior-phase context)

<domain>
## Phase Boundary

Phase 23 establishes the **complete backend surface** for door-integration on a simulated device adapter. After 23 ships, a porteiro's unlock button reaches a simulated device end-to-end with the full security bar enforced, every unlock is append-only audit-logged, and connection params are stored AES-256-GCM-encrypted per tenant. Phase 23 does NOT include UI (no unlock button yet — that lands with the porteiro panel integration in Phase 26/31); it does include the *API*, the *simulator harness*, the *device abstractions*, the *database* (devices + device_unlock_audit tables), and the *integration tests* that prove the security bar works against the simulator.

**Scope split:**
- DOOR-01: `IDoorController.UnlockAsync` abstraction + simulated device adapter + `POST /api/v1/devices/{deviceId}/unlock`
- DOOR-02: Security machinery (HMAC-SHA256 per-tenant key, nonce + timestamp window, porteiro role, rate limit 1/3s, tenant flag 404)
- DOOR-03: Append-only `DeviceUnlockAudit` table + DB triggers rejecting UPDATE/DELETE
- DOOR-04: `devices` table + AES-256-GCM connection-params encryption (per-tenant key derived from existing tenant HMAC seed)
- DOOR-07: Rate-limit response (429 ProblemDetails) + audit on limit exceed + legitimate-retry success
- DOOR-15: Simulator test harness (in-process mock behind `IDoorController`, plus the in-memory `DoorSimulatorState` that integration tests assert against)

**Out of scope (deferred to later phases):**
- DOOR-05/06 (admin opt-in flag + device registration UI) → Phase 24
- DOOR-08..11 (reader events + ledger integration) → Phase 25
- DOOR-12..14 (heartbeats, health dashboard, offline toast) → Phase 26
- Real vendor drivers → v2.5 Phases 32–34

</domain>

<decisions>
## Implementation Decisions

### Module structure & naming
- New module: `ControlEasyReborn.Modules.Devices` (4 projects: Domain, Application, Infrastructure, Api) — distinct from existing `AccessControl` module (which is for v2.x access-credentials, not hardware). Module name in code: `Devices`. Endpoint prefix: `/api/v1/devices`.
- Module follows the existing Clean Architecture layout (Domain / Application / Infrastructure / Api) used by Visits, Security, AccessControl.
- The tenant-isolated Devices module uses `ITenantAwareLinqFactory` for every read/write (no cross-tenant access).

### Module registration
- Devices module registers in `src/Host/ControlEasyReborn.Host` Program.cs as a separate `builder.AddModule<...>()` style call alongside existing modules. The Devices.Api project exposes `MapDevicesEndpoints()` returning an `IEndpointRouteBuilder`, mirroring the Visits/Security pattern.
- DI registrations live in `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Infrastructure/DI/`.

### `IDoorController` abstraction
- One interface in `Application/Abstractions/IDoorController.cs` with `Task<DoorUnlockResult> UnlockAsync(Guid tenantId, Guid deviceId, DoorUnlockCommand command, CancellationToken ct)`.
- `DoorUnlockResult` is a discriminated result (success / device_offline / auth_failed / rate_limited / unknown_tenant_flag / unknown_device) — never throws for expected outcomes; only throws for truly exceptional conditions.
- The interface lives in **Application** (not Domain) — same as `AccessControl`'s `IAccessControlHmacKeyProvider` and other I/O boundary abstractions. Rationale: door controllers are application-layer integrations with the outside world, not domain invariants.

### Simulated device adapter
- A single concrete implementation `SimulatedDoorController : IDoorController` registered as scoped.
- Wraps an in-memory `DoorSimulatorState` (singleton, thread-safe via lock) that records every `UnlockAsync` call: device id, requested-at timestamp, success-or-failure outcome, optional simulated failure injection.
- The simulator honors a per-device "always succeeds / always fails / fails-then-recovers" toggle (test-only, not exposed via API) so integration tests can exercise every failure path without real hardware.
- A second implementation `LoopbackHttpDoorController : IDoorController` is registered behind a feature flag (off by default). It POSTs to a configurable URL — used when the operator wants to point at the Docker-hosted mock device service from `.specs/door-integration/` future work. NOT in scope for Phase 23 beyond the scaffolding.

### Connection-params encryption (DOOR-04)
- `devices.connection_params` is a `VARBINARY(512)` column. Encryption is AES-256-GCM (96-bit IV, 128-bit tag) with a per-tenant key derived via HKDF-SHA256 from the existing tenant HMAC seed (same source the AccessControl module uses for `AccessControlHmacKeyProvider`). One additional key purpose constant added to the existing key-derivation scheme: `DOOR_CONNECTION_PARAMS_V1`.
- The encryption service `IDeviceConnectionCryptoService` lives in Application/Abstractions; the implementation in Infrastructure/Services; the per-tenant key derivation reuses the existing tenant-key infrastructure (no new key-management surface).
- The service exposes `Encrypt(tenantId, plaintext) → ciphertext` and `Decrypt(tenantId, ciphertext) → plaintext`. The API endpoint accepts connection params once, encrypts them, and **never returns plaintext after registration** — get/list responses return a redacted form (`"redacted": true, "last4": "abcd"`).

### Security machinery (DOOR-02)
- HMAC-SHA256 signature is computed over a canonicalized request line (`POST\n{deviceId}\n{timestamp-iso8601}\n{nonce-base64url}\n{sha256(body)}`). Per-tenant secret derived via `IDeviceUnlockKeyProvider` (Application/Abstractions) reusing the same HKDF scheme with purpose `DOOR_UNLOCK_V1`.
- Replay protection: `nonce` is a 128-bit value the client generates once; the server stores nonces consumed in the last `REPLAY_WINDOW_SECONDS` (default 300s) in an in-memory `IDeviceNonceCache` (singleton, ConcurrentDictionary sized at 100k entries, FIFO eviction). A captured nonce reused inside the window fails with 401.
- Timestamp window: requests with `|server_now - timestamp|` > 30s return 401 ProblemDetails (`title="unlock-replay-window-exceeded"`).
- Rate limit: per-device, 1 unlock per 3 seconds. Implemented via in-memory `IDeviceUnlockRateLimiter` (singleton, ConcurrentDictionary<Guid, DateTimeOffset> keyed by `(tenantId, deviceId)`). Exceeding returns 429 ProblemDetails and writes an audit row with `outcome = "rate_limited"`. Legitimate retry after window succeeds — covered by integration test.
- Tenant opt-in flag: every endpoint under `/api/v1/devices/**` checks `Tenants.DoorIntegrationEnabled` BEFORE HMAC verification — if false, return 404 (not 403; 404 hides the existence of the feature). The flag column is added to `Tenants` via a migration.
- Role check: `RequiresPorteiroRole()` middleware-equivalent on the unlock endpoint — non-porteiro roles get 403 ProblemDetails (`title="unlock-insufficient-role"`).

### Append-only audit log (DOOR-03)
- New table `DeviceUnlockAudit` with columns: `Id CHAR(36)`, `TenantId CHAR(36)`, `DeviceId CHAR(36)`, `ActorProfileId CHAR(36)`, `CommandHash CHAR(64)` (SHA-256 hex), `OccurredAtUtc DATETIME(6)`, `ResponseOutcome VARCHAR(32)` (`success` / `device_offline` / `auth_failed` / `rate_limited` / `unknown_tenant_flag` / `unknown_device`), `CommandNonce CHAR(36)`, `CorrelationId CHAR(36)`, `tenant_id CHAR(36)`. No `UpdatedAtUtc` — append-only by design.
- DB triggers: `BEFORE UPDATE ON DeviceUnlockAudit` and `BEFORE DELETE ON DeviceUnlockAudit` both raise `SIGNAL SQLSTATE '45000'`. Mirrors the `ConsentAuditLog` pattern in `docker/mysql/init/09b-consent-schema.sql`.
- Integration test: with a Testcontainers MySQL instance, attempt `UPDATE DeviceUnlockAudit SET ResponseOutcome = 'success' WHERE Id = ...` and assert the call throws `MySqlException` with code 1644 (signal 45000). Attempt `DELETE FROM DeviceUnlockAudit WHERE Id = ...` and assert the same.

### Migration pattern
- Both fresh-schema DDL (in `docker/mysql/init/17-devices-schema.sql`) and idempotent live migration (in `docker/mysql/migrations/0017-devices.sql`) added in lockstep — same as `12-access-control-schema.sql` ↔ `0009-access-control.sql` precedent.
- Migration order: 0017-devices.sql contains the two tables, the triggers, AND the `ALTER TABLE Tenants ADD COLUMN DoorIntegrationEnabled TINYINT(1) NOT NULL DEFAULT 0` statement guarded by an `information_schema.COLUMNS` existence check (matching the conditional pattern in `12-access-control-schema.sql:120-123`).

### OpenAPI client + Angular consumers
- The Devices module's OpenAPI definitions generate into the existing OpenAPI generator output. The Angular services in `src/Web/ControlEasyReborn.Web/src/app/features/devices/` (new folder) consume the generated client. Phase 23 ships the API + generated types + the API service (`devices-api.service.ts`); the actual UI does not use the unlock endpoint yet — Phase 24/26 will add the admin/health pages. Phase 23's Angular surface is intentionally minimal: only the service and the TypeScript interfaces are wired.

### Simulator harness (DOOR-15)
- An integration-test suite in `tests/IntegrationTests/ControlEasyReborn.IntegrationTests.Devices/SimulatedUnlockTests.cs` exercises: happy path unlock, HMAC signature mismatch, expired timestamp, reused nonce, rate-limit then success, unknown device id, tenant flag off (404), non-porteiro role (403). Each test reads/writes the `DoorSimulatorState` to assert the simulator received the expected command.
- The simulator state is exposed via an internal-only `GET /api/v1/_internal/devices/{deviceId}/simulator` endpoint guarded by `HostingEnvironment.IsDevelopment()` AND a config flag `Devices:Simulator:EnableInspectorEndpoint` (default false in Production). This lets E2E tests in `tests/E2E/` peek at simulator state without trusting prod secrets.

### Out-of-scope decisions explicit
- No UI work in Phase 23. The Angular `features/devices/` folder is created but only contains the API service and DTOs — no pages, no components. The first UI surfaces land in Phase 24 (admin) and Phase 26 (porteiro).
- No edge-agent code. The edge agent is a v2.5 (Phase 31) concern. Phase 23's simulated adapter is in-process.
- No real vendor SDKs, no MQTT, no WebSocket frame parsing.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/BuildingBlocks/ControlEasyReborn.Infrastructure` — tenant key derivation, AES-256-GCM crypto helpers, `ITenantAwareLinqFactory`. Reuse for `IDeviceConnectionCryptoService` and `IDeviceUnlockKeyProvider` (extend key-purpose constants, do not duplicate the KDF).
- `src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Abstractions/AccessControlHmacKeyProvider.cs` — closest analogue for the unlock key provider. Same pattern: per-tenant HKDF over a master seed; one additional `purpose` constant.
- `src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Api/Endpoints/AccessEventsEndpoints.cs` — pattern for tenant-scoped Minimal-API endpoint classes (route-group, RequireAuthorization, MapPost/MapGet with `IValidator<TRequest>` injection, ProblemDetails on failures).
- `docker/mysql/init/09b-consent-schema.sql` — append-only trigger precedent. Copy the trigger pattern verbatim for `DeviceUnlockAudit`.
- `docker/mysql/init/12-access-control-schema.sql` — table-creation precedent (CHAR(36) PKs, `tenant_id` shadow column, idempotent `IF NOT EXISTS`).
- `tests/IntegrationTests/ControlEasyReborn.IntegrationTests` — Testcontainers.MySql harness already used by AccessControl tests; reuse the fixture.
- `src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Api/Endpoints/AccessControlEndpoints.cs` — small group-route pattern for inspection endpoints guarded by `IWebHostEnvironment.IsDevelopment()`.

### Established Patterns
- **Vertical-slice / handler-per-command**: `Application/Handlers/{Command}Handler.cs` with `IRequestHandler<TCommand, TResult>`. NOT MediatR (constitution prohibition) — handlers are registered as scoped services directly via `AddScoped<IUnlockHandler, SimulateUnlockHandler>()`.
- **Validators**: `FluentValidation` lives in `Application/Validators/` and runs inside the handler constructor (no middleware).
- **Result types**: domain returns discriminated results (e.g., `DoorUnlockResult.Success | DoorUnlockResult.RateLimited | ...`) — endpoints translate to `Results<Ok<T>, ProblemHttpResult>`.
- **ProblemDetails**: every failure path emits `ProblemDetails` via the shared extension `Results.Problem(detail: ..., statusCode: ..., title: ..., type: ..., extensions: { "code": "..." })`.
- **Serilog structured logging**: every handler logs `tenantId`, `deviceId`, `actorProfileId`, `correlationId`, `outcome` as structured properties. NEVER log connection params, HMAC keys, or nonces.
- **No EF Core**: all persistence uses `Linq<TModel>` from `DBTools`. Repositories return `Linq<Devices>` etc.
- **OpenAPI / Swagger**: Devices endpoints are picked up by the existing `AddSwaggerGen()` configuration because they live in the same host project. Generation produces types into `src/Web/ControlEasyReborn.Web/src/app/api/` (the path is configured in `OpenApiGenerator.json`).

### Integration Points
- `src/Host/ControlEasyReborn.Host/Program.cs` — module registration call site: add `builder.AddDevicesModule()`.
- `src/Host/ControlEasyReborn.Host/Properties/launchSettings.json` (or equivalent dev-settings) — add `Devices:Simulator:EnableInspectorEndpoint=true` for the dev profile.
- `docker/docker-compose.yml` — no changes (simulator is in-process, no new container for Phase 23).
- `src/ControlEasyReborn.sln` — add the four Devices module projects.
- `src/Web/ControlEasyReborn.Web/src/app/api/` — generated OpenAPI client gets new types; regenerate via `npm run openapi:generate` in the Web project.
- `src/Web/ControlEasyReborn.Web/src/app/features/devices/` — new Angular folder; ships `devices-api.service.ts` + DTO interfaces (no UI).

</code_context>

<specifics>
## Specific Ideas

- The simulator's "always-fails-then-recovers" toggle is wired as a `DeviceSimulatorState.SetFailureMode(deviceId, mode)` method called only by `IWebHostEnvironment.IsDevelopment()` paths. Production always succeeds unless the device is offline (which the simulator can also simulate via `SetOffline(deviceId, until)`).
- Per-tenant HMAC key purpose constant `DOOR_UNLOCK_V1` and connection-params purpose constant `DOOR_CONNECTION_PARAMS_V1` are added to the existing `KeyDerivationPurposes` enum (do not introduce a parallel scheme).
- The unlock endpoint's response shape is `DoorUnlockResponse { DeviceId, Outcome, OccurredAtUtc, CorrelationId }` — `Outcome` is the same enum used by the audit table. Clients can correlate `CorrelationId` end-to-end (response ↔ audit row).
- The nonce cache and rate-limit cache are deliberately in-memory for Phase 23. Multi-instance deployment is Phase 31's problem (Redis-backed). The plan records this as a known single-instance-only constraint with a DOOR-31 follow-up.
- The unlock endpoint requires the actor to be authenticated AS A PORTEIRO via the existing JWT machinery — same `[Authorize(Roles = "Porteiro")]` style. The role check happens BEFORE the HMAC check so an unauthorized request never burns HMAC verification CPU.

No specific mockup — UI surfaces land in Phases 24/26.

</specifics>

<deferred>
## Deferred Ideas

- Multi-instance rate limit / nonce cache (Redis-backed) → Phase 31 (edge-agent milestone).
- Hardware-tenant binding to a physical gatehouse (gatehouse_id column present on devices, but population via UI lands in Phase 24).
- Biometric / facial unlock → FUT-01 (separate spec, not v2.3).
- Approval workflow for manual override → not in v2.3 (out-of-scope, see `v2.3-REQUIREMENTS.md`).
- DOOR-R1/R2/R3 (real vendor drivers) → v2.5 Phases 32/33/34.
- Per-tenant config UI for `offline_after_seconds` / `error_rate_threshold` → Phase 26 (device health).
- Connection-params "edit-in-place" flow (replace-and-reissue) → Phase 24's edit modal.
- Bulk device registration (CSV import) → not in v2.3.
- Conditional access by time-of-day / day-of-week → not in v2.3.

</deferred>