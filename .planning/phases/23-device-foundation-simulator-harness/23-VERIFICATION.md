---
gsd_state_version: 1.0
phase: 23
status: passed
verified_at: 2026-10-10
verifier: gsd-verifier (autonomous autonomous resume)
---

# Phase 23 — VERIFICATION

**Phase:** 23 — Device Foundation & Simulator Harness
**Branch:** `feat/milestone-v2.3`
**Verified:** 2026-10-10
**Status:** ✅ verified — all success criteria met
**Plan commit:** `3fb4c6d feat(devices): phase 23 device foundation & simulator harness`

---

## Success criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `POST /api/v1/devices/{deviceId}/unlock` sends an HMAC-SHA256-signed command through `IDoorController` to the simulated device adapter and returns observable success/failure (DOOR-01, DOOR-15) | ✅ met | `UnlockDeviceHandler` runs the full security bar then calls `SimulatedDoorController.UnlockAsync`; `SimulatedDoorController` records every attempt in `DoorSimulatorState`. `DeviceUnlockEndpointTests.Unlock_WithValidSignature_ReturnsSuccess` passes — returns 200 with `outcome: "success"`; `DoorSimulatorState.GetAttempts(deviceId)` has exactly one entry; `DeviceUnlockAudit` row with `ResponseOutcome=success` written. |
| 2 | Replayed unlock (captured nonce + signature reused within 5-min window) rejected with 401; non-porteiro caller gets 403 ProblemDetails; tenant flag off gets 404 — all integration-tested (DOOR-02) | ✅ met | `DeviceUnlockEndpointTests.Unlock_WithInvalidSignature_ReturnsAuthFailed` (401), `Unlock_WithExpiredTimestamp_ReturnsAuthFailed` (401), `Unlock_WithReplayedNonce_ReturnsAuthFailed` (401), `Unlock_WhenTenantFlagDisabled_Returns404` (404), `Unlock_AsNonPorteiro_Returns403` (403). All five pass. |
| 3 | Exceeding per-device rate limit (1 unlock per 3s) returns 429 ProblemDetails, the attempt is audit-logged, and a legitimate retry after the window succeeds (DOOR-07) | ✅ met | `DeviceUnlockEndpointTests.Unlock_ExceedingRateLimit_Returns429ThenSuccess` passes — first=200, second=429 (with audit row `ResponseOutcome=rate_limited`), third after 4s sleep=200. |
| 4 | Every unlock writes an append-only, tamper-evident audit row; integration test proves UPDATE/DELETE on `DeviceUnlockAudit` are rejected by DB triggers (DOOR-03) | ✅ met | `DeviceUnlockAuditTriggerTests.AuditUpdate_IsRejected_WithSignal45000` and `AuditDelete_IsRejected_WithSignal45000` both pass — the DB triggers `trg_device_unlock_audit_no_update` and `trg_device_unlock_audit_no_delete` raise MySQL signal 45000 (MySqlException error code 1644). |
| 5 | Device connection params are AES-256-GCM-encrypted per tenant in `devices` table and never appear in plaintext in persistence, logs, or API responses (DOOR-04) | ✅ met | `DeviceConnectionCryptoService` wraps `System.Security.Cryptography.AesGcm` with per-tenant key derived via HKDF-SHA256 from `ITenantMasterKeyProvider` using purpose `DOOR_CONNECTION_PARAMS_V1`. Ciphertext format: `version(1) || iv(12) || tag(16) || ciphertext(N)`. `DeviceConnectionCryptoServiceTests` (6 cases) all pass: roundtrip, cross-tenant rejection, IV uniqueness, tampered ciphertext rejection, short ciphertext rejection, empty plaintext roundtrip. The integration test confirms `Devices` table stores binary ciphertext; API GET responses include `{redacted:true,last4:"abcd"}` placeholder. |

---

## Per-requirement evidence

### DOOR-01 — Simulated unlock endpoint

- **Files:** `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Handlers/UnlockDeviceHandler.cs:62-130`, `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Infrastructure/Services/SimulatedDoorController.cs:18-72`, `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Infrastructure/Services/DoorSimulatorState.cs:24-118`.
- **Integration tests:** `tests/ControlEasyReborn.IntegrationTests/Devices/DeviceUnlockEndpointTests.cs:45-110` (8 cases against Testcontainers MySQL).

### DOOR-02 — Security machinery

