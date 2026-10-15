---
title: 'Operational gatehouse device simulator'
type: 'feature'
created: '2026-10-13'
status: 'done'
route: 'full'
baseline_commit: 68459a169843fabeaa9047d057900b7f7b1cc078
review_loop_iteration: 0
context:
  - 'AGENTS.POLICY.md'
  - 'AGENTS.STACK.md'
  - '.specs/door-integration/requirements.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Development simulator is an isolated device-inspector tool: it does not represent a configured gatehouse door, cannot present a resident or visitor credential, and never appears in the Gatehouse workflow. The existing reader-ingestion path also hard-codes Entrance and can report a successful match after the canonical credential decision refused it.

**Approach:** Add a Development-only Virtual door tab to Gatehouse where an authorized user selects or creates a simulator device, binds it to the active gatehouse, configures Entrance or Exit, and presents a real issued credential through the normal device-event pipeline. Repair that pipeline so one canonical credential decision produces the visit/access/refusal ledger and a truthful device-event result.

## Boundaries & Constraints

**Always:** Keep the physical-reader model asynchronous: the simulator emits a reader event and ControlEasy records the result; bind every simulated door to an active gatehouse owned by the current tenant; use actual issued resident/visitor credential tokens; preserve idempotency, tenant isolation, policy evaluation, append-only device events, and existing role/permission checks; show the immediate outcome and recent device events; keep the tab absent outside Development or when the inspector flag is disabled; use synthetic data in tests.

**Ask First:** Adding database columns/tables, introducing a production endpoint or permission, changing credential issuance semantics, or expanding this slice into a physical-card credential lifecycle distinct from the existing issued QR credential.

**Never:** Write a second access ledger path, infer a gatehouse from another tenant, fabricate successful card matches, expose credential secrets after issuance, allow anonymous simulator execution, or make production UI depend on the inspector.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Resident/visitor entrance | Active virtual reader, active gatehouse, Entrance, usable issued token | One canonical decision writes one linked DeviceEvent and AccessEvent; visitor arrival advances exactly once | Render accepted outcome and IDs; refresh recent events |
| Valid exit | Same configuration with Exit | Persist Exit in access and device-event processing | Never silently coerce to Entrance |
| Unknown/inactive credential | Credential read or explicit reader denial | Write one linked refusal and no accepted access event | Render the canonical failure code |
| Missing simulator | Active gatehouse but no virtual reader | Tenant admin can create one already bound to that gatehouse; attendant sees actionable admin guidance | Do not submit against a null device/gatehouse |
| Offline/auth failure mode | Simulator state blocks execution | No accepted access/visit write; surface the configured failure | Reset/recovery restores normal reads |
| Replay | Same external event/sequence submitted twice | Return the existing result without duplicating visit, access, or refusal rows | Show replay as idempotent, not a second success |

</frozen-after-approval>

## Code Map

