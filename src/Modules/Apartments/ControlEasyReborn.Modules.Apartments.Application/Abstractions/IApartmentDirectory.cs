using ControlEasyReborn.Modules.Apartments.Domain.Entities;

namespace ControlEasyReborn.Modules.Apartments.Application.Abstractions;

public interface IApartmentDirectory
{
    Task<Apartment?> FindActiveAsync(Guid tenantId, Guid apartmentId, CancellationToken ct);
    Task<IReadOnlyList<Apartment>> SearchByBlockAsync(Guid tenantId, string block, int skip, int take, CancellationToken ct);
    Task<Apartment?> FindFirstActiveAsync(Guid tenantId, CancellationToken ct);
}
