using ControlEasyReborn.Modules.Devices.Domain.Entities;

namespace ControlEasyReborn.Modules.Devices.Application.Abstractions;

public interface IDeviceRepository
{
    Task<Device?> GetByIdAsync(Guid tenantId, Guid deviceId, CancellationToken ct);
    Task<IReadOnlyList<Device>> ListAsync(Guid tenantId, bool? isActive, CancellationToken ct);
    Task InsertAsync(Device device, CancellationToken ct);
    Task UpdateAsync(Device device, CancellationToken ct);
}