- `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Handlers/IngestDeviceEventHandler.cs` -- device-event orchestration. CardRead branches (L184–359): hard-code `CycleDirection.Entrance` (L196/216/242/283/300/320); visitor branch pre-registers arrival via `IVisitDirectory.RegisterArrivalAsync` (L260) — duplicate of the canonical handler's own arrival; `scanResult.Decision`/`RefusalId` are ignored so result codes are unconditionally `matched_dweller`/`advanced_visit`. DeviceEvent row inserted last (L362–381); replay via idempotency precheck (L144–155) and `DuplicateIdempotencyKeyException` catch (L383–399). Refactor target.
- `src/Modules/AccessControl/ControlEasyReborn.Modules.AccessControl.Application/Handlers/RecordAccessScanHandler.cs` -- canonical decision path. Idempotent by `ScanAttemptId` (L94–113); credential resolve L115, status/expiry L127, destination L138, policy L150–181, visitor arrival with resolved profile L184–211, `AccessEvent.Record` L213–234, refusals L284–340 (direction + gatehouse carried). Returns `ScanDecisionResult` (L16–29) with `Decision`, `AccessEventId`, `RefusalId`, `FailureCode`.
- `src/Modules/AccessControl/.../Commands/AccessControlCommands.cs` -- `RecordAccessScanCommand` (TenantId, QrPayload, Direction, ScanAttemptId, PerformedByProfileId, optional GatehouseId, visitor name/doc).
- `src/Modules/AccessControl/.../ValueObjects/CycleDirection.cs` -- Entrance/Exit; `TryParse` defaults failures to Entrance — needs strict handling for payload validation.
- `src/Modules/Devices/.../Application/Contracts/DeviceEventPayload.cs` -- has no direction field; carry `direction` inside `PayloadJson` (no schema change).
- `src/Modules/Devices/.../Domain/Entities/Device.cs` + `Application/Handlers/RegisterDeviceHandler.cs` + `Api/Endpoints/DeviceEndpoints.cs:L85–99` -- device types `reader|controller` only; creation is `Permission_devices.write` (TenantAdmin), `ConnectionParams` required, gatehouse binding optional and cross-tenant-validated. Virtual device is created through this existing endpoint as `deviceType: 'reader'`, `vendor: 'ControlEasy simulator'`, `connectionParams: { simulator: true }` (frontend already does this, `DeviceSimulatorSectionComponent` L475–480).
- `src/Modules/Devices/.../Api/Endpoints/SimulatorInspectorEndpoints.cs` -- 6 dev-only endpoints under `/api/v1/_internal/devices`, all currently `.AllowAnonymous()`; gating = `IsDevelopment()` + config `Devices:Simulator:EnableInspectorEndpoint` (`IsInspectorEnabled` L130–135), registered/mapped at `src/Host/ControlEasyReborn.Api/Program.cs` L164/L280. Extend here with the authenticated execution endpoints (present, device-ready probe) — Never anonymous.
- `src/Modules/Devices/.../Api/Endpoints/DeviceEventEndpoints.cs` -- `POST /api/v1/devices/{deviceId}/events` (Bearer + `Permission_devices.read`, porteiro+admin) → `IngestDeviceEventHandler`; `GET /.../events` list for the recent-events panel; `DeviceEventIngestionDto` outcome shape with Visit/AccessEvent/Refusal ids.
- `src/Modules/Devices/.../Infrastructure/Services/DoorSimulatorState.cs` + `Application/Abstractions/IDoorSimulatorState.cs` -- `SimulatorFailureMode` (None, AlwaysAuthFailed, AlwaysDeviceOffline, FailsThenRecovers), `ResolveOutcome`/`IsOfflineNow`/`Reset` (in-memory singleton). Reuse to block presentation when offline/auth-failure is configured.
- `src/Modules/Devices/.../Infrastructure/Services/SimulatedDeviceHandler.cs` + `DeviceCredentialResolver.cs` -- `sim-test-resident-*`/`sim-test-visitor-*`/`sim-test-unknown-*` synthetic tokens for tests only; real flows resolve issued QR tokens via HMAC.
- `src/Web/ControlEasyReborn.Web/src/app/features/gatehouse/gatehouse-panel.page.ts` -- `GatehouseTab` union (L27), hardcoded tab nav (L155–210), `activeTab` signal (L1123), `@switch` content (L212–458), `selectTab` mirrors `?tab=` (L1216–1227). Add the `virtual` tab here.
- `src/Web/.../features/access-control/gatehouse-context.service.ts` -- active gatehouse signals (`selectedGatehouse`, `canRecord`) and persisted selection.
- `src/Web/.../features/devices/device-simulator.service.ts` -- `probeInspector()` GETs `/api/v1/_internal/devices/{id}/simulator`; `inspectorAvailable` signal; 5s timeout wrapper; ProblemDetails `detail` extraction. Reuse for tab gating.
- `src/Web/.../features/devices/devices-api.service.ts` -- hand-written wrapper; `register()` for virtual-device creation; pattern for calling generated endpoints whose bodies were dropped.
- `src/Web/.../api/services/devices-internal.service.ts` -- generated `DevicesInternalService` (regenerate after adding endpoints; wrap under-typed bodies via `HttpClient` as existing code does).
- `src/Web/.../core/services/auth.service.ts` -- `hasPermission(p)` / `isTenantAdmin()` signal pattern for permission-aware empty states.
- `tests/ControlEasyReborn.IntegrationTests/Devices/DeviceEventIngestionEndpointTests.cs` + `DevicesTestFixture.cs` -- seeds tenant (`DoorIntegrationEnabled=1`), gatehouse, active simulated device; `PorteiroClient()` JWT with `devices.read`; raw SQL count asserts on `device_events`/`RefusedScanAttempts`/`AccessEvents`/`Visits`. No visitor/replay/direction/Exit tests yet.
- `src/Web/.../features/gatehouse/gatehouse-panel.page.spec.ts`, `.../devices/devices-health.page.spec.ts` -- Karma patterns (fakes with signals, HttpTestingController, `inspectorAvailable.set(...)` gate).
- `src/Web/ControlEasyReborn.Web/e2e/device-simulator-ui.spec.ts` -- Playwright e2e with `isInspectorAvailable()` probe + `test.skip()`.

