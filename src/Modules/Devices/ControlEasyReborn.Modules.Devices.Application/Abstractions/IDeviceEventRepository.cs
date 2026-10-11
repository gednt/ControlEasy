using ControlEasyReborn.Modules.Devices.Domain.Entities;

namespace ControlEasyReborn.Modules.Devices.Application.Abstractions;

// Append-only repository surface for device_events. Update and Delete
// methods are intentionally absent (DOOR-09): the table is the durable
// ledger marker for reader-event ingestion, written once by
// IngestDeviceEventHandler. The 4 methods below are the only public
// surface.
public interface IDeviceEventRepository
{
    Task InsertAsync(DeviceEvent deviceEvent, CancellationToken ct);
    Task<DeviceEvent?> GetByIdempotencyKeyAsync(Guid tenantId, Guid deviceId, long sequenceNumber, Guid? externalEventId, CancellationToken ct);
    Task<DeviceEvent?> GetByIdAsync(Guid tenantId, Guid id, CancellationToken ct);
    Task<IReadOnlyList<DeviceEvent>> ListAsync(Guid tenantId, Guid deviceId, DateTime? sinceUtc, int limit, CancellationToken ct);
}