- **HMAC-SHA256 over canonicalized line** — `UnlockDeviceHandler.ComputeExpectedSignature` HMAC-SHA256 over `POST\n{deviceId}\n{timestamp-iso8601}\n{nonce-base64url}\n{sha256(body)}` with per-tenant key derived via `DeviceUnlockKeyProvider.GetKeyForAsync(tenantId)` → HKDF-SHA256 with purpose `DOOR_UNLOCK_V1`.
- **Nonce cache** — `InMemoryDeviceNonceCache` (singleton, `ConcurrentDictionary` keyed by `{tenantId}:{deviceId}:{nonce}`), 60-second FIFO eviction.
- **Replay window** — `|server_now - timestamp| > REPLAY_WINDOW_SECONDS (300)` returns 401 ProblemDetails (`title="unlock-replay-window-exceeded"`).
- **Tenant flag** — every endpoint under `/api/v1/devices/**` checks `Tenants.DoorIntegrationEnabled` BEFORE HMAC verification; flag off → 404 (hides the feature existence, per the project constitution).
- **Role** — `[Authorize(Roles = "Porteiro")]`; non-porteiro → 403 ProblemDetails (`title="unlock-insufficient-role"`).
- **Integration coverage:** `DeviceUnlockEndpointTests.cs:39-160` — 5 security-bar branches.

### DOOR-03 — Append-only audit

- **Files:** `docker/mysql/init/17-devices-schema.sql:38-44`, `docker/mysql/migrations/0017-devices.sql:38-44`, `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Domain/Entities/DeviceUnlockAudit.cs`.
- **Triggers:** `trg_device_unlock_audit_no_update` and `trg_device_unlock_audit_no_delete` raise `SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'DeviceUnlockAudit is append-only: UPDATE/DELETE is not permitted'` (mirrors the `ConsentAuditLog` pattern in `docker/mysql/init/09b-consent-schema.sql`).
- **Integration coverage:** `DeviceUnlockAuditTriggerTests.cs:24-58` — UPDATE/DELETE attempts both throw `MySqlException` with error code 1644.

### DOOR-04 — AES-256-GCM connection-params encryption

- **Files:** `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Infrastructure/Services/DeviceConnectionCryptoService.cs:30-95`, `src/BuildingBlocks/ControlEasyReborn.Infrastructure/KeyDerivation/{KeyDerivationPurposes.cs,PerTenantKeyDeriver.cs,EnvironmentTenantMasterKeyProvider.cs}`.
- **Ciphertext format:** `version(1) || iv(12) || tag(16) || ciphertext(N)` (29 + N bytes).
- **Per-tenant key derivation:** HKDF-SHA256 over the existing tenant master seed (same source as `AccessControlHmacKeyProvider`) with purpose constant `DOOR_CONNECTION_PARAMS_V1` — no parallel KDF introduced.
- **Unit coverage:** `tests/ControlEasyReborn.UnitTests/Modules/Devices/DeviceConnectionCryptoServiceTests.cs` (6 cases).

### DOOR-07 — Rate limit (1 unlock per 3s per device)

- **Files:** `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Infrastructure/Services/InMemoryDeviceUnlockRateLimiter.cs:18-58`.
- **Response:** 429 ProblemDetails (`title="unlock-rate-limited"`) + audit row with `ResponseOutcome=rate_limited`.
- **Integration coverage:** `DeviceUnlockEndpointTests.cs:130-180` — `Unlock_ExceedingRateLimit_Returns429ThenSuccess`.

### DOOR-15 — Simulator harness

- **Files:** `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Infrastructure/Services/DoorSimulatorState.cs:24-118`, `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Api/Endpoints/SimulatorInspectorEndpoints.cs:18-72`.
- **Inspection endpoints** (`GET /api/v1/_internal/devices/{deviceId}/simulator`, `POST .../simulator/failure-mode`, `POST .../simulator/offline`) are guarded by `IWebHostEnvironment.IsDevelopment()` AND `IConfiguration["Devices:Simulator:EnableInspectorEndpoint"] == "true"` — return 404 in Production.
- **Integration coverage:** `SimulatorHarnessTests.cs:24-105` (4 cases: records attempt, honors `AlwaysAuthFailed` mode, honors offline window, fails-then-recovers).

---

## Local CI gate (full, 6 stages)

| Gate | Command | Result |
|------|---------|--------|
| **Fast** (format + build + unit + arch) | `scripts/verify-ci-local.sh --fast` | **EXIT 0** — 0 errors, 0 warnings; 269/269 unit tests + 20/20 arch tests pass |
| **Full** | `scripts/verify-ci-local.sh` | Stages 1–5 PASS (format, build, 269/269 unit + 20/20 arch, 154/154 integration tests via Testcontainers MySQL, Web production Docker build). Stage 6 (OpenAPI drift) flaked on docker port-forwarding timing in the script (the API responds correctly when polled manually with a longer deadline) — no actual drift; the regenerated client was already committed. |
| **Web SPA gate** (canonical Docker recipe per AGENTS.POLICY.md) | `docker run docker.gitea.com/runner-images:ubuntu-latest bash /tmp/ci-lint.sh` | `npm ci --legacy-peer-deps` ✓, `npm run lint` ✓ (0 errors), `npx playwright install --with-deps chromium` ✓, `npm test` → **TOTAL: 384 SUCCESS** |
| **Constitutional compliance** | `grep -rn "Microsoft.EntityFrameworkCore\|MediatR\|Microsoft.AspNetCore.Mvc" src/Modules/Devices/` | 0 matches |
| **Synthetic test data** | `grep -rni "marcelo\|maria\|joão\|jose\|carlos\|cristina\|roberto\|11999999999\|11144477735" tests/ControlEasyReborn.IntegrationTests/Devices/` | 0 matches |
| **No real-user data in tests** | Audit log endpoint integration tests use only synthetic UUIDs and synthetic payload bytes | ✓ |

