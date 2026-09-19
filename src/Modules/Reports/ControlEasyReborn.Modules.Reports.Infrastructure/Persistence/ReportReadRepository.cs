using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.Reports.Application.Abstractions;
using ControlEasyReborn.Modules.Reports.Application.Contracts;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using System.Data;

namespace ControlEasyReborn.Modules.Reports.Infrastructure.Persistence;

public sealed class ReportReadRepository : IReportReadRepository
{
    private readonly ITenantContext _ctx;
    private readonly ITenantAwareLinqFactory _factory;

    public ReportReadRepository(ITenantContext ctx, ITenantAwareLinqFactory factory)
    {
        _ctx = ctx;
        _factory = factory;
    }

    public async Task<IReadOnlyList<VisitCountByDayResponse>> GetVisitCountsByDayAsync(
        DateOnly? from,
        DateOnly? to,
        CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var whereClause = BuildDateRangeClause(from, to, out var parameters);

        var rows = await db.SelectAsync(
            fields: "CreatedAtUtc",
            table: "Visits",
            whereClause: whereClause,
            parameters: parameters,
            ct: ct);

        return rows.AsEnumerable()
            .Select(MapVisitDate)
            .AsQueryable()
            .GroupBy(d => d)
            .Select(g => new VisitCountByDayResponse(g.Key, g.Count()))
            .OrderBy(x => x.Date)
            .ToList();
    }

    public async Task<IReadOnlyList<ResidentsPerApartmentResponse>> GetResidentsPerApartmentAsync(
        CancellationToken ct)
    {
        var db = _factory.Create(_ctx);

        var rows = await db.SelectAsync(
            fields: "ApartmentId",
            table: "Residents",
            whereClause: "Active = 1",
            parameters: Array.Empty<object>(),
            ct: ct);

        return rows.AsEnumerable()
            .Select(MapApartmentId)
            .AsQueryable()
            .GroupBy(a => a)
            .Select(g => new ResidentsPerApartmentResponse(g.Key, g.Count()))
            .OrderByDescending(x => x.Count)
            .ToList();
    }

    public async Task<DashboardStatsResponse> GetDashboardStatsAsync(CancellationToken ct)
    {
        var db = _factory.Create(_ctx);

        var residentRows = await db.SelectAsync(
            fields: "Active",
            table: "Residents",
            whereClause: "1=1",
            parameters: Array.Empty<object>(),
            ct: ct);

        var totalResidents = residentRows.AsEnumerable().Count();
        var activeResidents = residentRows.AsEnumerable().Count(r => Convert.ToBoolean(r["Active"]));

        var vehicleRows = await db.SelectAsync(
            fields: "Active",
            table: "Vehicles",
            whereClause: "1=1",
            parameters: Array.Empty<object>(),
            ct: ct);

        var totalVehicles = vehicleRows.AsEnumerable().Count();
        var activeVehicles = vehicleRows.AsEnumerable().Count(r => Convert.ToBoolean(r["Active"]));

        var apartmentRows = await db.SelectAsync(
            fields: "Id, Block, Unit",
            table: "Apartments",
            whereClause: "1=1",
            parameters: Array.Empty<object>(),
            ct: ct);

        var totalApartments = apartmentRows.AsEnumerable().Count();

        var tenantId = _ctx.TenantId ?? throw new InvalidOperationException("Tenant context is not resolved.");
        var occupiedApartmentRows = await db.SelectRawAsync(
            "SELECT DISTINCT a.Id FROM Apartments a INNER JOIN Residents r ON a.Id = r.ApartmentId WHERE a.tenant_id = @param0 AND r.tenant_id = @param1 AND r.Active = 1",
            new object[] { tenantId, tenantId },
            ct);

        var occupiedApartments = occupiedApartmentRows.AsEnumerable().Count();

        var openVisitRows = await db.SelectAsync(
            fields: "Id",
            table: "Visits",
            whereClause: "Status IN (0, 1)",
            parameters: Array.Empty<object>(),
            ct: ct);

        var openVisits = openVisitRows.AsEnumerable().Count();

        var today = DateTime.UtcNow.Date;
        var todayVisitRows = await db.SelectAsync(
            fields: "Id",
            table: "Visits",
            whereClause: "CreatedAtUtc >= @param0",
            parameters: new object[] { today },
            ct: ct);

        var todayVisits = todayVisitRows.AsEnumerable().Count();

        var recentVisitRows = await db.SelectAsync(
            fields: "Id, VisitorName, Purpose, Status, ApartmentId, CreatedAtUtc",
            table: "Visits",
            whereClause: "1=1",
            parameters: Array.Empty<object>(),
            ct: ct);

        var apartmentLookup = new Dictionary<string, (string? Block, string? Unit)>();
        foreach (DataRow ar in apartmentRows.AsEnumerable())
        {
            var aptId = ar["Id"]?.ToString();
            if (aptId is not null)
            {
                apartmentLookup[aptId] = (ar["Block"]?.ToString(), ar["Unit"]?.ToString());
            }
        }

        var mappedVisits = recentVisitRows.AsEnumerable()
            .Select(r => MapRecentVisitWithApartment(r, apartmentLookup))
            .ToList();

        var recentVisits = mappedVisits
            .OrderByDescending(r => r.CreatedAtUtc)
            .Take(10)
            .ToList();

        return new DashboardStatsResponse(
            totalResidents,
            activeResidents,
            totalVehicles,
            activeVehicles,
            totalApartments,
            occupiedApartments,
            openVisits,
            todayVisits,
            recentVisits);
    }

