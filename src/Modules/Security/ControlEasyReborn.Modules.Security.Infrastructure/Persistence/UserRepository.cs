using ControlEasyReborn.Modules.Security.Application.Abstractions;
using ControlEasyReborn.Modules.Security.Domain.Entities;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using DBTools.Abstractions;
using System.Data;

namespace ControlEasyReborn.Modules.Security.Infrastructure.Persistence;

public sealed class UserRepository : IUserRepository
{
    private const string TableName = "Users";

    private readonly IAsyncSqlClient _db;

    public UserRepository(IAsyncSqlClient db)
    {
        _db = db;
    }

    private const string SelectFields = "Id, TenantId, Email, PasswordHash, DisplayName, Active, MustChangePassword, Roles, CreatedAtUtc, UpdatedAtUtc";

    public async Task<User?> FindByEmailAsync(string email, CancellationToken ct)
    {
        var rows = await _db.SelectAsync(
            fields: SelectFields,
            table: TableName,
            whereClause: "Email = @param0",
            parameters: new object[] { email },
            ct: ct);
        return MapFirstOrDefault(rows);
    }

    public async Task<User?> FindAsync(Guid id, CancellationToken ct)
    {
        var rows = await _db.SelectAsync(
            fields: SelectFields,
            table: TableName,
            whereClause: "Id = @param0",
            parameters: new object[] { id },
            ct: ct);
        return MapFirstOrDefault(rows);
    }

    public async Task<IReadOnlyList<User>> ListByTenantAsync(Guid tenantId, CancellationToken ct)
    {
        var rows = await _db.SelectAsync(
            fields: SelectFields,
            table: TableName,
            whereClause: "TenantId = @param0",
            parameters: new object[] { tenantId },
            ct: ct);
        return MapList(rows);
    }

    public async Task AddAsync(User user, CancellationToken ct)
    {
        await _db.InsertAsync(
            new[] { "Id", "TenantId", "Email", "PasswordHash", "DisplayName", "Active", "MustChangePassword", "Roles", "CreatedAtUtc", "UpdatedAtUtc" },
            TableName,
            new object?[] { user.Id, user.TenantId, user.Email, user.PasswordHash, user.DisplayName, user.Active, user.MustChangePassword, user.Roles, user.CreatedAtUtc, (object?)user.UpdatedAtUtc ?? DBNull.Value },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);
    }

    public async Task UpdateAsync(User user, CancellationToken ct)
    {
        const int fieldCount = 8;
        var updated = await _db.UpdateAsync(
            new[] { "TenantId", "Email", "PasswordHash", "DisplayName", "Active", "MustChangePassword", "Roles", "UpdatedAtUtc" },
            TableName,
            new[]
            {
                user.TenantId.ToString(),
                user.Email,
                user.PasswordHash,
                user.DisplayName,
                user.Active ? "1" : "0",
                user.MustChangePassword ? "1" : "0",
                user.Roles,
                user.UpdatedAtUtc?.ToString("yyyy-MM-dd HH:mm:ss") ?? string.Empty
            },
            $"Id = @param{fieldCount}",
            new object[] { user.Id.ToString() },
            ct: ct);

        if (!updated)
            throw new InvalidOperationException($"Failed to update user {user.Id}. {_db.Error}");
    }

    private static User? MapFirstOrDefault(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return null;
        return MapRow(rows.Rows[0]);
    }

    private static IReadOnlyList<User> MapList(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return Array.Empty<User>();
        var list = new List<User>(rows.Rows.Count);
        foreach (DataRow r in rows.Rows)
        {
            var mapped = MapRow(r);
            if (mapped is not null) list.Add(mapped);
        }
        return list;
    }

    private static User? MapRow(DataRow r)
    {
        var updatedAtStr = r["UpdatedAtUtc"]?.ToString();
        return new User(
            id: Guid.Parse(r["Id"].ToString() ?? string.Empty),
            tenantId: Guid.Parse(r["TenantId"].ToString() ?? string.Empty),
            email: r["Email"]?.ToString() ?? string.Empty,
            passwordHash: r["PasswordHash"]?.ToString() ?? string.Empty,
            displayName: r["DisplayName"]?.ToString() ?? string.Empty,
            active: Convert.ToBoolean(r["Active"]),
            mustChangePassword: Convert.ToBoolean(r["MustChangePassword"]),
            roles: r["Roles"]?.ToString() ?? string.Empty,
            createdAtUtc: Convert.ToDateTime(r["CreatedAtUtc"]),
            updatedAtUtc: string.IsNullOrEmpty(updatedAtStr) ? null : DateTime.Parse(updatedAtStr, null, System.Globalization.DateTimeStyles.RoundtripKind));
    }
}