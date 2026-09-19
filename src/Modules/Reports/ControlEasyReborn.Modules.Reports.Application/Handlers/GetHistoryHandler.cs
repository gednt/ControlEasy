using ControlEasyReborn.Modules.Reports.Application.Abstractions;
using ControlEasyReborn.Modules.Reports.Application.Contracts;
using ControlEasyReborn.Modules.Reports.Application.Time;

namespace ControlEasyReborn.Modules.Reports.Application.Handlers;

/// <summary>
/// Serves the unified honest ledger: one chronological stream of Visits +
/// AccessEvents + the legacy ConsentAuditLog cutoff segment, where each
/// real-world entry appears exactly once. from/to are normalized through
/// TenantDayBoundary so "today" filters use tenant-local day boundaries
/// (INFRA-02; per-tenant timezone config deferred to Phase 17).
/// </summary>
public sealed class GetHistoryHandler
{
    private readonly IReportReadRepository _repository;

    public GetHistoryHandler(IReportReadRepository repository)
    {
        _repository = repository;
    }

    public async Task<(IReadOnlyList<HistoryRowResponse> Rows, int TotalCount)> HandleAsync(
        Guid tenantId,
        DateOnly? from,
        DateOnly? to,
        int page,
        int pageSize,
        string? status,
        string? carrierCode,
        string? q,
        Guid? apartmentId,
        CancellationToken ct)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        DateTime? fromUtc = null;
        DateTime? toUtc = null;
        if (from.HasValue)
        {
            fromUtc = TenantDayBoundary.GetDayBoundsUtc(from.Value).StartUtc;
        }
        if (to.HasValue)
        {
            // Inclusive tenant-local end day → exclusive next-day local midnight.
            toUtc = TenantDayBoundary.GetDayBoundsUtc(to.Value.AddDays(1)).StartUtc;
        }

        var query = new HistoryQuery(
            TenantId: tenantId,
            Page: page,
            PageSize: pageSize,
            FromUtc: fromUtc,
            ToUtc: toUtc,
            Status: status,
            CarrierCode: carrierCode,
            Q: q,
            ApartmentId: apartmentId);

        return await _repository.GetHistoryAsync(query, ct);
    }
}