    private static string BuildDateRangeClause(DateOnly? from, DateOnly? to, out object[] parameters)
    {
        var clauses = new List<string>();
        var paramList = new List<object>();

        if (from.HasValue)
        {
            clauses.Add($"CreatedAtUtc >= @param{paramList.Count}");
            paramList.Add(from.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
        }

        if (to.HasValue)
        {
            clauses.Add($"CreatedAtUtc < @param{paramList.Count}");
            paramList.Add(to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc));
        }

        parameters = paramList.ToArray();
        return clauses.Count == 0 ? "1=1" : string.Join(" AND ", clauses);
    }

    private static DateOnly MapVisitDate(DataRow row)
    {
        var value = Convert.ToDateTime(row["CreatedAtUtc"]);
        return DateOnly.FromDateTime(value.ToUniversalTime());
    }

    private static Guid? MapApartmentId(DataRow row)
    {
        var raw = row["ApartmentId"]?.ToString();
        return string.IsNullOrWhiteSpace(raw) ? null : Guid.Parse(raw);
    }

    private static RecentVisitDto MapRecentVisitWithApartment(DataRow r, Dictionary<string, (string? Block, string? Unit)> apartmentLookup)
    {
        var apartmentIdStr = r["ApartmentId"]?.ToString();
        var statusInt = Convert.ToInt32(r["Status"]);
        var status = statusInt switch
        {
            0 => "Pending",
            1 => "CheckedIn",
            2 => "CheckedOut",
            3 => "Cancelled",
            _ => "Unknown"
        };
        string? apartmentLabel = null;
        if (!string.IsNullOrEmpty(apartmentIdStr) && apartmentLookup.TryGetValue(apartmentIdStr, out var apt))
        {
            if (!string.IsNullOrEmpty(apt.Block) && !string.IsNullOrEmpty(apt.Unit))
            {
                apartmentLabel = $"{apt.Block}-{apt.Unit}";
            }
        }

        return new RecentVisitDto(
            Id: Guid.Parse(r["Id"].ToString() ?? string.Empty),
            VisitorName: r["VisitorName"]?.ToString() ?? string.Empty,
            Purpose: string.IsNullOrEmpty(r["Purpose"]?.ToString()) ? null : r["Purpose"].ToString(),
            Status: status,
            ApartmentLabel: apartmentLabel,
            CreatedAtUtc: Convert.ToDateTime(r["CreatedAtUtc"]));
    }

    /// <summary>
    /// Ledger cutoff for the legacy ConsentAuditLog segment (D-02): rows recorded
    /// at/after this instant are NOT shown in the legacy branch — walk-in
    /// operational records live in Visits from Phase 16 onward. Build constant,
    /// no config.
    /// </summary>
    public static readonly DateTime LedgerCutoffUtc = new(2026, 9, 19, 0, 0, 0, DateTimeKind.Utc);

