using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ControlEasyReborn.Modules.AccessControl.Application.Commands;
using ControlEasyReborn.Modules.AccessControl.Application.Handlers;
using ControlEasyReborn.Modules.AccessControl.Domain.Enums;
using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Application.Errors;
using ControlEasyReborn.Modules.Devices.Domain.Entities;
using ControlEasyReborn.Modules.Devices.Domain.Enums;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace ControlEasyReborn.Modules.Devices.Application.Handlers;

// Heart of Phase 25 (DOOR-08..11), repaired by the operational-simulator
// spec so one canonical credential decision produces the whole ledger:
//
//   1. Tenant opt-in flag check (404 hides the feature).
//   2. Device existence + IsActive + !RemovedAtUtc check.
//   3. Idempotency-key check (no event lost, none double-processed).
//   4. Strict direction validation for card_read / card_denied events
//      (payload_json "direction"; absent or unknown is a 400 validation
//      failure — the direction is never defaulted to Entrance).
//   5. Switch on event type:
//        CardRead: delegate EXACTLY ONCE to RecordAccessScanHandler —
//          the canonical credential decision (resolve, status/expiry,
//          destination, policy, visitor arrival, refusals). The result's
//          Decision/RefusalId/FailureCode/VisitId map onto truthful
//          result codes: recorded+visit → advanced_visit, recorded →
//          matched_dweller, refused/policy → denied_attempt.
//        CardDenied: refused scan (FailureCode=InvalidCredential) with the
//          validated direction.
//        Tamper / DoorForced: refused scan (FailureCode=TamperDetected)
//        ReaderReconnected: persist DeviceEvent, no ledger side effect
//        Heartbeat (Phase 26): dispatched to IngestHeartbeatHandler —
//          the row IS the device_heartbeats row, not the device_events ledger
//   6. Insert the DeviceEvent row LAST. The DeviceEvent row IS the ledger
//      marker — a row here means the matching Visit / AccessEvent /
//      RefusedScanAttempt rows have been written by the cross-module
//      handlers (single-write-path doctrine). Heartbeats DO NOT create a
//      DeviceEvent row (they have their own upsert table); the handler
//      short-circuits before the insert.
//
// All cross-module write paths funnel through:
//   RecordAccessScanHandler   (AccessControl.Application) — the ONLY
//                             credential decision: AccessEvent creation,
//                             visitor arrival (with the resolved visitor
//                             profile), and refusal writes
//   RecordRefusedScanHandler  (AccessControl.Application) — explicit
//                             reader-denial signals (card_denied, tamper,
//                             door_forced) that are not credential decisions
//   IngestHeartbeatHandler    (Devices.Application)    — device_heartbeats row
public sealed class IngestDeviceEventHandler
{
    private readonly IDeviceRepository _devices;
    private readonly IDeviceEventRepository _events;
    private readonly IDeviceHandler _deviceHandler;
    private readonly ITenantDoorIntegrationFlagLookup _tenantFlagLookup;
    private readonly RecordAccessScanHandler _recordScan;
    private readonly RecordRefusedScanHandler _recordRefused;
    private readonly IngestHeartbeatHandler _ingestHeartbeat;
    private readonly IValidator<DeviceEventPayload> _validator;
    private readonly ILogger<IngestDeviceEventHandler> _logger;
    private readonly IGatehouseLookup _gatehouses;

    public IngestDeviceEventHandler(
        IDeviceRepository devices,
        IDeviceEventRepository events,
        IDeviceHandler deviceHandler,
        ITenantDoorIntegrationFlagLookup tenantFlagLookup,
        RecordAccessScanHandler recordScan,
        RecordRefusedScanHandler recordRefused,
        IngestHeartbeatHandler ingestHeartbeat,
        IValidator<DeviceEventPayload> validator,
        IGatehouseLookup gatehouses,
        ILogger<IngestDeviceEventHandler>? logger = null)
    {
        _devices = devices;
        _events = events;
        _deviceHandler = deviceHandler;
        _tenantFlagLookup = tenantFlagLookup;
        _recordScan = recordScan;
        _recordRefused = recordRefused;
        _ingestHeartbeat = ingestHeartbeat;
        _validator = validator;
        _logger = logger ?? Microsoft.Extensions.Logging.Abstractions.NullLogger<IngestDeviceEventHandler>.Instance;
        _gatehouses = gatehouses;
    }

