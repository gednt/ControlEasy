using ControlEasyReborn.Modules.Security.Application.Abstractions;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using DBTools.Abstractions;
using System.Data;

namespace ControlEasyReborn.Modules.Security.Infrastructure.Persistence;

public sealed class RefreshTokenRepository : IRefreshTokenRepository
{
    private const string TableName = "RefreshTokens";

    private readonly IAsyncSqlClient _db;

    public RefreshTokenRepository(IAsyncSqlClient db)
    {
        _db = db;
    }

    public async Task<RefreshTokenEntry?> FindByTokenAsync(string token, CancellationToken ct)
    {
        var rows = await _db.SelectAsync(
            fields: "Id, UserId, Token, ExpiresAtUtc, RevokedAtUtc, CreatedAtUtc",
            table: TableName,
            whereClause: "Token = @param0",
            parameters: new object[] { token },
            ct: ct);
        return MapFirstOrDefault(rows);
    }

    public async Task AddAsync(RefreshTokenEntry entry, CancellationToken ct)
    {
        await _db.InsertAsync(
            new[] { "Id", "UserId", "Token", "ExpiresAtUtc", "RevokedAtUtc", "CreatedAtUtc" },
            TableName,
            new object?[] { entry.Id, entry.UserId, entry.Token, entry.ExpiresAtUtc, (object?)entry.RevokedAtUtc ?? DBNull.Value, entry.CreatedAtUtc },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);
    }

    public async Task RevokeAsync(RefreshTokenEntry entry, CancellationToken ct)
    {
        entry.RevokedAtUtc = DateTime.UtcNow;
        await _db.UpdateAsync(
            new[] { "RevokedAtUtc" },
            TableName,
            new[] { entry.RevokedAtUtc.Value.ToString("yyyy-MM-dd HH:mm:ss.ffffff") },
            $"Id = '{entry.Id}'",
            Array.Empty<object>(),
            ct: ct);
    }

    public async Task RevokeAllForUserAsync(Guid userId, CancellationToken ct)
    {
        await _db.UpdateAsync(
            new[] { "RevokedAtUtc" },
            TableName,
            new[] { DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss.ffffff") },
            $"UserId = '{userId}' AND RevokedAtUtc IS NULL",
            Array.Empty<object>(),
            ct: ct);
    }

    private static RefreshTokenEntry? MapFirstOrDefault(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return null;
        var r = rows.Rows[0];
        var revokedAtStr = r["RevokedAtUtc"]?.ToString();

        return new RefreshTokenEntry
        {
            Id = Guid.Parse(r["Id"].ToString() ?? string.Empty),
            UserId = Guid.Parse(r["UserId"].ToString() ?? string.Empty),
            Token = r["Token"]?.ToString() ?? string.Empty,
            ExpiresAtUtc = Convert.ToDateTime(r["ExpiresAtUtc"]),
            RevokedAtUtc = string.IsNullOrEmpty(revokedAtStr) ? null : DateTime.Parse(revokedAtStr, null, System.Globalization.DateTimeStyles.RoundtripKind),
            CreatedAtUtc = Convert.ToDateTime(r["CreatedAtUtc"])
        };
    }
}