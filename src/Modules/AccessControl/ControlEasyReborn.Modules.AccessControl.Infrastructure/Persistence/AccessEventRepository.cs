using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.AccessControl.Application.Abstractions;
using ControlEasyReborn.Modules.AccessControl.Domain.Entities;
using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using DBTools.Abstractions;
using System.Data;

namespace ControlEasyReborn.Modules.AccessControl.Infrastructure.Persistence;

public sealed class AccessEventRepository : IAccessEventRepository
{
    private const string TableName = "AccessEvents";
    private const string Fields = "Id, TenantId, SubjectType, SubjectId, Direction, AccessMethod, CredentialId, LookupAuditId, ScanAttemptId, PerformedByProfileId, GatehouseId, OccurredAtUtc, CorrelationId, DuplicateOfAccessEventId, DuplicateConfirmed, PolicyOutcome, DestinationApartmentId, DestinationBlock, DestinationUnit, EventKind, PackageDescription, PackageCarrierCode";

    private readonly ITenantContext _ctx;
    private readonly ITenantAwareLinqFactory _factory;

    public AccessEventRepository(ITenantContext ctx, ITenantAwareLinqFactory factory)
    {
        _ctx = ctx;
        _factory = factory;
    }

    public async Task<AccessEvent?> FindByScanAttemptAsync(Guid tenantId, Guid scanAttemptId, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: "ScanAttemptId = @param0",
            parameters: new object[] { scanAttemptId },
            ct: ct);
        return MapFirstOrDefault(rows);
    }

    public async Task<AccessEvent?> FindByIdAsync(Guid tenantId, Guid accessEventId, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: "Id = @param0",
            parameters: new object[] { accessEventId },
            ct: ct);
        return MapFirstOrDefault(rows);
    }

    public async Task<IReadOnlyList<AccessEvent>> ListAsync(Guid tenantId, DateTime? fromUtc, DateTime? toUtc, CycleDirection? direction, SubjectType? subjectType, Guid? subjectId, AccessMethod? accessMethod, CredentialStatus? credentialStatus, Guid? gatehouseId, Guid? attendantProfileId, int skip, int take, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var whereParts = new List<string>();
        var parameters = new List<object>();
        if (fromUtc.HasValue)
        {
            whereParts.Add("OccurredAtUtc >= @param" + parameters.Count);
            parameters.Add(fromUtc.Value);
        }
        if (toUtc.HasValue)
        {
            whereParts.Add("OccurredAtUtc <= @param" + parameters.Count);
            parameters.Add(toUtc.Value);
        }
        if (direction.HasValue)
        {
            whereParts.Add("Direction = @param" + parameters.Count);
            parameters.Add((int)direction.Value);
        }
        if (subjectType.HasValue)
        {
            whereParts.Add("SubjectType = @param" + parameters.Count);
            parameters.Add((int)subjectType.Value);
        }
        if (subjectId.HasValue)
        {
            whereParts.Add("SubjectId = @param" + parameters.Count);
            parameters.Add(subjectId.Value);
        }
        if (accessMethod.HasValue)
        {
            whereParts.Add("AccessMethod = @param" + parameters.Count);
            parameters.Add((int)accessMethod.Value);
        }
        if (gatehouseId.HasValue)
        {
            whereParts.Add("GatehouseId = @param" + parameters.Count);
            parameters.Add(gatehouseId.Value);
        }
        if (attendantProfileId.HasValue)
        {
            whereParts.Add("PerformedByProfileId = @param" + parameters.Count);
            parameters.Add(attendantProfileId.Value);
        }
        var whereClause = whereParts.Count == 0 ? "1=1" : string.Join(" AND ", whereParts);

        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: whereClause,
            parameters: parameters.ToArray(),
            ct: ct);

        return MapList(rows).OrderByDescending(e => e.OccurredAtUtc).Skip(skip).Take(take).ToList();
    }

    public async Task AddAsync(AccessEvent accessEvent, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        await db.InsertAsync(
            new[] { "Id", "TenantId", "SubjectType", "SubjectId", "Direction", "AccessMethod", "CredentialId", "LookupAuditId", "ScanAttemptId", "PerformedByProfileId", "GatehouseId", "OccurredAtUtc", "CorrelationId", "DuplicateOfAccessEventId", "DuplicateConfirmed", "PolicyOutcome", "DestinationApartmentId", "DestinationBlock", "DestinationUnit", "EventKind", "PackageDescription", "PackageCarrierCode", "tenant_id" },
            TableName,
            new object?[] { accessEvent.Id, accessEvent.TenantId, (int)accessEvent.SubjectType, accessEvent.SubjectId, (int)accessEvent.Direction, (int)accessEvent.AccessMethod, (object?)accessEvent.CredentialId ?? DBNull.Value, (object?)accessEvent.LookupAuditId ?? DBNull.Value, accessEvent.ScanAttemptId, accessEvent.PerformedByProfileId, (object?)accessEvent.GatehouseId ?? DBNull.Value, accessEvent.OccurredAtUtc, accessEvent.CorrelationId, (object?)accessEvent.DuplicateOfAccessEventId ?? DBNull.Value, accessEvent.DuplicateConfirmed ? 1 : 0, (int)accessEvent.PolicyOutcome, accessEvent.DestinationApartmentId, accessEvent.DestinationBlock, accessEvent.DestinationUnit, (int)accessEvent.EventKind, (object?)accessEvent.PackageDescription ?? DBNull.Value, (object?)accessEvent.PackageCarrierCode ?? DBNull.Value, accessEvent.TenantId },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);
    }

    private static AccessEvent? MapFirstOrDefault(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return null;
        return MapRow(rows.Rows[0]);
    }

    private static IReadOnlyList<AccessEvent> MapList(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return Array.Empty<AccessEvent>();
        var list = new List<AccessEvent>(rows.Rows.Count);
        foreach (DataRow r in rows.Rows)
        {
            var mapped = MapRow(r);
            if (mapped is not null) list.Add(mapped);
        }
        return list;
    }

    private static AccessEvent? MapRow(DataRow r)
    {
        var credentialIdStr = r["CredentialId"]?.ToString();
        var lookupAuditIdStr = r["LookupAuditId"]?.ToString();
        var gatehouseIdStr = r["GatehouseId"]?.ToString();
        var duplicateOfStr = r["DuplicateOfAccessEventId"]?.ToString();
        var packageDescription = r.Table.Columns.Contains("PackageDescription") && r["PackageDescription"] != DBNull.Value
            ? r["PackageDescription"]?.ToString()
            : null;
        var packageCarrierCode = r.Table.Columns.Contains("PackageCarrierCode") && r["PackageCarrierCode"] != DBNull.Value
            ? r["PackageCarrierCode"]?.ToString()
            : null;
        var eventKind = r.Table.Columns.Contains("EventKind")
            ? (AccessEventKind)Convert.ToInt32(r["EventKind"])
            : AccessEventKind.Access;

        return AccessEvent.Hydrate(
            id: Guid.Parse(r["Id"].ToString() ?? string.Empty),
            tenantId: Guid.Parse(r["TenantId"].ToString() ?? string.Empty),
            subjectType: (SubjectType)Convert.ToInt32(r["SubjectType"]),
            subjectId: Guid.Parse(r["SubjectId"].ToString() ?? string.Empty),
            direction: (CycleDirection)Convert.ToInt32(r["Direction"]),
            accessMethod: (AccessMethod)Convert.ToInt32(r["AccessMethod"]),
            credentialId: string.IsNullOrEmpty(credentialIdStr) ? null : Guid.Parse(credentialIdStr),
            lookupAuditId: string.IsNullOrEmpty(lookupAuditIdStr) ? null : Guid.Parse(lookupAuditIdStr),
            scanAttemptId: Guid.Parse(r["ScanAttemptId"].ToString() ?? string.Empty),
            performedByProfileId: Guid.Parse(r["PerformedByProfileId"].ToString() ?? string.Empty),
            gatehouseId: string.IsNullOrEmpty(gatehouseIdStr) ? null : Guid.Parse(gatehouseIdStr),
            occurredAtUtc: Convert.ToDateTime(r["OccurredAtUtc"]),
            correlationId: Guid.Parse(r["CorrelationId"].ToString() ?? string.Empty),
            duplicateOfAccessEventId: string.IsNullOrEmpty(duplicateOfStr) ? null : Guid.Parse(duplicateOfStr),
            duplicateConfirmed: Convert.ToInt32(r["DuplicateConfirmed"]) != 0,
            policyOutcome: (PolicyOutcome)Convert.ToInt32(r["PolicyOutcome"]),
            destinationApartmentId: Guid.Parse(r["DestinationApartmentId"].ToString() ?? string.Empty),
            destinationBlock: r["DestinationBlock"]?.ToString() ?? string.Empty,
            destinationUnit: r["DestinationUnit"]?.ToString() ?? string.Empty,
            eventKind: eventKind,
            packageDescription: packageDescription,
            packageCarrierCode: packageCarrierCode);
    }
}