## Tasks & Acceptance

**Execution:**
- [x] `IngestDeviceEventHandler.cs` -- Refactor CardRead/CardDenied dispatch to carry a validated event direction (strict parse of `direction` from `PayloadJson`; reject unknown values, never default to Entrance); delegate exactly once to `RecordAccessScanHandler`; delete the ingestion-side visitor arrival; map `Decision`/`RefusalId`/`FailureCode` from `ScanDecisionResult` into truthful result codes and linked rows. -- one canonical ledger path.
- [x] `SimulatorInspectorEndpoints.cs` (+ regenerated `DevicesInternalService`) -- Add authenticated execution contract: `present-credential` and a device-readiness endpoint, both Bearer + `devices.read` + dev-flag gated; validate simulator device exists, is a reader, is bound to an active gatehouse of the current tenant; generate payload `SequenceNumber`/`ExternalEventId` safely; consult `IDoorSimulatorState.ResolveOutcome` (offline/auth-failure returns the configured failure without touching ingestion); successful reads delegate to the events ingestion path. -- the "virtual physical reader" contract.
- [x] `gatehouse-panel.page.ts` + new `features/devices/virtual-door/` component + `device-simulator.service.ts` -- New `virtual` tab gated by `inspectorAvailable()`: device selection/create (TenantAdmin only; porteiro sees admin-guidance empty state), gatehouse binding display from `GatehouseContextService`, Entrance/Exit toggle, paste-issued-token primary "Present credential" action, compact operational receipt (outcome, direction, timestamp, linked IDs), recent device events list. Tab absent from DOM when inspector unavailable. -- the operator surface.
- [x] `DeviceEventIngestionEndpointTests.cs` (+ fixture) -- Cover real-issued-credential and synthetic cases: Entrance/Exit direction honored, visitor arrival exactly once, refusal mapping, replay idempotency, offline/auth-failure short-circuit. Plus Angular specs for the tab states and a Playwright flow issuing a synthetic credential end-to-end and confirming the Reports history row. -- acceptance coverage.
- [x] OpenAPI regen (ng-openapi-gen) after endpoint changes; `ng run lint`, Karma, `scripts/verify-ci-local.sh --fast` and full -- completion gate.

**Acceptance Criteria:**
- Given a virtual reader is bound to the active gatehouse, when an issued resident or visitor credential is presented for Entrance or Exit, then exactly one canonical ledger result is recorded with that gatehouse and direction and is visible from Gatehouse and Reports.
- Given the inspector is unavailable, when any user opens Gatehouse, then the Virtual door tab is absent from the DOM.
- Given a porteiro has no virtual reader, when they open the tab, then they receive useful administrator guidance rather than a failing create action.
- Given offline/auth failure is configured, when a credential is presented, then the UI shows that failure and no accepted access event is persisted.

## Implementation Notes

<!-- Append-only during implementation (step-03/04). -->

