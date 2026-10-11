using ControlEasyReborn.Modules.Devices.Domain.Entities;

namespace ControlEasyReborn.Modules.Devices.Application.Abstractions;

// Persistence surface for device_heartbeats. Update and Delete methods are
// intentionally absent (DOOR-12): the row is upserted by the heartbeat
// pipeline (one row per device, idempotent ON DUPLICATE KEY UPDATE). The
// surface exposes only GetAsync + UpsertAsync + ListAsync.
public interface IDeviceHeartbeatRepository
{
    Task<DeviceHeartbeat?> GetAsync(Guid tenantId, Guid deviceId, CancellationToken ct);
    Task UpsertAsync(DeviceHeartbeat heartbeat, CancellationToken ct);
    Task<IReadOnlyList<DeviceHeartbeat>> ListAsync(Guid tenantId, CancellationToken ct);
}