    public async Task<(IReadOnlyList<Application.Contracts.HistoryRowResponse> Rows, int TotalCount)> GetHistoryAsync(
        Application.Contracts.HistoryQuery query,
        CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var tenantId = query.TenantId;

        // Per D-03: each UNION branch predicates tenant_id explicitly — the
        // TenantFilterInterceptor never splices into a UNION. All values are
        // parameterized (@paramN); identifiers are compile-time constants.
        var pageOffset = (query.Page - 1) * query.PageSize;

        var visitRange = BuildRangeClause("v.CreatedAtUtc", query.FromUtc, query.ToUtc, 1);
        var eventRange = BuildRangeClause("ae.OccurredAtUtc", query.FromUtc, query.ToUtc, visitRange.ParamCount);
        var refusalRange = BuildRangeClause("rs.OccurredAtUtc", query.FromUtc, query.ToUtc, eventRange.ParamCount);
        var legacyRange = BuildRangeClause("ca.RecordedAt", query.FromUtc, query.ToUtc, refusalRange.ParamCount);
        var filterSql = BuildFilterWhere(query, "ledger", legacyRange.ParamCount, out var filterValues);

        var cutoff = LedgerCutoffUtc.ToString("yyyy-MM-dd HH:mm:ss.ffffff");

        var sql = $@"
WITH ledger AS (
    SELECT
        v.Id,
        'visit' COLLATE utf8mb4_unicode_ci AS Kind,
        (CASE v.Status WHEN 0 THEN 'Pending' WHEN 1 THEN 'CheckedIn' WHEN 2 THEN 'CheckedOut' WHEN 3 THEN 'Cancelled' ELSE 'Unknown' END) COLLATE utf8mb4_unicode_ci AS NativeState,
        (CASE WHEN v.CheckedInAtUtc IS NOT NULL AND v.CreatedAtUtc < v.CheckedInAtUtc THEN 'pre-registration' ELSE 'walk-in' END) COLLATE utf8mb4_unicode_ci AS Source,
        'visitor' COLLATE utf8mb4_unicode_ci AS SubjectType,
        v.VisitorName AS SubjectName,
        v.VisitorDocument AS SubjectDocument,
        v.Purpose,
        CONCAT(v.DestinationBlock, '-', v.DestinationUnit) COLLATE utf8mb4_unicode_ci AS DestinationLabel,
        CAST(NULL AS CHAR(500)) COLLATE utf8mb4_unicode_ci AS PackageDescription,
        CAST(NULL AS CHAR(64)) COLLATE utf8mb4_unicode_ci AS PackageCarrierCode,
        v.ApartmentId AS ApartmentId,
        v.CreatedAtUtc AS OccurredAt
    FROM Visits v
    WHERE v.tenant_id = @param0 {visitRange.Sql}

    UNION ALL

    SELECT
        ae.Id,
        'access-event' COLLATE utf8mb4_unicode_ci AS Kind,
        (CASE ae.PolicyOutcome WHEN 0 THEN 'permit' WHEN 1 THEN 'requires_action' WHEN 2 THEN 'refused' ELSE 'unknown' END) COLLATE utf8mb4_unicode_ci AS NativeState,
        (CASE WHEN ae.EventKind = 1 THEN 'package-drop' ELSE
            CASE ae.AccessMethod WHEN 0 THEN 'qr-scan' ELSE 'manual-lookup' END
        END) COLLATE utf8mb4_unicode_ci AS Source,
        'visitor' COLLATE utf8mb4_unicode_ci AS SubjectType,
        COALESCE(NULLIF(ae.PackageDescription, ''), 'Visitor') COLLATE utf8mb4_unicode_ci AS SubjectName,
        CAST(NULL AS CHAR(20)) COLLATE utf8mb4_unicode_ci AS SubjectDocument,
        CAST(NULL AS CHAR(500)) COLLATE utf8mb4_unicode_ci AS Purpose,
        CONCAT(ae.DestinationBlock, '-', ae.DestinationUnit) COLLATE utf8mb4_unicode_ci AS DestinationLabel,
        ae.PackageDescription,
        ae.PackageCarrierCode,
        NULLIF(ae.DestinationApartmentId, '00000000-0000-0000-0000-000000000000') AS ApartmentId,
        ae.OccurredAtUtc AS OccurredAt
    FROM AccessEvents ae
    WHERE ae.tenant_id = @param0 {eventRange.Sql}
      AND (
          ae.EventKind = 1
          OR (
              ae.EventKind = 0
              AND ae.SubjectType = 2
              AND ae.VisitId IS NULL
          )
      )

    UNION ALL

    SELECT
        rs.Id,
        'refused-scan' COLLATE utf8mb4_unicode_ci AS Kind,
        rs.FailureCode AS NativeState,
        'security-event' COLLATE utf8mb4_unicode_ci AS Source,
        'visitor' COLLATE utf8mb4_unicode_ci AS SubjectType,
        'Refused scan' COLLATE utf8mb4_unicode_ci AS SubjectName,
        CAST(NULL AS CHAR(20)) COLLATE utf8mb4_unicode_ci AS SubjectDocument,
        CAST(NULL AS CHAR(500)) COLLATE utf8mb4_unicode_ci AS Purpose,
        CAST(NULL AS CHAR(128)) COLLATE utf8mb4_unicode_ci AS DestinationLabel,
        CAST(NULL AS CHAR(500)) COLLATE utf8mb4_unicode_ci AS PackageDescription,
        CAST(NULL AS CHAR(64)) COLLATE utf8mb4_unicode_ci AS PackageCarrierCode,
        NULL AS ApartmentId,
        rs.OccurredAtUtc AS OccurredAt
    FROM RefusedScanAttempts rs
    WHERE rs.tenant_id = @param0 {refusalRange.Sql}

    UNION ALL

    SELECT
        ca.Id,
        'legacy-entry-log' COLLATE utf8mb4_unicode_ci AS Kind,
        ca.EntryState AS NativeState,
        'consent-audit' COLLATE utf8mb4_unicode_ci AS Source,
        ca.SubjectType AS SubjectType,
        COALESCE(ca.SubjectName, 'Visitor') COLLATE utf8mb4_unicode_ci AS SubjectName,
        ca.SubjectDocument AS SubjectDocument,
        (CASE ca.EntryState
            WHEN 'gatehouse_only' THEN 'Package drop / delivery'
            WHEN 'entered_without_consent' THEN 'Consent refused - entry denied'
            WHEN 'entered_override' THEN CONCAT('Override (', COALESCE(ca.OverrideReason, ''), ')')
            ELSE CAST(NULL AS CHAR(500)) END) COLLATE utf8mb4_unicode_ci AS Purpose,
        (CASE WHEN ca.EntryState = 'gatehouse_only' THEN 'Gatehouse' ELSE CAST(NULL AS CHAR(128)) END) COLLATE utf8mb4_unicode_ci AS DestinationLabel,
        CAST(NULL AS CHAR(500)) COLLATE utf8mb4_unicode_ci AS PackageDescription,
        CAST(NULL AS CHAR(64)) COLLATE utf8mb4_unicode_ci AS PackageCarrierCode,
        CAST(NULL AS CHAR(36)) COLLATE utf8mb4_unicode_ci AS ApartmentId,
        ca.RecordedAt AS OccurredAt
    FROM ConsentAuditLog ca
    WHERE ca.tenant_id = @param0 {legacyRange.Sql}
      AND ca.RecordedAt < CAST('{cutoff}' AS DATETIME(6))
),
filtered AS (
    SELECT * FROM ledger
    {filterSql}
),
paged AS (
    SELECT filtered.*, COUNT(*) OVER() AS TotalCount
    FROM filtered
    ORDER BY OccurredAt DESC, Id DESC
    LIMIT {query.PageSize} OFFSET {pageOffset}
)
SELECT paged.*, 0 AS IsMetadata FROM paged
UNION ALL
SELECT
    '00000000-0000-0000-0000-000000000000' AS Id,
    CAST(NULL AS CHAR(32)) AS Kind,
    CAST(NULL AS CHAR(64)) AS NativeState,
    CAST(NULL AS CHAR(64)) AS Source,
    CAST(NULL AS CHAR(32)) AS SubjectType,
    CAST(NULL AS CHAR(200)) AS SubjectName,
    CAST(NULL AS CHAR(20)) AS SubjectDocument,
    CAST(NULL AS CHAR(500)) AS Purpose,
    CAST(NULL AS CHAR(128)) AS DestinationLabel,
    CAST(NULL AS CHAR(500)) AS PackageDescription,
    CAST(NULL AS CHAR(64)) AS PackageCarrierCode,
    CAST(NULL AS CHAR(36)) AS ApartmentId,
    CAST(NULL AS DATETIME(6)) AS OccurredAt,
    COUNT(*) AS TotalCount,
    1 AS IsMetadata
FROM filtered";

        var parameters = new List<object> { tenantId };
        parameters.AddRange(visitRange.ParamValues);
        parameters.AddRange(eventRange.ParamValues);
        parameters.AddRange(refusalRange.ParamValues);
        parameters.AddRange(legacyRange.ParamValues);
        parameters.AddRange(filterValues);

        var rows = await db.SelectRawAsync(sql, parameters.ToArray(), ct);
        var mapped = rows.AsEnumerable()
            .Where(r => Convert.ToInt32(r["IsMetadata"]) == 0)
            .Select(MapHistoryRow)
            .ToList();
        var totalRow = rows.AsEnumerable().Single(r => Convert.ToInt32(r["IsMetadata"]) == 1);
        var total = Convert.ToInt32(totalRow["TotalCount"], System.Globalization.CultureInfo.InvariantCulture);
        return (mapped, total);
    }