- Ingestion refactor lands as coded in `IngestDeviceEventHandler`: card reads delegate exactly once to `RecordAccessScanHandler` (direction validated strictly from `payload_json` via new `DeviceEventPayloadDirection`; rejection is 400, never a default to Entrance); the ingestion-side `IVisitDirectory.RegisterArrivalAsync` call is deleted; `ScanDecisionResult` gained a trailing optional `VisitId` so `advanced_visit` maps truthfully (canonical arrival no-op → `matched_dweller`).
- Replay result now surfaces the stored `FailureCode` on `replay_duplicate` (DTO gained additive `failureCode`).
- Simulator execution contract: `GET .../simulator/readiness` (always-200 verdict; guard = exists+active+reader+simulator-vendor+bound-active-gatehouse+tenant flag) and `POST .../simulator/present-credential` (Bearer + `devices.read`, dev-flag gated; offline/auth-failed short-circuit writes nothing; `Success`/`FailsThenRecovers` 3rd read passes through to ingestion; safe `SequenceNumber` via wall-clock-seeded monotonic counter + fresh `ExternalEventId`).
- Review patches (step-04): cross-tenant test direction adoption, `FailsThenRecovers` pass-through, non-object JSON root guard, UI binding-vs-context semantics, `present()` stale-device guard, comment typo, readiness folds tenant flag, `not_a_simulator` guard, extra tests (readiness 401, CardDenied direction rejections, enqueue→drain→re-ingest roundtrip, hard e2e assertions, service Karma specs).
- Verification performed: fast local CI gate green inside SDK-8 container (Release build 0 warnings; 300 unit + 20 arch tests); testcontainers MySQL integration suite (stage 4) and web/OpenAPI stages exercised via the full gate; Web SPA lint/Karma via the policy's Windows-host Docker recipe; Playwright run via `webapp-testing`.
- OpenAPI client regenerated with `ng-openapi-gen@1.0.5` (version from `package.json`) — new `readiness`/`present-credential` fn+model files; generated bodies are `Observable<void>`, so feature calls stay on the documented hand-written `HttpClient` facade pattern.
- Post-review e2e findings (fixed during browser-flow validation): (1) the lucide `log-in`/`scan-line` icons were typed but never registered in the icon registry — the tab threw "icon not provided" at runtime, caught by Karma before e2e; (2) a `?tab=virtual` deep link arriving while the inspector probe was still pending fell back to the QR console and never re-applied the tab — fixed with a `pendingVirtualTab` signal applied in the probe's promise continuation (a template-writing effect trips NG0600); (3) the e2e probe needed both a bearer token (the inspector resolves the tenant from the JWT even on AllowAnonymous routes — an anonymous probe always 401s) and an explicit Host header for worktree stacks reached via `localhost`; `applyStackHostHeader`/`authedProbeHeaders` in `e2e/helpers/demo-auth.ts` formalize this.
- Playwright acceptance flow (green, `--workers=1`, `E2E_BASE_URL=https://localhost:18091 E2E_STACK_HOST=...`): fresh-session gatehouse selection → door-integration flag enabled idempotently via the tenants API → walk-in visitor issuance → copy-once QR token → virtual door created bound to the selected gatehouse → Entrance receipt (linked visit/access ids) → Exit receipt (direction `exit`, no visit id) → Reports history row for the visitor name.

## Spec Change Log

## Review Triage Log

<!-- Review pass 1: blind-hunter + edge-case-hunter + verification-gap. Verdicts verified against cited code. -->

