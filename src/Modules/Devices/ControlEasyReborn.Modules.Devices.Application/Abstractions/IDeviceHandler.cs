using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Domain.Enums;

namespace ControlEasyReborn.Modules.Devices.Application.Abstractions;

// Vendor-agnostic normalization entry point for reader events. Every
// implementation (in-process simulator today, real vendor driver in v2.5)
// implements Normalize(...) to convert its wire format into a unified
// DeviceEventPayload. The IngestDeviceEventHandler is the SOLE ledger
// dispatcher; business logic never touches a vendor wire format directly
// (DOOR-08).
public interface IDeviceHandler
{
    DeviceEventPayload Normalize(
        Guid tenantId,
        Guid deviceId,
        string opaqueToken,
        DeviceEventType eventType,
        DateTime occurredAtUtc,
        long sequenceNumber,
        Guid? externalEventId,
        string? payloadJson);
}