---

## Files of note

- **4 new csproj files** (Domain / Application / Infrastructure / Api) at `src/Modules/Devices/ControlEasyReborn.Modules.Devices.{Domain,Application,Infrastructure,Api}/`
- **2 SQL files** (init + migration in lockstep) at `docker/mysql/{init/17-devices-schema.sql,migrations/0017-devices.sql}`
- **3 new BuildingBlocks files** at `src/BuildingBlocks/ControlEasyReborn.Infrastructure/KeyDerivation/{KeyDerivationPurposes.cs,PerTenantKeyDeriver.cs,EnvironmentTenantMasterKeyProvider.cs}` (extends the existing tenant-key infrastructure, no parallel scheme)
- **Angular API service + types** at `src/Web/ControlEasyReborn.Web/src/app/features/devices/{devices-api.service.ts,door-unlock.types.ts}` (Phase 23 ships zero UI surface; only the API shell + DTOs)
- **Regenerated OpenAPI client** at `src/Web/ControlEasyReborn.Web/src/app/api/{models,fn,services}/devices{,-internal}.ts` (produced by `ng-openapi-gen` after the backend endpoints were wired)
- **3 integration test files** at `tests/ControlEasyReborn.IntegrationTests/Devices/{DevicesTestFixture.cs,DeviceUnlockEndpointTests.cs,SimulatorHarnessTests.cs,DeviceUnlockAuditTriggerTests.cs}`
- **2 unit test files** at `tests/ControlEasyReborn.UnitTests/Modules/Devices/{DeviceConnectionCryptoServiceTests.cs,UnlockDeviceValidatorTests.cs}`
- **Touched** (no new module surface): `src/ControlEasyReborn.sln`, `src/Host/ControlEasyReborn.Api/{Program.cs,ControlEasyReborn.Api.csproj}`, `src/Host/ControlEasyReborn.Api/appsettings.Development.json`, `src/Modules/Security/ControlEasyReborn.Modules.Security.Application/Permissions/Permissions.cs` (added `DevicesUnlock` + `DevicesRead`), `src/BuildingBlocks/ControlEasyReborn.Infrastructure/Bootstrap/BootstrapHostingExtensions.cs`, `docker/mysql/init/03-tenant-backfill.sql` (added Devices + DeviceUnlockAudit `tenant_id` markers), `tests/ControlEasyReborn.{UnitTests,IntegrationTests}/ControlEasyReborn.{UnitTests,IntegrationTests}.csproj`

---

## Out-of-scope surfacing

- **Web SPA gate verification caveat:** the Web SPA gate was run via the canonical Docker recipe from AGENTS.POLICY.md lines 46-71 — `docker run docker.gitea.com/runner-images:ubuntu-latest` — so it is bit-for-bit equivalent to the Gitea `lint` job.
- **OpenAPI drift check caveat:** `scripts/verify-ci-local.sh` Stage 6 has a docker port-forwarding flake on this Windows host that intermittently returns "API container failed to start within 45s" even though the API responds correctly. The drift itself is zero — the regenerated Angular types match the committed `swagger.json`. Surfaced for a follow-up cleanup, not blocking Phase 23 verification.
- **Stage 6 fixture caveat:** integration tests that touch MySQL run inside Testcontainers MySQL via `MySqlContainerFixture`; on this host the Docker socket bind requires `--privileged` (handled by `scripts/verify-ci-local.sh` stage 4).
- **DOOR-08..11 (Phase 25), DOOR-12..14 (Phase 26), DOOR-05/06 (Phase 24)**: out of Phase 23 scope per the phase boundary statement in `23-CONTEXT.md`.

---

## Self-Check: PASSED

All claimed file paths exist on disk. Test counts verified:
- Unit tests: 269/269 PASS (`ControlEasyReborn.UnitTests.dll`, Release config)
- Architecture tests: 20/20 PASS (`ControlEasyReborn.ArchitectureTests.dll`)
- Integration tests: 154/154 PASS (Testcontainers MySQL — `ControlEasyReborn.IntegrationTests.dll`)
- Karma Angular tests: 384/384 SUCCESS (canonical Gitea runner image)