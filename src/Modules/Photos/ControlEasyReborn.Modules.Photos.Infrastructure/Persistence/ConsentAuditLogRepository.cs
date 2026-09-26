using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.Photos.Application.Abstractions;
using ControlEasyReborn.Modules.Photos.Domain.Entities;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using DBTools.Abstractions;
using System.Data;

namespace ControlEasyReborn.Modules.Photos.Infrastructure.Persistence;

public sealed class ConsentAuditLogRepository : IConsentAuditLogRepository
{
    private const string TableName = "ConsentAuditLog";

    private const string Fields = "Id, TenantId, EntryState, OverrideReason, PhotoId, SubjectType, SubjectName, SubjectDocument, PerformedByProfileId, RecordedAt";

    private readonly ITenantContext _ctx;
    private readonly ITenantAwareLinqFactory _factory;

    public ConsentAuditLogRepository(ITenantContext ctx, ITenantAwareLinqFactory factory)
    {
        _ctx = ctx;
        _factory = factory;
    }

    public async Task AddAsync(ConsentAuditLogEntry entry, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        await db.InsertAsync(
            new[] { "Id", "TenantId", "EntryState", "OverrideReason", "PhotoId", "SubjectType", "SubjectName", "SubjectDocument", "PerformedByProfileId", "RecordedAt", "tenant_id" },
            TableName,
            new object?[] { entry.Id, entry.TenantId, entry.EntryState, (object?)entry.OverrideReason ?? DBNull.Value, (object?)entry.PhotoId ?? DBNull.Value, entry.SubjectType, (object?)entry.SubjectName ?? DBNull.Value, (object?)entry.SubjectDocument ?? DBNull.Value, (object?)entry.PerformedByProfileId ?? DBNull.Value, entry.RecordedAt, entry.TenantId },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);

        // Access audit events are intentionally not copied to Visits. A visit
        // has a destination apartment and lifecycle of its own; copying access
        // events created incomplete dashboard visit records.
    }

    public async Task<IReadOnlyList<ConsentAuditLogEntry>> ListAsync(string? entryState, string? subjectType, DateTime? fromUtc, DateTime? toUtc, Guid? porteiro, int skip, int take, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var whereParts = new List<string>();
        var parameters = new List<object>();

        if (!string.IsNullOrWhiteSpace(entryState))
        {
            whereParts.Add($"EntryState = @param{parameters.Count}");
            parameters.Add(entryState);
        }

        if (!string.IsNullOrWhiteSpace(subjectType))
        {
            whereParts.Add($"SubjectType = @param{parameters.Count}");
            parameters.Add(subjectType);
        }

        if (fromUtc.HasValue)
        {
            whereParts.Add($"RecordedAt >= @param{parameters.Count}");
            parameters.Add(fromUtc.Value.ToString("yyyy-MM-dd HH:mm:ss.fff"));
        }

        if (toUtc.HasValue)
        {
            whereParts.Add($"RecordedAt <= @param{parameters.Count}");
            parameters.Add(toUtc.Value.ToString("yyyy-MM-dd HH:mm:ss.fff"));
        }

        if (porteiro.HasValue)
        {
            whereParts.Add($"PerformedByProfileId = @param{parameters.Count}");
            parameters.Add(porteiro.Value);
        }

        var whereClause = whereParts.Count == 0 ? "1=1" : string.Join(" AND ", whereParts);

        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: whereClause,
            parameters: parameters.ToArray(),
            ct: ct);

        var entries = MapList(rows)
            .OrderByDescending(e => e.RecordedAt)
            .ToList();

        if (skip > 0)
            entries = entries.Skip(skip).ToList();

        if (take > 0 && take < int.MaxValue)
            entries = entries.Take(take).ToList();