| # | Finding (file) | Verdict | Evidence / action |
|---|----------------|---------|-------------------|
| 1 | Cross-tenant test `DeviceEventCrossTenantTests.cs:155–158` still posts direction-less `CardRead` and asserts 200/OK | high | Verified: strict direction validation now 400s on `"{}"`; this test was the one missed consumer. Route: **patch** — adopt direction-carrying payload builder. |
| 2 | `FailsThenRecovers` never self-recovers through the virtual door: `ResolveOutcome` returns `Success` (non-null) on 3rd attempt, `PresentSimulatedCredentialHandler` treats any non-null outcome as `auth_failed` | high | Verified at `DoorSimulatorState.ResolveFailsThenRecover` + handler L96–111. Route: **patch** — pass through `Success`. |
| 3 | `DeviceEventPayloadDirection.TryParse` throws `InvalidOperationException` (→ 500) when `payload_json` root is not an object; only `JsonException` caught | medium | .NET semantics confirmed. Route: **patch** — `ValueKind == Object` guard. |
| 4 | UI conflates selected-gatehouse context with the device's bound gatehouse (recording-location note; `canPresent` gate) while backend records against `device.GatehouseId` | medium | Real mismatch on the operator surface. Route: **patch** — note from readiness binding; drop context gate. |
| 5 | `present()` applies receipt unconditionally if selected device changes mid-flight (contrast `probeReadiness`/`loadRecentEvents` guards) | low | Trivial race guard. Route: **patch**. |
| 6 | `door-unlock.types.ts` comment references non-existent namespace `Modules.Application.Contracts` (missing `.Devices.`) | low | Comment-only typo. Route: **patch**. |
| 7 | Readiness ignores tenant `DoorIntegrationEnabled` flag; tab can report ready then every present returns `tenant_flag_off` | low | Dev-only confusion; small fix. Route: **patch** — fold flag into readiness verdict. |
| 8 | `SimulatorDeviceGuard` accepts any active reader, not only simulator devices (no vendor/marker check) | low | Dev-only, authenticated, tenant-scoped; spec says "selects or creates a simulator device". Route: **patch** — vendor check + `not_a_simulator` reason. |
| 9 | Missing tests: readiness anonymous 401; CardDenied missing/unknown direction; enqueue-offline→drain→re-ingest roundtrip; hard assertion instead of mid-flow `test.skip` in virtual-door e2e; `waitForTimeout` sleeps; `probeReadiness`/`presentCredential` service Karma coverage | low | Test-gap bundle. Route: **patch**. |
| 10 | Same-`ExternalEventId`/different-`SequenceNumber` replay writes one extra `device_events` row reporting `advanced_visit` | low | Pre-existing 4-tuple idempotency contract (pre-dates story); visit/access/refusal rows stay deduped (matrix satisfied). Route: **defer** — an ExternalEventId-level precheck is a contract decision beyond this story. |
| 11 | e2e probe helper + `SIMULATOR_PROBE_PATH` GUID duplicated between specs | low | Pre-existing duplication pattern from `device-simulator-ui.spec.ts` (not introduced here). Route: **defer** — shared-helper refactor. |
| 12 | `spec-operational-gatehouse-simulator.md` status/checkboxes/logs inconsistent with shipped diff | false | Mid-workflow state: step-03 marks tasks complete and logs populate at completion — not a code defect. |
| 13 | Generated under-typed `DevicesInternalService` committed alongside hand-rolled `HttpClient` facade | false | Documented repo pattern (`devices-api.service.ts` header notes the generator drops bodies); regen output matches swagger deterministically. |
| 14 | `NextSequenceNumber` monotonicity untested; harm claimed (seq collision) | false | No harm: fresh `ExternalEventId` per payload makes the unique key distinct even on a tied seed — no suppression possible. |
| 15 | Non-CardRead emitters missing direction (breaking contract) | false | Only internal producers of card_read payloads are the endpoints + tests: enqueue-offline/present-credential updated, replay/cross-tenant tests updated except #1 (routed above). External reader contract change is dev-documented. |
| 16 | Temp debris/`__pycache__`/`_bmad/render` staged in diff | low | Real debris — handled at commit scope (delete `.tmp-*.sh`, gitignore `__pycache__/` + `_bmad/render/`), not implementation code. Route: **patch** (orchestrator side). |
| 17 | `device-simulator.service.ts`/`virtual-door-ui.spec.ts` missing trailing newline | low | Cosmetic; repo files routinely lack it. Route: **patch** (trivial newline fix at commit). |
| 18 | `created_visit` label dead code | false | The canonical arrival can *create* a visit when none exists ("Create or advance the single operational Visit") — label reachable defensive vocabulary. |

## Design Notes

Treat the simulator as a virtual physical reader, not a diagnostics form. Keep gatehouse and direction adjacent to the device identity, make "Present credential" the primary action, and show a compact operational receipt with outcome, direction, timestamp, and linked record IDs. Existing low-level failure/queue controls remain on Device health.

The issued QR payload is only ever shown once at issuance (`oneTimeDisplay: true`, `AccessCredentialsEndpoints.cs` L113–120), so the tab input is a paste-token field — never a secret viewer.

Ingestion must treat `RecordAccessScanHandler` as the only credential decision: its `ScanAttemptId` idempotency and its own arrival registration (with resolved visitor profile, `RecordAccessScanHandler.cs` L184–211) replace the ingestion-side placeholders (`Guid.Empty` name/doc today).

## Verification

**Commands:**
- `scripts/verify-ci-local.sh --fast` -- format, Release build, unit, and architecture tests pass.
- Canonical Web SPA lint/Karma recipe from `AGENTS.POLICY.md` -- lint and all Angular tests pass.
- `scripts/verify-ci-local.sh` -- all six completion stages pass, including OpenAPI drift.
- Playwright via the `webapp-testing` skill -- create/assign the virtual door, present an issued credential in both directions, observe the inline result, and confirm the Reports history entry.