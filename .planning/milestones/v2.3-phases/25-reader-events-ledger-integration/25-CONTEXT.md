# Phase 25: Reader Events & Ledger Integration - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous mode — decisions sourced from `.planning/milestones/v2.3-REQUIREMENTS.md`, Phase 23/24 CONTEXT.md, the existing `AccessControl` + `Visits` write-path conventions, `.specs/door-integration/requirements.md`, constitution v1.7.0)

<domain>
## Phase Boundary

Phase 25 wires reader-event ingestion into the platform's existing ledger machinery without inventing a second write path. After 25 ships:
- A simulated reader event is ingested via `POST /api/v1/devices/{deviceId}/events` and normalized into a unified `DeviceEvent` model through `IDeviceHandler` — business logic stays vendor-agnostic (DOOR-08).
- Every ingested event is persisted in a new `device_events` table with tenant scoping via `ITenantAwareLinqFactory`, recording both `occurred_at` (the event time) and `processed_at` (the ingestion time) — DOOR-09.
- A card-match event creates the corresponding entry-log/ledger record automatically on the post-cleanup contract: a new `Visit` (status `CheckedIn`) via the existing `VisitorArrivalHandler` write path + an `AccessEvent` audit-context row linked to that `VisitId`. Unknown-card events write a `RefusedScanAttempt` and create NO `Visit` and NO `AccessEvent` (the "denied attempt" path) — DOOR-10.
- Events queued during downtime are replayed when the simulated device reconnects; `processed_at` distinguishes ingestion time from event time; replay is idempotent (no event lost, none double-processed) — DOOR-11.

**Scope split:**
- DOOR-08: `IDeviceHandler` abstraction + `SimulatedDeviceHandler` + `POST /api/v1/devices/{deviceId}/events`
- DOOR-09: `device_events` table + `IDeviceEventRepository` (append-only, no UPDATE/DELETE methods)
- DOOR-10: Card-match → `VisitorArrivalHandler` + `AccessControl.RecordAccessScanHandler` → Visit + AccessEvent ledger rows. Unknown-card → `AccessControl.RecordRefusedScanHandler` → RefusedScanAttempt.
- DOOR-11: In-memory event queue per device + idempotent replay keyed on `device_id + sequence_number`.

**Out of scope (deferred):**
- DOOR-01..07/15 (unlock foundation) → Phase 23
- DOOR-05/06 (admin UI) → Phase 24
- DOOR-12..14 (heartbeats + health dashboard + offline toast) → Phase 26
- Real vendor drivers → v2.5 Phases 32–34

</domain>

<decisions>
## Implementation Decisions

