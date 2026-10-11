using System.Security.Cryptography;
using System.Text;
using ControlEasyReborn.Modules.AccessControl.Application.Commands;
using ControlEasyReborn.Modules.AccessControl.Application.Handlers;
using ControlEasyReborn.Modules.AccessControl.Domain.Enums;
using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Application.Errors;
using ControlEasyReborn.Modules.Devices.Domain.Entities;
using ControlEasyReborn.Modules.Devices.Domain.Enums;
using ControlEasyReborn.Modules.Visits.Application.Abstractions;
using ControlEasyReborn.Modules.Visits.Application.Handlers;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace ControlEasyReborn.Modules.Devices.Application.Handlers;

// Heart of Phase 25 (DOOR-08..11):
//
//   1. Tenant opt-in flag check (404 hides the feature).
//   2. Device existence + IsActive + !RemovedAtUtc check.
//   3. Idempotency-key check (no event lost, none double-processed).
//   4. Card-credential resolution via SHA-256 hash + AccessCredentials.
//   5. Switch on event type:
//        CardRead:
//          - unknown token       → refused scan (FailureCode=UnknownCard)
//          - inactive/expired    → refused scan (CredentialInactive/Expired)
//          - Resident            → RecordAccessScanHandler (creates AccessEvent)
//          - Visitor             → VisitorArrivalHandler + RecordAccessScanHandler
//                                 (creates/advances Visit + AccessEvent)
//        CardDenied: refused scan (FailureCode=InvalidCredential)
//        Tamper / DoorForced: refused scan (FailureCode=TamperDetected)
//        ReaderReconnected: persist DeviceEvent, no ledger side effect
//   6. Insert the DeviceEvent row LAST. The DeviceEvent row IS the ledger
//      marker — a row here means the matching Visit / AccessEvent /
//      RefusedScanAttempt rows have been written by the cross-module
//      handlers (single-write-path doctrine).
//
// All cross-module write paths funnel through:
//   VisitorArrivalHandler (Visits.Application)    — Visit creation / advance
//   RecordAccessScanHandler   (AccessControl.Application) — AccessEvent creation
//   RecordRefusedScanHandler  (AccessControl.Application) — RefusedScanAttempt
public sealed class IngestDeviceEventHandler
{
    private readonly IDeviceRepository _devices;
    private readonly IDeviceEventRepository _events;
    private readonly IDeviceCredentialResolver _credentialResolver;
    private readonly IDeviceHandler _deviceHandler;
    private readonly ITenantDoorIntegrationFlagLookup _tenantFlagLookup;
    private readonly RecordAccessScanHandler _recordScan;
    private readonly RecordRefusedScanHandler _recordRefused;
    private readonly IVisitDirectory _visitDirectory;
    private readonly IValidator<DeviceEventPayload> _validator;
    private readonly ILogger<IngestDeviceEventHandler> _logger;

