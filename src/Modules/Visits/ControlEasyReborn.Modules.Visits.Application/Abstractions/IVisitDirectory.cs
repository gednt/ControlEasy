using ControlEasyReborn.Modules.Visits.Application.Handlers;
using ControlEasyReborn.Modules.Visits.Domain.Entities;

namespace ControlEasyReborn.Modules.Visits.Application.Abstractions;

public interface IVisitDirectory
{
    Task<Visit?> FindByIdAsync(Guid tenantId, Guid visitId, CancellationToken ct);
    Task<Visit?> FindLatestByDocumentAsync(Guid tenantId, string document, CancellationToken ct);
    Task<IReadOnlyList<Visit>> SearchPendingByDocumentAsync(Guid tenantId, string document, CancellationToken ct);
    Task<IReadOnlyList<Visit>> SearchPendingByNameAsync(Guid tenantId, string nameTerm, int skip, int take, CancellationToken ct);
    Task<bool> CheckInAsync(Guid tenantId, Guid visitId, Guid attendantProfileId, Guid? gatehouseId, CancellationToken ct);

    /// <summary>
    /// Registers a visitor arrival through the shared VisitorArrivalHandler —
    /// the single check-in path for QR scan, manual lookup, and walk-in arrivals.
    /// </summary>
    Task<Visit> RegisterArrivalAsync(VisitorArrivalCommand command, CancellationToken ct);
}