    private async Task<int> CountHistoryAsync(Application.Contracts.HistoryQuery query, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var tenantId = query.TenantId;

        var visitRange = BuildRangeClause("v.CreatedAtUtc", query.FromUtc, query.ToUtc, 1);
        var eventRange = BuildRangeClause("ae.OccurredAtUtc", query.FromUtc, query.ToUtc, visitRange.ParamCount);
        var refusalRange = BuildRangeClause("rs.OccurredAtUtc", query.FromUtc, query.ToUtc, eventRange.ParamCount);
        var legacyRange = BuildRangeClause("ca.RecordedAt", query.FromUtc, query.ToUtc, refusalRange.ParamCount);

        var cutoff = LedgerCutoffUtc.ToString("yyyy-MM-dd HH:mm:ss.ffffff");

        var sql = $@"
SELECT COUNT(*) FROM (
    SELECT
        CAST(NULL AS CHAR(500)) AS PackageDescription,
        v.VisitorName AS SubjectName,
        v.Purpose AS Purpose,
        CAST(NULL AS CHAR(64)) AS PackageCarrierCode,
        v.ApartmentId AS ApartmentId,
        CASE v.Status WHEN 0 THEN 'Pending' WHEN 1 THEN 'CheckedIn' WHEN 2 THEN 'CheckedOut' WHEN 3 THEN 'Cancelled' ELSE 'Unknown' END AS NativeState
    FROM Visits v WHERE v.tenant_id = @param0 {visitRange.Sql}
    UNION ALL
    SELECT
        ae.PackageDescription,
        COALESCE(NULLIF(ae.PackageDescription, ''), 'Visitor') AS SubjectName,
        CAST(NULL AS CHAR(500)) AS Purpose,
        ae.PackageCarrierCode,
        NULLIF(ae.DestinationApartmentId, '00000000-0000-0000-0000-000000000000') AS ApartmentId,
        CASE ae.PolicyOutcome WHEN 0 THEN 'permit' WHEN 1 THEN 'requires_action' WHEN 2 THEN 'refused' ELSE 'unknown' END AS NativeState
    FROM AccessEvents ae
    WHERE ae.tenant_id = @param0 {eventRange.Sql}
      AND (
          ae.EventKind = 1
          OR (
              ae.EventKind = 0
              AND ae.SubjectType = 2
              AND ae.VisitId IS NULL
          )
      )
    UNION ALL
    SELECT
        CAST(NULL AS CHAR(500)) AS PackageDescription,
        'Refused scan' AS SubjectName,
        CAST(NULL AS CHAR(500)) AS Purpose,
        CAST(NULL AS CHAR(64)) AS PackageCarrierCode,
        CAST(NULL AS CHAR(36)) AS ApartmentId,
        rs.FailureCode AS NativeState
    FROM RefusedScanAttempts rs WHERE rs.tenant_id = @param0 {refusalRange.Sql}
    UNION ALL
    SELECT
        CAST(NULL AS CHAR(500)) AS PackageDescription,
        COALESCE(ca.SubjectName, 'Visitor') AS SubjectName,
        CASE ca.EntryState
            WHEN 'gatehouse_only' THEN 'Package drop / delivery'
            WHEN 'entered_without_consent' THEN 'Consent refused - entry denied'
            WHEN 'entered_override' THEN CONCAT('Override (', COALESCE(ca.OverrideReason, ''), ')')
            ELSE CAST(NULL AS CHAR(500)) END AS Purpose,
        CAST(NULL AS CHAR(64)) AS PackageCarrierCode,
        CAST(NULL AS CHAR(36)) AS ApartmentId,
        ca.EntryState AS NativeState
    FROM ConsentAuditLog ca WHERE ca.tenant_id = @param0 {legacyRange.Sql} AND ca.RecordedAt < CAST('{cutoff}' AS DATETIME(6))
) ledger
{BuildFilterWhere(query, "ledger", legacyRange.ParamCount, out var filterValues)}";

        var parameters = new List<object> { tenantId };
        parameters.AddRange(visitRange.ParamValues);
        parameters.AddRange(eventRange.ParamValues);
        parameters.AddRange(refusalRange.ParamValues);
        parameters.AddRange(legacyRange.ParamValues);
        parameters.AddRange(filterValues);

        var total = await db.ExecuteScalarAsync(sql, parameters.ToArray(), ct);
        return Convert.ToInt32(total, System.Globalization.CultureInfo.InvariantCulture);
    }