    public IngestDeviceEventHandler(
        IDeviceRepository devices,
        IDeviceEventRepository events,
        IDeviceCredentialResolver credentialResolver,
        IDeviceHandler deviceHandler,
        ITenantDoorIntegrationFlagLookup tenantFlagLookup,
        RecordAccessScanHandler recordScan,
        RecordRefusedScanHandler recordRefused,
        IVisitDirectory visitDirectory,
        IValidator<DeviceEventPayload> validator,
        ILogger<IngestDeviceEventHandler>? logger = null)
    {
        _devices = devices;
        _events = events;
        _credentialResolver = credentialResolver;
        _deviceHandler = deviceHandler;
        _tenantFlagLookup = tenantFlagLookup;
        _recordScan = recordScan;
        _recordRefused = recordRefused;
        _visitDirectory = visitDirectory;
        _validator = validator;
        _logger = logger ?? Microsoft.Extensions.Logging.Abstractions.NullLogger<IngestDeviceEventHandler>.Instance;
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
                processedAtUtc: existing.ProcessedAtUtc);
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
                    var match = await _credentialResolver.ResolveAsync(tenantId, payload.OpaqueToken, ct);
                    if (match is null)
                    {
                        refusedScanAttemptId = await _recordRefused.HandleAsync(
                            new RecordRefusedScanCommand(
                                TenantId: tenantId,
                                ScanAttemptId: scanAttemptId,
                                CredentialFingerprint: payload.OpaqueToken is null ? null : Sha256(payload.OpaqueToken),
                                Direction: CycleDirection.Entrance,
                                FailureCode: RefusedScanFailureCode.UnknownCard,
                                PerformedByProfileId: actorProfileId ?? Guid.Empty,
                                GatehouseId: device.GatehouseId,
                                OccurredAtUtc: normalized.OccurredAtUtc,
                                RelatedCredentialId: null,
                                RelatedSubjectId: null),
                            ct);
                        resultCode = DeviceEventResultCode.DeniedAttempt;
                        failureCode = RefusedScanFailureCode.UnknownCard;
                        break;
                    }

                    if (!match.IsActive || match.ExpiresAtUtc is { } exp && exp <= normalized.OccurredAtUtc)
                    {
                        refusedScanAttemptId = await _recordRefused.HandleAsync(
                            new RecordRefusedScanCommand(
                                TenantId: tenantId,
                                ScanAttemptId: scanAttemptId,
                                CredentialFingerprint: null,
                                Direction: CycleDirection.Entrance,
                                FailureCode: match.ExpiresAtUtc is { } e && e <= normalized.OccurredAtUtc
                                    ? RefusedScanFailureCode.CredentialExpired
                                    : RefusedScanFailureCode.CredentialInactive,
                                PerformedByProfileId: actorProfileId ?? Guid.Empty,
                                GatehouseId: device.GatehouseId,
                                OccurredAtUtc: normalized.OccurredAtUtc,
                                RelatedCredentialId: match.CredentialId,
                                RelatedSubjectId: match.SubjectId),
                            ct);
                        resultCode = DeviceEventResultCode.DeniedAttempt;
                        failureCode = match.ExpiresAtUtc is { } e2 && e2 <= normalized.OccurredAtUtc
                            ? RefusedScanFailureCode.CredentialExpired
                            : RefusedScanFailureCode.CredentialInactive;
                        break;
                    }

