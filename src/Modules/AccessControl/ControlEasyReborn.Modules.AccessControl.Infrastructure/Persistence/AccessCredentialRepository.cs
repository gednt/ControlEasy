using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.AccessControl.Application.Abstractions;
using ControlEasyReborn.Modules.AccessControl.Domain.Entities;
using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using DBTools.Abstractions;
using System.Data;

namespace ControlEasyReborn.Modules.AccessControl.Infrastructure.Persistence;

public sealed class AccessCredentialRepository : IAccessCredentialRepository
{
    private const string TableName = "AccessCredentials";
    private const string Fields = "Id, TenantId, SubjectType, SubjectId, Method, SecretVerifier, KeyVersion, Status, ValidFromUtc, ExpiresAtUtc, ReplacedByCredentialId, IssuedByProfileId, CreatedAtUtc, UpdatedAtUtc";

    private readonly ITenantContext _ctx;
    private readonly ITenantAwareLinqFactory _factory;
    private readonly ICredentialLifecycleActionRepository _lifecycle;

    public AccessCredentialRepository(ITenantContext ctx, ITenantAwareLinqFactory factory, ICredentialLifecycleActionRepository lifecycle)
    {
        _ctx = ctx;
        _factory = factory;
        _lifecycle = lifecycle;
    }

