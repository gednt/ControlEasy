using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Domain.Enums;

namespace ControlEasyReborn.Modules.Devices.Application.Handlers;

// Read-side handler for GET /api/v1/devices/health (DOOR-13).
//
// Joins the Devices table with device_heartbeats. Devices without a
// heartbeat row are still listed (default Status=Offline — the dashboard
// surface treats a missing heartbeat as "we have not heard from this
// device at all yet").
//
// Soft-deleted devices are excluded.
public sealed class ListDeviceHealthHandler
{
    private readonly IDeviceRepository _devices;
    private readonly IDeviceHeartbeatRepository _heartbeats;
    private readonly IGatehouseLookup _gatehouses;

    public ListDeviceHealthHandler(
        IDeviceRepository devices,
        IDeviceHeartbeatRepository heartbeats,
        IGatehouseLookup gatehouses)
    {
        _devices = devices;
        _heartbeats = heartbeats;
        _gatehouses = gatehouses;
    }

    public async Task<IReadOnlyList<DeviceHealthDto>> HandleAsync(
        Guid tenantId,
        CancellationToken ct)
    {
        var nowUtc = DateTime.UtcNow;
        var devices = await _devices.ListAsync(tenantId, ct);
        var heartbeats = await _heartbeats.ListAsync(tenantId, ct);
        var heartbeatByDeviceId = heartbeats.ToDictionary(h => h.DeviceId);

        var gatehouseNames = new Dictionary<Guid, string?>();
        var items = new List<DeviceHealthDto>(devices.Count);
        foreach (var device in devices)
        {
            // Resolve gatehouse name lazily so we only fetch what we need.
            string? gatehouseName = null;
            if (device.GatehouseId.HasValue && !gatehouseNames.ContainsKey(device.GatehouseId.Value))
            {
                gatehouseNames[device.GatehouseId.Value] =
                    await _gatehouses.GetNameAsync(tenantId, device.GatehouseId.Value, ct);
            }
            if (device.GatehouseId.HasValue)
            {
                gatehouseNames.TryGetValue(device.GatehouseId.Value, out gatehouseName);
            }

            if (heartbeatByDeviceId.TryGetValue(device.Id, out var heartbeat))
            {
                var pct = (decimal)heartbeat.ErrorCount / Math.Max(heartbeat.EventsSinceLastSuccess, 1) * 100m;
                var isOffline = heartbeat.IsOfflineExceeded(nowUtc);
                items.Add(new DeviceHealthDto(
                    DeviceId: device.Id,
                    Vendor: device.Vendor,
                    DeviceType: device.DeviceType,
                    GatehouseId: device.GatehouseId,
                    GatehouseName: gatehouseName,
                    Status: heartbeat.Status,
                    StatusLabel: StatusLabel(heartbeat.Status),
                    LastHeartbeatAtUtc: heartbeat.LastHeartbeatAtUtc,
                    ErrorCount: heartbeat.ErrorCount,
                    EventsSinceLastSuccess: heartbeat.EventsSinceLastSuccess,
                    ErrorRatePercent: Math.Round(pct, 2),
                    OfflineAfterSeconds: heartbeat.OfflineAfterSeconds,
                    ErrorRateThresholdPercent: heartbeat.ErrorRateThresholdPercent,
                    IsOfflineExceeded: isOffline));
            }
            else
            {
                // No heartbeat row — treat as offline (we have never heard from this device).
                items.Add(new DeviceHealthDto(
                    DeviceId: device.Id,
                    Vendor: device.Vendor,
                    DeviceType: device.DeviceType,
                    GatehouseId: device.GatehouseId,
                    GatehouseName: gatehouseName,
                    Status: DeviceStatus.Offline,
                    StatusLabel: StatusLabel(DeviceStatus.Offline),
                    LastHeartbeatAtUtc: null,
                    ErrorCount: 0,
                    EventsSinceLastSuccess: 0,
                    ErrorRatePercent: 0m,
                    OfflineAfterSeconds: IngestHeartbeatHandler.DefaultOfflineAfterSeconds,
                    ErrorRateThresholdPercent: IngestHeartbeatHandler.DefaultErrorRateThresholdPercent,
                    IsOfflineExceeded: true));
            }
        }

        return items;
    }

    private static string StatusLabel(DeviceStatus status) => status switch
    {
        DeviceStatus.Online => "Online",
        DeviceStatus.Offline => "Offline",
        DeviceStatus.Degraded => "Degraded",
        _ => "Unknown"
    };
}