                    // Matched + active. Dispatch through the unified scan handler.
                    if (string.Equals(match.SubjectType, "Resident", StringComparison.Ordinal))
                    {
                        // Resident destination is looked up inside RecordAccessScanHandler
                        // (via AccessEventDestinationResolver -> IResidentDirectory).
                        var scanResult = await _recordScan.HandleAsync(
                            new RecordAccessScanCommand(
                                TenantId: tenantId,
                                QrPayload: payload.OpaqueToken ?? string.Empty,
                                Direction: CycleDirection.Entrance,
                                ScanAttemptId: scanAttemptId,
                                PerformedByProfileId: actorProfileId ?? Guid.Empty,
                                GatehouseId: device.GatehouseId,
                                ConfirmDuplicate: false),
                            ct);
                        accessEventId = scanResult.AccessEventId;
                        visitId = scanResult.DestinationApartmentId is not null
                            ? null  // Residents don't create Visits; AccessEvent is enough.
                            : null;
                        resultCode = DeviceEventResultCode.MatchedDweller;
                    }
                    else if (string.Equals(match.SubjectType, "Visitor", StringComparison.Ordinal))
                    {
                        // Step 1: register the visitor arrival (creates/advances the Visit)
                        // — the canonical Phase 16 single-write-path. The destination
                        // metadata is resolved by VisitDirectory from the credential's
                        // SubjectId (a Visitor credential's SubjectId IS a Visit.Id).
                        var arrivalResult = await _visitDirectory.RegisterArrivalAsync(
                            new VisitorArrivalCommand(
                                TenantId: tenantId,
                                VisitorName: "Visitor",
                                VisitorDocument: string.Empty,
                                VisitorPhone: null,
                                DestinationApartmentId: Guid.Empty,
                                DestinationBlock: string.Empty,
                                DestinationUnit: string.Empty,
                                Purpose: null,
                                AttendantProfileId: actorProfileId,
                                GatehouseId: device.GatehouseId,
                                OccurredAtUtc: normalized.OccurredAtUtc),
                            ct);
                        visitId = arrivalResult.VisitMutated ? arrivalResult.Visit.Id : null;

                        // Step 2: dispatch through RecordAccessScanHandler (creates the
                        // AccessEvent linked to the VisitId via its internal destination
                        // resolver).
                        var scanResult = await _recordScan.HandleAsync(
                            new RecordAccessScanCommand(
                                TenantId: tenantId,
                                QrPayload: payload.OpaqueToken ?? string.Empty,
                                Direction: CycleDirection.Entrance,
                                ScanAttemptId: scanAttemptId,
                                PerformedByProfileId: actorProfileId ?? Guid.Empty,
                                GatehouseId: device.GatehouseId,
                                ConfirmDuplicate: false),
                            ct);
                        accessEventId = scanResult.AccessEventId;
                        resultCode = arrivalResult.VisitMutated ? DeviceEventResultCode.AdvancedVisit : DeviceEventResultCode.MatchedDweller;
                    }
                    else
                    {
                        // Unknown subject type — treat as denied.
                        refusedScanAttemptId = await _recordRefused.HandleAsync(
                            new RecordRefusedScanCommand(
                                TenantId: tenantId,
                                ScanAttemptId: scanAttemptId,
                                CredentialFingerprint: null,
                                Direction: CycleDirection.Entrance,
                                FailureCode: RefusedScanFailureCode.SubjectInactive,
                                PerformedByProfileId: actorProfileId ?? Guid.Empty,
                                GatehouseId: device.GatehouseId,
                                OccurredAtUtc: normalized.OccurredAtUtc,
                                RelatedCredentialId: match.CredentialId,
                                RelatedSubjectId: match.SubjectId),
                            ct);
                        resultCode = DeviceEventResultCode.DeniedAttempt;
                        failureCode = RefusedScanFailureCode.SubjectInactive;
                    }
                    break;
                }

            case DeviceEventType.CardDenied:
                refusedScanAttemptId = await _recordRefused.HandleAsync(
                    new RecordRefusedScanCommand(
                        TenantId: tenantId,
                        ScanAttemptId: scanAttemptId,
                        CredentialFingerprint: payload.OpaqueToken is null ? null : Sha256(payload.OpaqueToken),
                        Direction: CycleDirection.Entrance,
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
                // Heartbeat + unknown event types are rejected by the validator.
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
                    processedAtUtc: existing2.ProcessedAtUtc);
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
            processedAtUtc: deviceEvent.ProcessedAtUtc);
    }

    private static byte[] Sha256(string input)
    {
        var bytes = Encoding.UTF8.GetBytes(input);
        return SHA256.HashData(bytes);
    }

    private static DeviceEventIngestionDto BuildDto(
        string resultCode,
        Guid? existingEventId = null,
        Guid? visitId = null,
        Guid? accessEventId = null,
        Guid? refusedScanAttemptId = null,
        DateTime occurredAtUtc = default,
        DateTime processedAtUtc = default) =>
        new(
            Outcome: resultCode,
            ExistingEventId: existingEventId,
            VisitId: visitId,
            AccessEventId: accessEventId,
            RefusedScanAttemptId: refusedScanAttemptId,
            OccurredAtUtc: occurredAtUtc == default ? DateTime.UtcNow : occurredAtUtc,
            ProcessedAtUtc: processedAtUtc == default ? DateTime.UtcNow : processedAtUtc);
}