        return entries;
    }

    private static IReadOnlyList<ConsentAuditLogEntry> MapList(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return Array.Empty<ConsentAuditLogEntry>();
        var list = new List<ConsentAuditLogEntry>(rows.Rows.Count);
        foreach (DataRow r in rows.Rows)
        {
            var mapped = MapRow(r);
            if (mapped is not null) list.Add(mapped);
        }
        return list;
    }

    private static ConsentAuditLogEntry? MapRow(DataRow r)
    {
        var overrideReasonStr = r["OverrideReason"]?.ToString();
        var photoIdStr = r["PhotoId"]?.ToString();
        var subjectNameStr = r["SubjectName"]?.ToString();
        var subjectDocumentStr = r["SubjectDocument"]?.ToString();
        var profileIdStr = r["PerformedByProfileId"]?.ToString();

        return new ConsentAuditLogEntry(
            id: Guid.Parse(r["Id"].ToString() ?? string.Empty),
            tenantId: Guid.Parse(r["TenantId"].ToString() ?? string.Empty),
            entryState: r["EntryState"]?.ToString() ?? string.Empty,
            overrideReason: string.IsNullOrEmpty(overrideReasonStr) ? null : overrideReasonStr,
            photoId: string.IsNullOrEmpty(photoIdStr) ? null : Guid.Parse(photoIdStr),
            subjectType: r["SubjectType"]?.ToString() ?? string.Empty,
            subjectName: string.IsNullOrEmpty(subjectNameStr) ? null : subjectNameStr,
            subjectDocument: string.IsNullOrEmpty(subjectDocumentStr) ? null : subjectDocumentStr,
            performedByProfileId: string.IsNullOrEmpty(profileIdStr) ? null : Guid.Parse(profileIdStr),
            recordedAt: Convert.ToDateTime(r["RecordedAt"]));
    }
}

public sealed class TenantConsentPolicyRepository : ITenantConsentPolicyRepository
{
    private const string TableName = "TenantConsentPolicy";

    private const string Fields = "Id, TenantId, SubjectCategory, PhotoRequired, DwellTimeLimitMinutes, UpdatedByProfileId, CreatedAtUtc, UpdatedAtUtc";

    private readonly ITenantContext _ctx;
    private readonly ITenantAwareLinqFactory _factory;

    public TenantConsentPolicyRepository(ITenantContext ctx, ITenantAwareLinqFactory factory)
    {
        _ctx = ctx;
        _factory = factory;
    }

    public async Task<TenantConsentPolicy?> FindByCategoryAsync(Guid tenantId, string subjectCategory, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: "TenantId = @param0 AND SubjectCategory = @param1",
            parameters: new object[] { tenantId, subjectCategory },
            ct: ct);
        return MapFirstOrDefault(rows);
    }

    public async Task UpsertAsync(TenantConsentPolicy policy, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        await db.DeleteAsync(
            TableName,
            "TenantId = @param0 AND SubjectCategory = @param1",
            new object[] { policy.TenantId, policy.SubjectCategory },
            ct);
        await db.InsertAsync(
            new[] { "Id", "TenantId", "SubjectCategory", "PhotoRequired", "DwellTimeLimitMinutes", "UpdatedByProfileId", "CreatedAtUtc", "UpdatedAtUtc", "tenant_id" },
            TableName,
            new object?[] { policy.Id, policy.TenantId, policy.SubjectCategory, policy.PhotoRequired ? 1 : 0, (object?)policy.DwellTimeLimitMinutes ?? DBNull.Value, (object?)policy.UpdatedByProfileId ?? DBNull.Value, policy.CreatedAtUtc, (object?)policy.UpdatedAtUtc ?? DBNull.Value, policy.TenantId },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);
    }

    private static TenantConsentPolicy? MapFirstOrDefault(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return null;
        return MapRow(rows.Rows[0]);
    }

    private static TenantConsentPolicy? MapRow(DataRow r)
    {
        var dwellStr = r["DwellTimeLimitMinutes"]?.ToString();
        var profileIdStr = r["UpdatedByProfileId"]?.ToString();
        var updatedAtStr = r["UpdatedAtUtc"]?.ToString();

        return new TenantConsentPolicy(
            id: Guid.Parse(r["Id"].ToString() ?? string.Empty),
            tenantId: Guid.Parse(r["TenantId"].ToString() ?? string.Empty),
            subjectCategory: r["SubjectCategory"]?.ToString() ?? string.Empty,
            photoRequired: Convert.ToInt32(r["PhotoRequired"]) != 0,
            dwellTimeLimitMinutes: string.IsNullOrEmpty(dwellStr) ? null : Convert.ToInt32(dwellStr),
            updatedByProfileId: string.IsNullOrEmpty(profileIdStr) ? null : Guid.Parse(profileIdStr),
            createdAtUtc: Convert.ToDateTime(r["CreatedAtUtc"]),
            updatedAtUtc: string.IsNullOrEmpty(updatedAtStr) ? null : DateTime.Parse(updatedAtStr, null, System.Globalization.DateTimeStyles.RoundtripKind));
    }
}
