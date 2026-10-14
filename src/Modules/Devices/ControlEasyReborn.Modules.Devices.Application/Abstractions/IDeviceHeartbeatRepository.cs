using ControlEasyReborn.Modules.Devices.Domain.Entities;

namespace ControlEasyReborn.Modules.Devices.Application.Abstractions;

// Persistence surface for device_heartbeats. Update and Delete methods are
// intentionally absent (DOOR-12): the row is upserted by the heartbeat
// pipeline (one row per device, idempotent ON DUPLICATE KEY UPDATE). The
// surface exposes only GetAsync + UpsertAsync + ListAsync, plus the
// per-device Configure write path SetThresholdsAsync (threshold-columns-only;
// never touches the heartbeat-derived columns).
public interface IDeviceHeartbeatRepository
{
    Task<DeviceHeartbeat?> GetAsync(Guid tenantId, Guid deviceId, CancellationToken ct);
    Task UpsertAsync(DeviceHeartbeat heartbeat, CancellationToken ct);
    Task<IReadOnlyList<DeviceHeartbeat>> ListAsync(Guid tenantId, CancellationToken ct);

    // Configure-flow write: persists the threshold pair of an existing row, or
    // INSERTs a sentinel row (LastHeartbeatAtUtc = DeviceHeartbeat
    // .SentinelLastHeartbeatAtUtc, Status=Offline, counters 0) when the device
    // has never heartbeaten. Tenant-scoped; the first production write path
    // for the threshold columns.
    Task SetThresholdsAsync(
        Guid tenantId,
        Guid deviceId,
        int offlineAfterSeconds,
        decimal errorRateThresholdPercent,
        CancellationToken ct);
}