    private static string BuildFilterWhere(Application.Contracts.HistoryQuery query, string alias, int baseParam, out List<object> values)
    {
        var parts = new List<string>();
        values = new List<object>();
        var p = baseParam;

        if (!string.IsNullOrWhiteSpace(query.CarrierCode))
        {
            parts.Add($"{alias}.PackageCarrierCode = @param{p}");
            values.Add(query.CarrierCode);
            p++;
        }
        if (!string.IsNullOrWhiteSpace(query.Q))
        {
            parts.Add($"({alias}.PackageDescription LIKE @param{p} OR {alias}.SubjectName LIKE @param{p} OR COALESCE({alias}.Purpose, '') LIKE @param{p})");
            values.Add("%" + query.Q + "%");
            p++;
        }
        if (query.ApartmentId.HasValue)
        {
            parts.Add($"{alias}.ApartmentId = @param{p}");
            values.Add(query.ApartmentId.Value);
            p++;
        }
        if (!string.IsNullOrWhiteSpace(query.Status))
        {
            parts.Add($"{alias}.NativeState = @param{p}");
            values.Add(query.Status);
            p++;
        }

        return parts.Count > 0 ? "WHERE " + string.Join(" AND ", parts) : string.Empty;
    }

    private static (string Sql, int ParamCount, IReadOnlyList<object> ParamValues) BuildRangeClause(
        string timestampColumn,
        DateTime? fromUtc,
        DateTime? toUtc,
        int baseParam)
    {
        var values = new List<object>();
        if (fromUtc.HasValue)
        {
            values.Add(fromUtc.Value);
        }
        if (toUtc.HasValue)
        {
            values.Add(toUtc.Value);
        }

        var clauses = new List<string>();
        var v = 0;
        if (fromUtc.HasValue)
        {
            clauses.Add($"{timestampColumn} >= @param{baseParam + v}");
            v++;
        }
        if (toUtc.HasValue)
        {
            clauses.Add($"{timestampColumn} < @param{baseParam + v}");
            v++;
        }

        var sql = clauses.Count > 0 ? " AND " + string.Join(" AND ", clauses) : string.Empty;
        return (sql, baseParam + values.Count, values);
    }

