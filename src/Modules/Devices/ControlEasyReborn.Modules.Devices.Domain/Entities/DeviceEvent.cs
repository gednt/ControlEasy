using ControlEasyReborn.Modules.Devices.Domain.Enums;

namespace ControlEasyReborn.Modules.Devices.Domain.Entities;

// Append-only ledger row for one ingested reader-event. Once constructed
// the entity is immutable — Update and Delete methods are NOT exposed on
// the IDeviceEventRepository interface (DOOR-09 + plan §"device_events
// table"). All cross-module writes (Visit, AccessEvent, RefusedScanAttempt)
// happen in the IngestDeviceEventHandler before this row is appended; the
// DeviceEvent row's existence is the durability marker.
public sealed class DeviceEvent
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid DeviceId { get; private set; }
    public DeviceEventType EventType { get; private set; }
    public string PayloadJson { get; private set; } = "{}";
    public DateTime OccurredAtUtc { get; private set; }
    public DateTime ProcessedAtUtc { get; private set; }
    public long SequenceNumber { get; private set; }
    public Guid? ExternalEventId { get; private set; }
    public string ResultCode { get; private set; } = string.Empty;
    public string? FailureCode { get; private set; }
    public Guid? VisitId { get; private set; }
    public Guid? AccessEventId { get; private set; }
    public Guid? RefusedScanAttemptId { get; private set; }
    public Guid CorrelationId { get; private set; }

    private DeviceEvent() { }

    public DeviceEvent(
        Guid id,
        Guid tenantId,
        Guid deviceId,
        DeviceEventType eventType,
        string payloadJson,
        DateTime occurredAtUtc,
        DateTime processedAtUtc,
        long sequenceNumber,
        Guid? externalEventId,
        string resultCode,
        string? failureCode,
        Guid? visitId,
        Guid? accessEventId,
        Guid? refusedScanAttemptId,
        Guid correlationId)
    {
        if (id == Guid.Empty) throw new InvalidOperationException("DeviceEvent id is required.");
        if (tenantId == Guid.Empty) throw new InvalidOperationException("TenantId is required.");
        if (deviceId == Guid.Empty) throw new InvalidOperationException("DeviceId is required.");
        if (string.IsNullOrWhiteSpace(payloadJson)) throw new InvalidOperationException("PayloadJson is required.");
        if (sequenceNumber < 0) throw new InvalidOperationException("SequenceNumber must be >= 0.");
        if (string.IsNullOrWhiteSpace(resultCode)) throw new InvalidOperationException("ResultCode is required.");
        if (!DeviceEventResultCode.All.Contains(resultCode))
            throw new InvalidOperationException($"Unknown DeviceEventResultCode: {resultCode}.");

        Id = id;
        TenantId = tenantId;
        DeviceId = deviceId;
        EventType = eventType;
        PayloadJson = payloadJson;
        OccurredAtUtc = occurredAtUtc;
        ProcessedAtUtc = processedAtUtc;
        SequenceNumber = sequenceNumber;
        ExternalEventId = externalEventId;
        ResultCode = resultCode;
        FailureCode = failureCode;
        VisitId = visitId;
        AccessEventId = accessEventId;
        RefusedScanAttemptId = refusedScanAttemptId;
        CorrelationId = correlationId;
    }

    public static DeviceEvent Hydrate(
        Guid id,
        Guid tenantId,
        Guid deviceId,
        DeviceEventType eventType,
        string payloadJson,
        DateTime occurredAtUtc,
        DateTime processedAtUtc,
        long sequenceNumber,
        Guid? externalEventId,
        string resultCode,
        string? failureCode,
        Guid? visitId,
        Guid? accessEventId,
        Guid? refusedScanAttemptId,
        Guid correlationId)
    {
        return new DeviceEvent(
            id, tenantId, deviceId, eventType, payloadJson, occurredAtUtc, processedAtUtc,
            sequenceNumber, externalEventId, resultCode, failureCode, visitId, accessEventId,
            refusedScanAttemptId, correlationId);
    }
}
