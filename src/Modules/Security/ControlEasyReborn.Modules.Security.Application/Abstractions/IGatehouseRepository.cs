using ControlEasyReborn.Modules.Security.Domain.Entities;

namespace ControlEasyReborn.Modules.Security.Application.Abstractions;

public interface IGatehouseRepository
{
    Task<Gatehouse?> FindAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<Gatehouse>> ListByTenantAsync(Guid tenantId, bool includeInactive, CancellationToken ct);
    Task AddAsync(Gatehouse gatehouse, CancellationToken ct);
    Task UpdateAsync(Gatehouse gatehouse, CancellationToken ct);
    Task SetActiveAsync(Gatehouse gatehouse, CancellationToken ct);
}
