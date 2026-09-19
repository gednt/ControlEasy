using ControlEasyReborn.Modules.Visits.Domain.Entities;

namespace ControlEasyReborn.Modules.Visits.Application.Abstractions;

public interface IVisitDirectory
{
    Task<Visit?> FindByIdAsync(Guid tenantId, Guid visitId, CancellationToken ct);
    Task<IReadOnlyList<Visit>> SearchPendingByDocumentAsync(Guid tenantId, string document, CancellationToken ct);
    Task<IReadOnlyList<Visit>> SearchPendingByNameAsync(Guid tenantId, string nameTerm, int skip, int take, CancellationToken ct);
    Task<bool> CheckInAsync(Guid tenantId, Guid visitId, Guid attendantProfileId, Guid? gatehouseId, CancellationToken ct);
}