    public async Task<DeviceEventIngestionDto> HandleAsync(
        Guid tenantId,
        Guid deviceId,
        DeviceEventPayload payload,
        Guid? actorProfileId,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(payload, ct);
        if (!validation.IsValid)
        {
            throw new Application.Errors.ValidationException(validation.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()));
        }

        // Heartbeats short-circuit BEFORE the tenant-flag / device-lifecycle /
        // idempotency-key steps — they have their own heartbeat pipeline and
        // do NOT produce a device_events row. The IngestHeartbeatHandler does
        // its own tenant-flag + device-lifecycle checks; a TenantFlagOff or
        // DeviceInactive outcome surfaces as the same DTO code so the caller
        // sees a consistent shape.
        if (payload.EventType == DeviceEventType.Heartbeat)
        {
            var heartbeatShape = ParseHeartbeatShape(payload);
            await _ingestHeartbeat.HandleAsync(
                tenantId,
                deviceId,
                heartbeatShape.ErrorCount,
                heartbeatShape.EventsSinceLastSuccess,
                payload.OccurredAtUtc,
                ct);
            return BuildDto(
                DeviceEventResultCode.HeartbeatReceived,
                occurredAtUtc: payload.OccurredAtUtc,
                processedAtUtc: DateTime.UtcNow);
        }

        // 1. Tenant flag.
        var flagEnabled = await _tenantFlagLookup.IsEnabledAsync(tenantId, ct);
        if (!flagEnabled)
        {
            return BuildDto(DeviceEventResultCode.TenantFlagOff, occurredAtUtc: payload.OccurredAtUtc, processedAtUtc: DateTime.UtcNow);
        }

        // 2. Device lifecycle.
        var device = await _devices.GetByIdAsync(tenantId, deviceId, ct);
        if (device is null || device.IsRemoved || !device.IsActive)
        {
            return BuildDto(DeviceEventResultCode.DeviceInactive, occurredAtUtc: payload.OccurredAtUtc, processedAtUtc: DateTime.UtcNow);
        }
        // 3. Idempotency-key check.
        var existing = await _events.GetByIdempotencyKeyAsync(tenantId, deviceId, payload.SequenceNumber, payload.ExternalEventId, ct);
        if (existing is not null)
        {
            return BuildDto(
                DeviceEventResultCode.ReplayDuplicate,
                existingEventId: existing.Id,
                visitId: existing.VisitId,
                accessEventId: existing.AccessEventId,
                refusedScanAttemptId: existing.RefusedScanAttemptId,
                occurredAtUtc: existing.OccurredAtUtc,
                processedAtUtc: existing.ProcessedAtUtc,
                failureCode: existing.FailureCode);
        }

        if (payload.EventType != DeviceEventType.ReaderReconnected &&
            device.GatehouseId.HasValue &&
            !await _gatehouses.IsActiveAsync(tenantId, device.GatehouseId.Value, ct))
        {
            return BuildDto(DeviceEventResultCode.DeviceInactive, occurredAtUtc: payload.OccurredAtUtc, processedAtUtc: DateTime.UtcNow);
        }

        // Strict event direction for card_read / card_denied. The canonical
        // decision (RecordAccessScanHandler) must never be fed an inferred
        // direction: a missing or unknown payload_json "direction" is a
        // caller-side validation failure and rejects the event (HTTP 400
        // via ProblemDetails), instead of silently coercing to Entrance.
        CycleDirection eventDirection = CycleDirection.Entrance;
        var directionRequired = payload.EventType is DeviceEventType.CardRead or DeviceEventType.CardDenied;
        if (directionRequired)
        {
            if (!DeviceEventPayloadDirection.TryParse(payload.PayloadJson, out var parsedDirection))
            {
                throw new Application.Errors.ValidationException(new Dictionary<string, string[]>(StringComparer.Ordinal)
                {
                    ["direction"] = new[]
                    {
                        "payload_json must carry a valid \"direction\" of \"entrance\" or \"exit\" for card_read / card_denied events."
                    }
                });
            }

            eventDirection = parsedDirection;
        }

        // 4+5. Normalize through IDeviceHandler and dispatch.
        var normalized = _deviceHandler.Normalize(
            tenantId, deviceId,
            opaqueToken: payload.OpaqueToken ?? string.Empty,
            eventType: payload.EventType,
            occurredAtUtc: payload.OccurredAtUtc,
            sequenceNumber: payload.SequenceNumber,
            externalEventId: payload.ExternalEventId,
            payloadJson: payload.PayloadJson);