    public async Task<AccessCredential?> FindActiveAsync(Guid tenantId, SubjectType subjectType, Guid subjectId, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: "SubjectType = @param0 AND SubjectId = @param1 AND Status = @param2",
            parameters: new object[] { (int)subjectType, subjectId, (int)CredentialStatus.Active },
            ct: ct);
        return MapFirstOrDefault(rows);
    }

    public async Task<AccessCredential?> FindByIdAsync(Guid tenantId, Guid credentialId, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: "Id = @param0",
            parameters: new object[] { credentialId },
            ct: ct);
        if (!string.IsNullOrEmpty(db.Error))
        {
            throw new InvalidOperationException($"SelectAsync failed in FindByIdAsync: {db.Error}");
        }
        return MapFirstOrDefault(rows);
    }

    public async Task<AccessCredential?> FindByHashAsync(Guid tenantId, byte[] sha256Hash, CancellationToken ct)
    {
        if (sha256Hash is null || sha256Hash.Length == 0) return null;
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: "SecretVerifier = @param0 AND tenant_id = @param1 AND Status = @param2",
            parameters: new object[] { sha256Hash, tenantId, (int)CredentialStatus.Active },
            ct: ct);
        return MapFirstOrDefault(rows);
    }

    public async Task<IReadOnlyList<AccessCredential>> ListAllAsync(Guid tenantId, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: "1=1",
            parameters: Array.Empty<object>(),
            ct: ct);
        return MapList(rows);
    }

    public async Task<IReadOnlyList<AccessCredential>> ListAsync(Guid tenantId, int skip, int take, CancellationToken ct, Guid? subjectId = null, SubjectType? subjectType = null, CredentialStatus? status = null)
    {
        var db = _factory.Create(_ctx);
        var whereParts = new List<string>();
        var parameters = new List<object>();
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
        if (status.HasValue)
        {
            whereParts.Add("Status = @param" + parameters.Count);
            parameters.Add((int)status.Value);
        }
        var whereClause = whereParts.Count == 0 ? "1=1" : string.Join(" AND ", whereParts);

        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: whereClause,
            parameters: parameters.ToArray(),
            ct: ct);

        return MapList(rows).OrderByDescending(c => c.CreatedAtUtc).Skip(skip).Take(take).ToList();
    }

    public async Task AddAsync(AccessCredential credential, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        await db.InsertAsync(
            new[] { "Id", "TenantId", "SubjectType", "SubjectId", "Method", "SecretVerifier", "KeyVersion", "Status", "ValidFromUtc", "ExpiresAtUtc", "ReplacedByCredentialId", "IssuedByProfileId", "CreatedAtUtc", "UpdatedAtUtc", "tenant_id" },
            TableName,
            new object?[] { credential.Id, credential.TenantId, (int)credential.SubjectType, credential.SubjectId, (int)credential.Method, credential.SecretVerifier, credential.KeyVersion, (int)credential.Status, credential.ValidFromUtc, (object?)credential.ExpiresAtUtc ?? DBNull.Value, (object?)credential.ReplacedByCredentialId ?? DBNull.Value, credential.IssuedByProfileId, credential.CreatedAtUtc, (object?)credential.UpdatedAtUtc ?? DBNull.Value, credential.TenantId },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);
    }

    public async Task ReplaceAsync(AccessCredential predecessor, AccessCredential successor, CredentialLifecycleAction action, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var updated = await db.UpdateAsync(
            new[] { "Status", "ReplacedByCredentialId", "UpdatedAtUtc" },
            TableName,
            new[]
            {
                ((int)predecessor.Status).ToString(),
                predecessor.ReplacedByCredentialId?.ToString()!,
                FormatDateTime(predecessor.UpdatedAtUtc)!
            },
            $"Id = '{predecessor.Id}'",
            Array.Empty<object>(),
            ct: ct);

        if (!updated || !string.IsNullOrEmpty(db.Error))
        {
            throw new InvalidOperationException($"UpdateAsync failed in ReplaceAsync: {db.Error}");
        }

        var inserted = await db.InsertAsync(
            new[] { "Id", "TenantId", "SubjectType", "SubjectId", "Method", "SecretVerifier", "KeyVersion", "Status", "ValidFromUtc", "ExpiresAtUtc", "ReplacedByCredentialId", "IssuedByProfileId", "CreatedAtUtc", "UpdatedAtUtc", "tenant_id" },
            TableName,
            new object?[] { successor.Id, successor.TenantId, (int)successor.SubjectType, successor.SubjectId, (int)successor.Method, successor.SecretVerifier, successor.KeyVersion, (int)successor.Status, successor.ValidFromUtc, (object?)successor.ExpiresAtUtc ?? DBNull.Value, (object?)successor.ReplacedByCredentialId ?? DBNull.Value, successor.IssuedByProfileId, successor.CreatedAtUtc, (object?)successor.UpdatedAtUtc ?? DBNull.Value, successor.TenantId },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);

        if (!inserted || !string.IsNullOrEmpty(db.Error))
        {
            throw new InvalidOperationException($"InsertAsync failed in ReplaceAsync: {db.Error}");
        }

        await _lifecycle.AddAsync(action, ct);
    }

    public async Task UpdateStatusAsync(AccessCredential credential, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var updated = await db.UpdateAsync(
            new[] { "Status", "ReplacedByCredentialId", "UpdatedAtUtc" },
            TableName,
            new[]
            {
                ((int)credential.Status).ToString(),
                credential.ReplacedByCredentialId?.ToString()!,
                FormatDateTime(credential.UpdatedAtUtc)!
            },
            $"Id = '{credential.Id}'",
            Array.Empty<object>(),
            ct: ct);

        if (!updated || !string.IsNullOrEmpty(db.Error))
        {
            throw new InvalidOperationException($"UpdateAsync failed in UpdateStatusAsync: {db.Error}");
        }
    }

    private static string? FormatDateTime(DateTime? value) =>
        value.HasValue ? value.Value.ToString("yyyy-MM-dd HH:mm:ss.ffffff") : null;

    private static AccessCredential? MapFirstOrDefault(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return null;
        return MapRow(rows.Rows[0]);
    }

    private static IReadOnlyList<AccessCredential> MapList(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return Array.Empty<AccessCredential>();
        var list = new List<AccessCredential>(rows.Rows.Count);
        foreach (DataRow r in rows.Rows)
        {
            var mapped = MapRow(r);
            if (mapped is not null) list.Add(mapped);
        }
        return list;
    }

    private static AccessCredential? MapRow(DataRow r)
    {
        var expiresStr = r["ExpiresAtUtc"]?.ToString();
        var replacedByStr = r["ReplacedByCredentialId"]?.ToString();
        var updatedAtStr = r["UpdatedAtUtc"]?.ToString();
        var verifierBytes = r["SecretVerifier"] as byte[];

        return AccessCredential.Hydrate(
            id: Guid.Parse(r["Id"].ToString() ?? string.Empty),
            tenantId: Guid.Parse(r["TenantId"].ToString() ?? string.Empty),
            subjectType: (SubjectType)Convert.ToInt32(r["SubjectType"]),
            subjectId: Guid.Parse(r["SubjectId"].ToString() ?? string.Empty),
            method: (CredentialMethod)Convert.ToInt32(r["Method"]),
            secretVerifier: verifierBytes ?? Array.Empty<byte>(),
            keyVersion: Convert.ToInt32(r["KeyVersion"]),
            status: (CredentialStatus)Convert.ToInt32(r["Status"]),
            validFromUtc: Convert.ToDateTime(r["ValidFromUtc"]),
            expiresAtUtc: string.IsNullOrWhiteSpace(expiresStr) ? null : DateTime.Parse(expiresStr, null, System.Globalization.DateTimeStyles.RoundtripKind),
            replacedByCredentialId: string.IsNullOrWhiteSpace(replacedByStr) ? null : Guid.Parse(replacedByStr),
            issuedByProfileId: Guid.Parse(r["IssuedByProfileId"].ToString() ?? string.Empty),
            createdAtUtc: Convert.ToDateTime(r["CreatedAtUtc"]),
            updatedAtUtc: string.IsNullOrWhiteSpace(updatedAtStr) ? null : DateTime.Parse(updatedAtStr, null, System.Globalization.DateTimeStyles.RoundtripKind));
    }
}
