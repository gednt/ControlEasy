namespace ControlEasyReborn.Modules.Reports.Application.Contracts;

public sealed record VisitCountByDayResponse(DateOnly Date, int Count);

public sealed record ResidentsPerApartmentResponse(Guid? ApartmentId, int Count);

public sealed record DashboardStatsResponse(
    int TotalResidents,
    int ActiveResidents,
    int TotalVehicles,
    int ActiveVehicles,
    int TotalApartments,
    int OccupiedApartments,
    int OpenVisits,
    int TodayVisits,
    List<RecentVisitDto> RecentVisits);

public sealed record RecentVisitDto(
    Guid Id,
    string VisitorName,
    string? Purpose,
    string Status,
    string? ApartmentLabel,
    DateTime CreatedAtUtc);

/// <summary>
/// One row of the unified honest ledger (GET /api/v1/reports/history).
/// Kind is the discriminator: "visit" / "access-event" / "legacy-entry-log" /
/// "refused-scan". NativeState is the row's OWN state vocabulary (VisitStatus
/// for visits, PolicyOutcome/failure code for access events, consent EntryState
/// for legacy rows) — never coerced into another enum's values (D-03).
/// </summary>
public sealed record HistoryRowResponse(
    Guid Id,
    string Kind,
    string NativeState,
    string Source,
    string SubjectType,
    string SubjectName,
    string? SubjectDocument,
    string? Purpose,
    string? DestinationLabel,
    string? PackageDescription,
    string? PackageCarrierCode,
    Guid? ApartmentId,
    DateTime OccurredAt);

/// <summary>
/// Query parameters for the unified ledger (server-side filtered + paginated).
/// </summary>
public sealed record HistoryQuery(
    Guid TenantId,
    int Page,
    int PageSize,
    DateTime? FromUtc,
    DateTime? ToUtc,
    string? Status,
    string? CarrierCode,
    string? Q,
    Guid? ApartmentId);
