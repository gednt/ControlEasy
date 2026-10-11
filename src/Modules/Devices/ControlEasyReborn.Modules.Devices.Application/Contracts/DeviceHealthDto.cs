using ControlEasyReborn.Modules.Devices.Domain.Enums;

namespace ControlEasyReborn.Modules.Devices.Application.Contracts;

// Wire-shape projection for one device in the GET /api/v1/devices/health
// dashboard payload. Mirrored in src/Web/ControlEasyReborn.Web/src/app/
// features/devices/door-unlock.types.ts (DeviceHealthDto).
public sealed record DeviceHealthDto(
    Guid DeviceId,
    string Vendor,
    string DeviceType,
    Guid? GatehouseId,
    string? GatehouseName,
    DeviceStatus Status,
    string StatusLabel,
    DateTime? LastHeartbeatAtUtc,
    int ErrorCount,
    int EventsSinceLastSuccess,
    decimal ErrorRatePercent,
    int OfflineAfterSeconds,
    decimal ErrorRateThresholdPercent,
    bool IsOfflineExceeded);