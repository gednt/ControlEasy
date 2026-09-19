using ControlEasyReborn.Modules.Security.Application.Abstractions;
using ControlEasyReborn.Modules.Security.Domain.Entities;
using DBTools.Abstractions;
using System.Data;

namespace ControlEasyReborn.Modules.Security.Infrastructure.Persistence;

public sealed class PasswordResetRequestRepository : IPasswordResetRequestRepository
{
    private const string TableName = "PasswordResetRequests";
    private const string SelectFields = "Id, TenantId, UserId, NormalizedEmail, HashedTempPassword, DeliveryState, FailureReason, RequestedByUserId, CreatedAtUtc, DeliveredAtUtc, ExpiresAtUtc";

    private readonly IAsyncSqlClient _db;

    public PasswordResetRequestRepository(IAsyncSqlClient db)
    {
        _db = db;
    }

    public async Task AddAsync(PasswordResetRequest request, CancellationToken ct)
    {
        await _db.InsertAsync(
            new[]
            {
                "Id", "TenantId", "UserId", "NormalizedEmail", "HashedTempPassword",
                "DeliveryState", "FailureReason", "RequestedByUserId",
                "CreatedAtUtc", "DeliveredAtUtc", "ExpiresAtUtc", "tenant_id"
            },
            TableName,
            new object?[]
            {
                request.Id,
                request.TenantId,
                request.UserId,
                request.NormalizedEmail,
                request.HashedTempPassword,
                request.DeliveryState,
                (object?)request.FailureReason ?? DBNull.Value,
                (object?)request.RequestedByUserId ?? DBNull.Value,
                request.CreatedAtUtc,
                (object?)request.DeliveredAtUtc ?? DBNull.Value,
                request.ExpiresAtUtc,
                request.TenantId
            },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);
    }

    public async Task<PasswordResetRequest?> FindLatestByEmailAsync(string normalizedEmail, CancellationToken ct)
    {
        var rows = await _db.SelectAsync(
            fields: SelectFields,
            table: TableName,
            whereClause: "NormalizedEmail = @param0 ORDER BY CreatedAtUtc DESC LIMIT 1",
            parameters: new object[] { normalizedEmail },
            ct: ct);

        return MapFirstOrDefault(rows);
    }

    public async Task<PasswordResetRequest?> FindLatestByUserIdAsync(Guid userId, CancellationToken ct)
    {
        var rows = await _db.SelectAsync(
            fields: SelectFields,
            table: TableName,
            whereClause: "UserId = @param0 ORDER BY CreatedAtUtc DESC LIMIT 1",
            parameters: new object[] { userId },
            ct: ct);

        return MapFirstOrDefault(rows);
    }

    public async Task UpdateAsync(PasswordResetRequest request, CancellationToken ct)
    {
        await _db.UpdateAsync(
            new[] { "DeliveryState", "FailureReason", "DeliveredAtUtc" },
            TableName,
            new[]
            {
                request.DeliveryState,
                request.FailureReason ?? string.Empty,
                request.DeliveredAtUtc?.ToString("yyyy-MM-dd HH:mm:ss.ffffff") ?? string.Empty
            },
            "Id = @param3",
            new object[] { request.Id },
            ct: ct);
    }

    public async Task<int> CountRecentRequestsAsync(string normalizedEmail, DateTime sinceUtc, CancellationToken ct)
    {
        var rows = await _db.SelectAsync(
            fields: "COUNT(*)",
            table: TableName,
            whereClause: "NormalizedEmail = @param0 AND CreatedAtUtc >= @param1",
            parameters: new object[] { normalizedEmail, sinceUtc.ToString("yyyy-MM-dd HH:mm:ss.ffffff") },
            ct: ct);

        if (rows is null || rows.Rows.Count == 0) return 0;
        return Convert.ToInt32(rows.Rows[0][0]);
    }

    private static PasswordResetRequest? MapFirstOrDefault(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return null;
        return MapRow(rows.Rows[0]);
    }

    private static PasswordResetRequest MapRow(DataRow r)
    {
        var failureReason = r["FailureReason"]?.ToString();
        var reqByStr = r["RequestedByUserId"]?.ToString();
        var deliveredAtStr = r["DeliveredAtUtc"]?.ToString();

        return new PasswordResetRequest(
            id: Guid.Parse(r["Id"].ToString() ?? string.Empty),
            tenantId: Guid.Parse(r["TenantId"].ToString() ?? string.Empty),
            userId: Guid.Parse(r["UserId"].ToString() ?? string.Empty),
            normalizedEmail: r["NormalizedEmail"]?.ToString() ?? string.Empty,
            hashedTempPassword: r["HashedTempPassword"]?.ToString() ?? string.Empty,
            deliveryState: r["DeliveryState"]?.ToString() ?? "Pending",
            failureReason: string.IsNullOrEmpty(failureReason) ? null : failureReason,
            requestedByUserId: string.IsNullOrEmpty(reqByStr) ? null : Guid.Parse(reqByStr),
            createdAtUtc: Convert.ToDateTime(r["CreatedAtUtc"]),
            deliveredAtUtc: string.IsNullOrEmpty(deliveredAtStr) ? null : Convert.ToDateTime(deliveredAtStr),
            expiresAtUtc: Convert.ToDateTime(r["ExpiresAtUtc"]));
    }
}