### Single write-path discipline (constitutional)
- Every reader event that creates a visitor entry flows through the existing **`VisitorArrivalHandler.HandleAsync`** (Visits.Application) + **`RecordAccessScanHandler`** (AccessControl.Application). DOOR-10 explicitly mandates this — no second door into the Visits data model. Reuse, do not fork.
- Card-match lookup uses the existing **`AccessControlHmacKeyProvider`-style** credential resolver: hash the card identifier (already SHA-256'd by the device protocol in real life; the simulator passes a synthetic opaque token), look up the active `AccessCredentials` row, derive the subject type + id + destination apartment. **No change** to credential resolution logic — it already handles `SubjectType=Resident` (dweller) + `SubjectType=Visitor` (pre-authorized visitor). Dweller pre-consent (`entered_with_consent`) is the same `PolicyOutcome` the existing handler emits.
- Unknown-card events do NOT create a Visit; they write a `RefusedScanAttempt` via the existing `RecordRefusedScanHandler` (read its current contract and reuse the same `FailureCode` enum — adding `UnknownCardAtReader` as a new code).

### `IDeviceHandler` abstraction
- Lives in `src/Modules/Devices/ControlEasyReborn.Modules.Devices.Application/Abstractions/IDeviceHandler.cs`. Method: `Task<DeviceEventIngestionResult> HandleEventAsync(Guid tenantId, Guid deviceId, DeviceEventPayload payload, CancellationToken ct)`.
- `DeviceEventPayload` is vendor-agnostic: `{ eventType: "card_read" | "card_denied" | "tamper" | "door_forced" | "reader_reconnected", occurredAtUtc: DateTime, sequenceNumber: long, opaqueToken?: string, payloadJson: JsonElement }`. The `payloadJson` carries any vendor-specific extras; business logic reads it via `payload.GetProperty("...")`.
- `DeviceEventIngestionResult` is discriminated: `CreatedVisit(visitId, accessEventId)`, `MatchedDweller(accessEventId)`, `DeniedAttempt(refusedScanAttemptId)`, `ReplayDuplicate(alreadyProcessedEventId)`, `DeviceInactive`, `TenantFlagOff`.
- `SimulatedDeviceHandler : IDeviceHandler` is the concrete in-process implementation. Reads/writes `DoorSimulatorState` (Phase 23's simulator state — extended with a `RecordedEvents` list and a `SimulateCardRead(opaqueToken, sequenceNumber, occurredAtUtc)` helper that integration tests call). Returns the right `DeviceEventIngestionResult` based on the event type + simulator config.

### `device_events` table
- `Id CHAR(36) PK`, `TenantId CHAR(36) NOT NULL`, `DeviceId CHAR(36) NOT NULL`, `EventType VARCHAR(40) NOT NULL`, `PayloadJson JSON NOT NULL`, `OccurredAtUtc DATETIME(6) NOT NULL`, `ProcessedAtUtc DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`, `SequenceNumber BIGINT NOT NULL`, `ExternalEventId CHAR(36) NULL` (used for idempotent replay — same value across reconnects means "this is the same event"), `ResultCode VARCHAR(40) NOT NULL` (e.g., `created_visit`, `matched_dweller`, `denied_attempt`, `replay_duplicate`, `device_inactive`), `VisitId CHAR(36) NULL`, `AccessEventId CHAR(36) NULL`, `RefusedScanAttemptId CHAR(36) NULL`, `CorrelationId CHAR(36) NOT NULL`, `tenant_id CHAR(36) NOT NULL`.
- Idempotency UNIQUE constraint: `uq_device_events_idempotent (tenant_id, device_id, sequence_number, external_event_id)` — `external_event_id` is NULL-able but the constraint still enforces uniqueness for non-null rows. The combination `(device_id, sequence_number, external_event_id)` is the canonical idempotency key.
- Index `ix_device_events_tenant_device_time (tenant_id, device_id, occurred_at_utc)`.
- NO UPDATE/DELETE triggers needed — the table is naturally append-only by API contract (no endpoints expose update/delete). The repository surface exposes only `InsertAsync` + `GetByIdempotencyKeyAsync` + `ListAsync(tenantId, deviceId, since)`. The absence of update/delete on the abstraction is intentional.

### Idempotent replay (DOOR-11)
- The endpoint `POST /api/v1/devices/{deviceId}/events` accepts a body that includes `externalEventId` (the device's own event id — e.g., a UUID generated by the device firmware or by the simulator). On each call, the handler:
  1. Checks `IDeviceEventRepository.GetByIdempotencyKeyAsync(tenantId, deviceId, sequenceNumber, externalEventId)`. If a row exists with the same key, returns `DeviceEventIngestionResult.ReplayDuplicate(existingEventId)` — NO side effects re-fire.
  2. Otherwise, processes the event (card lookup → visit creation OR refused attempt).
  3. Inserts the `DeviceEvent` row inside the same transaction as the side-effect rows (Visit / AccessEvent / RefusedScanAttempt). If any step throws, the entire transaction rolls back — no partial state.
- The in-process simulator exposes `EnqueueOffline(deviceId, count)` (test-only) that pre-loads `count` events into a per-device queue with monotonically increasing `sequenceNumber` and a shared `externalEventId` prefix. When the device reconnects (`POST /events` resumes), the queued events drain in order. The integration test `IdempotentReplay_AfterDisconnection_NoEventLostNoDoubleProcessing` proves the no-lost-no-double contract.
- A redelivered event with the same `(deviceId, sequenceNumber, externalEventId)` returns `ReplayDuplicate` — the original side effects stand. A redelivered event with the same `(deviceId, sequenceNumber)` but a DIFFERENT `externalEventId` is treated as a conflict and returns 409 ProblemDetails (`title="device-event-sequence-conflict"`).

### Card-match resolution
- The opaque token is hashed (SHA-256) by `IDeviceCredentialResolver` (new abstraction in Devices.Application). The hash is looked up against `AccessCredentials.SecretVerifier` (which already stores the hash for credential lookup). The existing `IAccessCredentialRepository.FindByHashAsync(tenantId, sha256Hash)` (verify exists in AccessControl) returns the credential row.
- If `Status != Active` or `ValidFromUtc > now` or `ExpiresAtUtc < now`, the event is treated as `denied_attempt` with `FailureCode="credential_inactive"` or `"credential_expired"` — mirroring the existing AccessControl failure-code vocabulary.
- If no credential matches, the event is `denied_attempt` with `FailureCode="unknown_card"`.
- If a credential matches AND `SubjectType == Resident`, the event is `matched_dweller` — the system creates an `AccessEvent` (AuditContext kind=Access, no Visit) via the existing `RecordAccessScanHandler`. The dweller's pre-consent policy outcome is computed by the existing policy resolver.
- If a credential matches AND `SubjectType == Visitor`, the event is `created_visit` (or `advanced_visit` if a Pending Visit already exists for that visitor's document at the destination apartment — the existing `VisitorArrivalHandler` returns `VisitMutated=false` in that case, which we map to `matched_dweller` for the result code to keep the result vocabulary tight).

### Replay-on-reconnect simulation
- The simulator `DoorSimulatorState.EnqueueOffline(deviceId, count)` is exposed via the dev-only inspector endpoint `POST /api/v1/_internal/devices/{deviceId}/simulator/enqueue-offline` (guarded by `IWebHostEnvironment.IsDevelopment()` and the existing config flag from Phase 23).
- The integration test enqueues 5 events with `sequenceNumber=1..5`, disconnects (no API call), reconnects (5 sequential `POST /events`), asserts each `DeviceEvent` row exists once with the right `resultCode`, and asserts the visits + access ledger rows are exactly 5 (no doubling).

### Endpoint contract
- `POST /api/v1/devices/{deviceId}/events` — body: `{ eventType, occurredAtUtc, sequenceNumber, externalEventId, opaqueToken?, payloadJson? }`. Returns `Results<Ok<DeviceEventIngestionDto>, ValidationProblem, ProblemHttpResult>` with the discriminated outcome.
- `GET /api/v1/devices/{deviceId}/events?since={iso8601}&limit={int}` — returns the device's `device_events` rows for debugging + admin visibility. TenantAdmin or TenantAdmin-equivalent role. Does NOT include the payload_json (size + may contain vendor PII) — only the metadata. The `payload_json` IS queryable via a separate `GET /api/v1/devices/{deviceId}/events/{eventId}/payload` for support engineers, gated to TenantAdmin only and audit-logged.

### Cross-tenant isolation
- Every event ingestion path goes through `ITenantAwareLinqFactory` for both `Devices` lookup (must belong to the actor's tenant) AND `AccessCredentials` lookup (credential id is tenant-scoped by the existing AccessControl abstraction). The endpoint checks `Tenant.DoorIntegrationEnabled` BEFORE processing (404 when off — same as unlock).
- A card that belongs to tenant B's credentials CANNOT match a tenant-A device event. The hash is global; the lookup filters by `tenant_id` first.

### No UI work in this plan
- Reader-event ingestion is invisible to operators in real time. There is no "live events" dashboard in Phase 25. Admin visibility into the `device_events` log is deferred to a future UI phase. Phase 26's health dashboard does NOT include event-pipeline metrics.
- The integration test suite is the verification surface for Phase 25 — no Playwright tests are added.

</decisions>