using ControlEasyReborn.Modules.Devices.Domain.Enums;

namespace ControlEasyReborn.Modules.Devices.Application.Contracts;

// Unified vendor-agnostic payload sent to the IngestDeviceEventHandler.
// The DeviceEvent entity stores the same fields (plus ResultCode +
// correlation IDs to the Visit/AccessEvent/RefusedScanAttempt rows).
public sealed record DeviceEventPayload(
    DeviceEventType EventType,
    DateTime OccurredAtUtc,
    long SequenceNumber,
    Guid? ExternalEventId,
    string? OpaqueToken,
    string? PayloadJson);
