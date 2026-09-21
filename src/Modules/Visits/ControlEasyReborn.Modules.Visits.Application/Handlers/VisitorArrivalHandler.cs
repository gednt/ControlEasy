using ControlEasyReborn.Modules.Visits.Application.Abstractions;
using ControlEasyReborn.Modules.Visits.Domain.Entities;

namespace ControlEasyReborn.Modules.Visits.Application.Handlers;

/// <summary>
/// Command describing one visitor arrival observed at the gate. Every visitor
/// arrival path (QR scan, manual lookup, walk-in registration) funnels through
/// <see cref="VisitorArrivalHandler"/> so dedupe and status transitions have a
/// single source of truth (Phase 16 CONTEXT.md decision D-01/D-02).
/// </summary>
public sealed record VisitorArrivalCommand(
    Guid TenantId,
    string VisitorName,
    string VisitorDocument,
    string? VisitorPhone,
    Guid DestinationApartmentId,
    string DestinationBlock,
    string DestinationUnit,
    string? Purpose,
    Guid? AttendantProfileId,
    Guid? GatehouseId,
    DateTime OccurredAtUtc);

/// <summary>
/// The arrival outcome distinguishes an operational Visit mutation from an
/// idempotent re-scan. Consumers retain the audit event for a no-op scan.
/// </summary>
public sealed record VisitorArrivalResult(Visit Visit, bool VisitMutated);

/// <summary>
/// Single source of truth for visitor dedupe and status transitions:
/// (1) latest Visit by normalized document is CheckedIn → no-op, return it (idempotent re-arrival);
/// (2) latest Visit is Pending → CheckIn on the existing row;
/// (3) no open Visit (CheckedOut/Cancelled/absent) → create a NEW Visit with status
///     CheckedIn directly (the person is physically present; the Visit constructor
///     accepts status so no state-machine change is required) with
///     CheckedInAtUtc = OccurredAtUtc, backfilling document/apartment fields from
///     the resolved profile so manual-lookup dedupe finds it later (per D-01).
/// </summary>
public sealed class VisitorArrivalHandler
{
    private readonly IVisitDirectory _directory;
    private readonly IVisitRepository _visits;

    public VisitorArrivalHandler(IVisitDirectory directory, IVisitRepository visits)
    {
        _directory = directory;
        _visits = visits;
    }

    public async Task<VisitorArrivalResult> HandleAsync(VisitorArrivalCommand command, CancellationToken ct)
    {
        var latest = await _directory.FindLatestByDocumentAsync(command.TenantId, command.VisitorDocument, ct);
        if (latest is not null && latest.Status == VisitStatus.CheckedIn)
        {
            return new VisitorArrivalResult(latest, VisitMutated: false);
        }

        if (latest is not null && latest.Status == VisitStatus.Pending)
        {
            latest.CheckIn(command.AttendantProfileId ?? Guid.Empty, command.GatehouseId);
            await _visits.UpdateAsync(latest, ct);
            return new VisitorArrivalResult(latest, VisitMutated: true);
        }

        var created = new Visit(
            id: Guid.NewGuid(),
            tenantId: command.TenantId,
            visitorName: command.VisitorName,
            visitorDocument: command.VisitorDocument,
            visitorPhone: command.VisitorPhone,
            apartmentId: command.DestinationApartmentId,
            destinationBlock: command.DestinationBlock,
            destinationUnit: command.DestinationUnit,
            purpose: command.Purpose,
            status: VisitStatus.CheckedIn,
            attendantProfileId: command.AttendantProfileId,
            gatehouseId: command.GatehouseId,
            checkedInAtUtc: command.OccurredAtUtc,
            checkedOutAtUtc: null,
            createdAtUtc: command.OccurredAtUtc);

        await _visits.AddAsync(created, ct);
        return new VisitorArrivalResult(created, VisitMutated: true);
    }
}
