using ControlEasyReborn.Modules.Reports.Application.Contracts;

namespace ControlEasyReborn.Modules.Reports.Application.Abstractions;

public interface IReportReadRepository
{
    Task<IReadOnlyList<VisitCountByDayResponse>> GetVisitCountsByDayAsync(
        DateOnly? from,
        DateOnly? to,
        CancellationToken ct);

    Task<IReadOnlyList<ResidentsPerApartmentResponse>> GetResidentsPerApartmentAsync(
        CancellationToken ct);

    Task<DashboardStatsResponse> GetDashboardStatsAsync(CancellationToken ct);

    Task<(IReadOnlyList<HistoryRowResponse> Rows, int TotalCount)> GetHistoryAsync(
        HistoryQuery query,
        CancellationToken ct);
}