        var correlationId = Guid.NewGuid();
        var processedAtUtc = DateTime.UtcNow;
        var scanAttemptId = payload.ExternalEventId ?? Guid.NewGuid();

        Guid? visitId = null;
        Guid? accessEventId = null;
        Guid? refusedScanAttemptId = null;
        string resultCode;
        string? failureCode = null;

        switch (normalized.EventType)
        {
            case DeviceEventType.CardRead:
                {
                    // One canonical credential decision: RecordAccessScanHandler
                    // owns credential resolution, status/expiry, destination,
                    // consent policy, the visitor arrival (with the resolved
                    // visitor profile), and every refused-scan write. The
                    // ingestion path only carries the validated direction and
                    // maps the decision onto truthful result codes — it never
                    // resolves credentials itself and never registers arrivals.
                    var scanResult = await _recordScan.HandleAsync(
                        new RecordAccessScanCommand(
                            TenantId: tenantId,
                            QrPayload: payload.OpaqueToken ?? string.Empty,
                            Direction: eventDirection,
                            ScanAttemptId: scanAttemptId,
                            PerformedByProfileId: actorProfileId ?? Guid.Empty,
                            GatehouseId: device.GatehouseId,
                            ConfirmDuplicate: false),
                        ct);

                    accessEventId = scanResult.AccessEventId;
                    refusedScanAttemptId = scanResult.RefusalId;
                    visitId = scanResult.VisitId;
                    failureCode = scanResult.FailureCode;
                    resultCode = scanResult.Decision switch
                    {
                        // Visitor Entrance with a visit mutation (created or
                        // advanced) — exactly once, driven by the canonical
                        // arrival's durable VisitId link. A no-op re-arrival
                        // (already CheckedIn) returns VisitId null on purpose:
                        // no visit mutated, so the result is matched_dweller.
                        ScanDecisionKind.Recorded when scanResult.VisitId is not null
                            => DeviceEventResultCode.AdvancedVisit,
                        ScanDecisionKind.Recorded
                            => DeviceEventResultCode.MatchedDweller,
                        _ => DeviceEventResultCode.DeniedAttempt
                    };
                    break;
                }

            case DeviceEventType.CardDenied:
                // The reader explicitly denies a credential — record one
                // linked refusal with the validated direction. This is an
                // explicit reader signal, not a credential decision, so the
                // canonical scan handler is not involved.
                refusedScanAttemptId = await _recordRefused.HandleAsync(
                    new RecordRefusedScanCommand(
                        TenantId: tenantId,
                        ScanAttemptId: scanAttemptId,
                        CredentialFingerprint: payload.OpaqueToken is null ? null : Sha256(payload.OpaqueToken),
                        Direction: eventDirection,
                        FailureCode: RefusedScanFailureCode.InvalidCredential,
                        PerformedByProfileId: actorProfileId ?? Guid.Empty,
                        GatehouseId: device.GatehouseId,
                        OccurredAtUtc: normalized.OccurredAtUtc,
                        RelatedCredentialId: null,
                        RelatedSubjectId: null),
                    ct);
                resultCode = DeviceEventResultCode.DeniedAttempt;
                failureCode = RefusedScanFailureCode.InvalidCredential;
                break;

            case DeviceEventType.Tamper:
            case DeviceEventType.DoorForced:
                refusedScanAttemptId = await _recordRefused.HandleAsync(
                    new RecordRefusedScanCommand(
                        TenantId: tenantId,
                        ScanAttemptId: scanAttemptId,
                        CredentialFingerprint: null,
                        Direction: null,
                        FailureCode: RefusedScanFailureCode.TamperDetected,
                        PerformedByProfileId: actorProfileId ?? Guid.Empty,
                        GatehouseId: device.GatehouseId,
                        OccurredAtUtc: normalized.OccurredAtUtc,
                        RelatedCredentialId: null,
                        RelatedSubjectId: null),
                    ct);
                resultCode = DeviceEventResultCode.DeniedAttempt;
                failureCode = RefusedScanFailureCode.TamperDetected;
                break;

            case DeviceEventType.ReaderReconnected:
                resultCode = DeviceEventResultCode.ReaderReconnected;
                break;

            default:
                // Heartbeat is short-circuited above (before the switch).
                // Unknown event types are rejected by IngestDeviceEventValidator.
                throw new InvalidOperationException($"Unhandled event type: {normalized.EventType}");
        }

