using ControlEasyReborn.Modules.Devices.Domain.Entities;

namespace ControlEasyReborn.Modules.Devices.Application.Abstractions;

public interface IDeviceRepository
{
    Task<Device?> GetByIdAsync(Guid tenantId, Guid deviceId, CancellationToken ct);

    // List returns the tenant-scoped device set, EXCLUDING soft-deleted rows.
    Task<IReadOnlyList<Device>> ListAsync(Guid tenantId, CancellationToken ct);

    // List including soft-deleted (admin tooling). Unused in Phase 24 surface
    // but available for future audit/forensic flows.
    Task<IReadOnlyList<Device>> ListIncludingRemovedAsync(Guid tenantId, CancellationToken ct);

    Task<bool> HasRecentUnlockAuditAsync(Guid tenantId, Guid deviceId, DateTime sinceUtc, CancellationToken ct);

    Task InsertAsync(Device device, CancellationToken ct);

    // rotateConnectionParams=true includes the ConnectionParams column in the
    // UPDATE (the caller rotated the ciphertext). When false, ConnectionParams
    // is preserved as-is — its raw byte representation is NOT re-encoded, so
    // we don't change the column when nothing changed.
    Task UpdateAsync(Device device, CancellationToken ct, bool rotateConnectionParams);
}