    private static Application.Contracts.HistoryRowResponse MapHistoryRow(DataRow r)
    {
        var idStr = r["Id"]?.ToString() ?? string.Empty;
        var apartmentIdStr = r["ApartmentId"]?.ToString();
        Guid? apartmentId = null;
        if (!string.IsNullOrEmpty(apartmentIdStr) && Guid.TryParse(apartmentIdStr, out var apt) && apt != Guid.Empty)
        {
            apartmentId = apt;
        }

        return new Application.Contracts.HistoryRowResponse(
            Id: Guid.Parse(idStr),
            Kind: r["Kind"]?.ToString() ?? string.Empty,
            NativeState: r["NativeState"]?.ToString() ?? string.Empty,
            Source: r["Source"]?.ToString() ?? string.Empty,
            SubjectType: r["SubjectType"]?.ToString() ?? string.Empty,
            SubjectName: r["SubjectName"]?.ToString() ?? string.Empty,
            SubjectDocument: r["SubjectDocument"] is DBNull ? null : r["SubjectDocument"]?.ToString(),
            Purpose: r["Purpose"] is DBNull ? null : r["Purpose"]?.ToString(),
            DestinationLabel: r["DestinationLabel"] is DBNull ? null : r["DestinationLabel"]?.ToString(),
            PackageDescription: r["PackageDescription"] is DBNull ? null : r["PackageDescription"]?.ToString(),
            PackageCarrierCode: r["PackageCarrierCode"] is DBNull ? null : r["PackageCarrierCode"]?.ToString(),
            ApartmentId: apartmentId,
            OccurredAt: Convert.ToDateTime(r["OccurredAt"], System.Globalization.CultureInfo.InvariantCulture));
    }
}