        // 6. Persist the DeviceEvent row (the ledger marker).
        var deviceEvent = new DeviceEvent(
            id: Guid.NewGuid(),
            tenantId: tenantId,
            deviceId: deviceId,
            eventType: normalized.EventType,
            payloadJson: normalized.PayloadJson ?? "{}",
            occurredAtUtc: normalized.OccurredAtUtc,
            processedAtUtc: processedAtUtc,
            sequenceNumber: normalized.SequenceNumber,
            externalEventId: normalized.ExternalEventId,
            resultCode: resultCode,
            failureCode: failureCode,
            visitId: visitId,
            accessEventId: accessEventId,
            refusedScanAttemptId: refusedScanAttemptId,
            correlationId: correlationId);

        try
        {
            await _events.InsertAsync(deviceEvent, ct);
        }
        catch (DuplicateIdempotencyKeyException)
        {
            // Race: a concurrent ingestion won the race; return its outcome.
            var existing2 = await _events.GetByIdempotencyKeyAsync(tenantId, deviceId, normalized.SequenceNumber, normalized.ExternalEventId, ct);
            if (existing2 is not null)
            {
                return BuildDto(
                    DeviceEventResultCode.ReplayDuplicate,
                    existingEventId: existing2.Id,
                    visitId: existing2.VisitId,
                    accessEventId: existing2.AccessEventId,
                    refusedScanAttemptId: existing2.RefusedScanAttemptId,
                    occurredAtUtc: existing2.OccurredAtUtc,
                    processedAtUtc: existing2.ProcessedAtUtc,
                    failureCode: existing2.FailureCode);
            }
            throw;
        }

        _logger.LogInformation(
            "Devices reader-event ingested deviceId={DeviceId} eventType={EventType} resultCode={ResultCode} correlationId={CorrelationId}",
            deviceId, normalized.EventType, resultCode, correlationId);

        return BuildDto(
            resultCode,
            visitId: visitId,
            accessEventId: accessEventId,
            refusedScanAttemptId: refusedScanAttemptId,
            occurredAtUtc: deviceEvent.OccurredAtUtc,
            processedAtUtc: deviceEvent.ProcessedAtUtc,
            failureCode: failureCode);
    }

    private static byte[] Sha256(string input)
    {
        var bytes = Encoding.UTF8.GetBytes(input);
        return SHA256.HashData(bytes);
    }

    // Phase 26 — extract the heartbeat counters from payload_json. The wire
    // format from Phase 25 reserves payload_json for free-form vendor data;
    // for heartbeats it carries the structured ErrorCount + EventsSinceLastSuccess
    // counters. Missing keys default to 0 (a heartbeat with no errors is the
    // common case).
    private static (int ErrorCount, int EventsSinceLastSuccess) ParseHeartbeatShape(DeviceEventPayload payload)
    {
        if (string.IsNullOrWhiteSpace(payload.PayloadJson))
        {
            return (0, 0);
        }

        try
        {
            using var doc = JsonDocument.Parse(payload.PayloadJson);
            var root = doc.RootElement;
            var errorCount = TryReadInt(root, "error_count");
            var eventsSinceLastSuccess = TryReadInt(root, "events_since_last_success");
            return (errorCount, eventsSinceLastSuccess);
        }
        catch (JsonException)
        {
            return (0, 0);
        }
    }

    private static int TryReadInt(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var element)) return 0;
        return element.ValueKind switch
        {
            JsonValueKind.Number when element.TryGetInt32(out var v) => v,
            JsonValueKind.String when int.TryParse(element.GetString(), out var v) => v,
            _ => 0
        };
    }

    private static DeviceEventIngestionDto BuildDto(
        string resultCode,
        Guid? existingEventId = null,
        Guid? visitId = null,
        Guid? accessEventId = null,
        Guid? refusedScanAttemptId = null,
        DateTime occurredAtUtc = default,
        DateTime processedAtUtc = default,
        string? failureCode = null) =>
        new(
            Outcome: resultCode,
            ExistingEventId: existingEventId,
            VisitId: visitId,
            AccessEventId: accessEventId,
            RefusedScanAttemptId: refusedScanAttemptId,
            OccurredAtUtc: occurredAtUtc == default ? DateTime.UtcNow : occurredAtUtc,
            ProcessedAtUtc: processedAtUtc == default ? DateTime.UtcNow : processedAtUtc,
            FailureCode: failureCode);
}
