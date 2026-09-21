using System.Data;
using ControlEasyReborn.Modules.Tenants.Application;
using ControlEasyReborn.Modules.Tenants.Application.Abstractions;
using ControlEasyReborn.Modules.Tenants.Application.Contracts;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using DBTools.Abstractions;

namespace ControlEasyReborn.Modules.Tenants.Infrastructure.Persistence;

public sealed class TenantAdminRepository : ITenantAdminRepository
{
    private const string TableName = "Users";
    private const string SelectFields = "Id, TenantId, Email, DisplayName, Active, Roles, CreatedAtUtc";

    private readonly IAsyncSqlClient _db;

    public TenantAdminRepository(IAsyncSqlClient db)
    {
        _db = db;
    }

    public async Task<TenantAdminResponse> CreateAdminAsync(Guid tenantId, string email, string displayName, string passwordHash, CancellationToken ct)
    {
        var userId = Guid.NewGuid();
        var profileId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        await _db.InsertAsync(
            new[] { "Id", "TenantId", "Email", "PasswordHash", "DisplayName", "Active", "MustChangePassword", "Roles", "CreatedAtUtc", "UpdatedAtUtc", "tenant_id" },
            TableName,
            new object?[] { userId, tenantId, email, passwordHash, displayName, true, true, "TenantAdmin", now, DBNull.Value, tenantId },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);

        await _db.InsertAsync(
            new[] { "Id", "TenantId", "UserId", "DisplayName", "ShiftId", "GatehouseId", "Permissions", "Active", "CreatedAtUtc", "tenant_id" },
            "AttendantProfiles",
            new object?[]
            {
                profileId, tenantId, userId, displayName,
                DBNull.Value, DBNull.Value, TenantAdminDefaults.Permissions, true, now, tenantId
            },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);

        return new TenantAdminResponse(userId, email, displayName, tenantId, true, now);
    }

    public async Task<IReadOnlyList<TenantAdminResponse>> ListAdminsAsync(Guid tenantId, CancellationToken ct)
    {
        var rows = await _db.SelectAsync(
            fields: SelectFields,
            table: TableName,
            whereClause: "TenantId = @param0 AND Roles LIKE '%TenantAdmin%'",
            parameters: new object[] { tenantId },
            ct: ct);

        var result = new List<TenantAdminResponse>();
        if (rows is null || rows.Rows.Count == 0) return result;

        foreach (DataRow r in rows.Rows)
        {
            result.Add(new TenantAdminResponse(
                UserId: Guid.Parse(r["Id"].ToString() ?? string.Empty),
                Email: r["Email"]?.ToString() ?? string.Empty,
                DisplayName: r["DisplayName"]?.ToString() ?? string.Empty,
                TenantId: Guid.Parse(r["TenantId"].ToString() ?? string.Empty),
                Active: Convert.ToBoolean(r["Active"]),
                CreatedAtUtc: Convert.ToDateTime(r["CreatedAtUtc"])));
        }

        return result;
    }

    public async Task<TenantAdminResponse> UpdateAdminAsync(Guid tenantId, Guid userId, string email, string displayName, CancellationToken ct)
    {
        var rows = await _db.SelectAsync(
            fields: SelectFields,
            table: TableName,
            whereClause: "Id = @param0 AND TenantId = @param1 AND Roles LIKE '%TenantAdmin%'",
            parameters: new object[] { userId.ToString(), tenantId.ToString() },
            ct: ct);

        if (rows is null || rows.Rows.Count == 0)
            throw new InvalidOperationException($"Tenant admin {userId} was not found for tenant {tenantId}.");

        var now = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
        const int fieldCount = 3;
        await _db.UpdateAsync(
            new[] { "Email", "DisplayName", "UpdatedAtUtc" },
            TableName,
            new[] { email, displayName, now },
            $"Id = @param{fieldCount}",
            new object[] { userId.ToString() },
            ct: ct);

        var createdAtUtc = Convert.ToDateTime(rows.Rows[0]["CreatedAtUtc"]);
        var active = Convert.ToBoolean(rows.Rows[0]["Active"]);
        return new TenantAdminResponse(userId, email, displayName, tenantId, active, createdAtUtc);
    }

    public async Task<PorteiroResponse> CreatePorteiroAsync(Guid tenantId, string email, string displayName, string passwordHash, CancellationToken ct)
    {
        var userId = Guid.NewGuid();
        var profileId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        await _db.InsertAsync(
            new[] { "Id", "TenantId", "Email", "PasswordHash", "DisplayName", "Active", "MustChangePassword", "Roles", "CreatedAtUtc", "UpdatedAtUtc", "tenant_id" },
            TableName,
            new object?[] { userId, tenantId, email, passwordHash, displayName, true, true, PorteiroDefaults.Role, now, DBNull.Value, tenantId },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);

        await _db.InsertAsync(
            new[] { "Id", "TenantId", "UserId", "DisplayName", "ShiftId", "GatehouseId", "Permissions", "Active", "CreatedAtUtc", "tenant_id" },
            "AttendantProfiles",
            new object?[]
            {
                profileId, tenantId, userId, displayName,
                DBNull.Value, DBNull.Value, PorteiroDefaults.Permissions, true, now, tenantId
            },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);

        return new PorteiroResponse(userId, profileId, email, displayName, tenantId, true, now);
    }

    public async Task<IReadOnlyList<PorteiroResponse>> ListPorteirosAsync(Guid tenantId, CancellationToken ct)
    {
        var userRows = await _db.SelectAsync(
            fields: SelectFields,
            table: TableName,
            whereClause: "TenantId = @param0 AND Roles = @param1",
            parameters: new object[] { tenantId, PorteiroDefaults.Role },
            ct: ct);

        if (userRows is null || userRows.Rows.Count == 0)
            return [];

        var profileRows = await _db.SelectAsync(
            fields: "Id, UserId",
            table: "AttendantProfiles",
            whereClause: "TenantId = @param0",
            parameters: new object[] { tenantId },
            ct: ct);

        var profileByUserId = new Dictionary<Guid, Guid>();
        if (profileRows is not null)
        {
            foreach (DataRow r in profileRows.Rows)
            {
                var userId = Guid.Parse(r["UserId"].ToString() ?? string.Empty);
                profileByUserId[userId] = Guid.Parse(r["Id"].ToString() ?? string.Empty);
            }
        }

        var result = new List<PorteiroResponse>();
        foreach (DataRow r in userRows.Rows)
        {
            var userId = Guid.Parse(r["Id"].ToString() ?? string.Empty);
            if (!profileByUserId.TryGetValue(userId, out var profileId))
                continue;

            result.Add(new PorteiroResponse(
                UserId: userId,
                ProfileId: profileId,
                Email: r["Email"]?.ToString() ?? string.Empty,
                DisplayName: r["DisplayName"]?.ToString() ?? string.Empty,
                TenantId: tenantId,
                Active: Convert.ToBoolean(r["Active"]),
                CreatedAtUtc: Convert.ToDateTime(r["CreatedAtUtc"])));
        }

        return result;
    }

    public async Task SetAdminActiveAsync(Guid tenantId, Guid userId, bool active, CancellationToken ct)
    {
        var rows = await _db.SelectAsync(
            fields: SelectFields,
            table: TableName,
            whereClause: "Id = @param0 AND TenantId = @param1 AND Roles LIKE '%TenantAdmin%'",
            parameters: new object[] { userId.ToString(), tenantId.ToString() },
            ct: ct);

        if (rows is null || rows.Rows.Count == 0)
            throw new InvalidOperationException($"Tenant admin {userId} was not found for tenant {tenantId}.");

        var now = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
        const int fieldCount = 2;
        await _db.UpdateAsync(
            new[] { "Active", "UpdatedAtUtc" },
            TableName,
            new[] { active ? "1" : "0", now },
            $"Id = @param{fieldCount}",
            new object[] { userId.ToString() },
            ct: ct);

        if (!active)
        {
            await DeactivateAttendantProfilesAsync(userId, ct);
            await RevokeRefreshTokensAsync(userId, ct);
        }
    }

    public async Task DeleteAdminAsync(Guid tenantId, Guid userId, CancellationToken ct)
    {
        var rows = await _db.SelectAsync(
            fields: SelectFields,
            table: TableName,
            whereClause: "Id = @param0 AND TenantId = @param1 AND Roles LIKE '%TenantAdmin%'",
            parameters: new object[] { userId.ToString(), tenantId.ToString() },
            ct: ct);

        if (rows is null || rows.Rows.Count == 0)
            throw new InvalidOperationException($"Tenant admin {userId} was not found for tenant {tenantId}.");

        await _db.DeleteAsync("AttendantProfiles", "UserId = @param0 AND TenantId = @param1", new object[] { userId.ToString(), tenantId.ToString() }, ct);
        await _db.DeleteAsync("RefreshTokens", "UserId = @param0", new object[] { userId.ToString() }, ct);
        await _db.DeleteAsync(TableName, "Id = @param0", new object[] { userId.ToString() }, ct);
    }

    public async Task UpdatePorteiroAsync(Guid tenantId, Guid userId, string email, string displayName, CancellationToken ct)
    {
        var rows = await _db.SelectAsync(
            fields: SelectFields,
            table: TableName,
            whereClause: "Id = @param0 AND TenantId = @param1 AND Roles = @param2",
            parameters: new object[] { userId.ToString(), tenantId.ToString(), PorteiroDefaults.Role },
            ct: ct);

        if (rows is null || rows.Rows.Count == 0)
            throw new InvalidOperationException($"Porteiro {userId} was not found for tenant {tenantId}.");

        var now = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
        const int fieldCount = 3;
        await _db.UpdateAsync(
            new[] { "Email", "DisplayName", "UpdatedAtUtc" },
            TableName,
            new[] { email, displayName, now },
            $"Id = @param{fieldCount}",
            new object[] { userId.ToString() },
            ct: ct);

        await _db.UpdateAsync(
            new[] { "DisplayName", "UpdatedAtUtc" },
            "AttendantProfiles",
            new[] { displayName, now },
            "TenantId = @param2 AND UserId = @param3",
            new object[] { tenantId.ToString(), userId.ToString() },
            ct: ct);
    }

    public async Task SetPorteiroActiveAsync(Guid tenantId, Guid userId, bool active, CancellationToken ct)
    {
        var rows = await _db.SelectAsync(
            fields: SelectFields,
            table: TableName,
            whereClause: "Id = @param0 AND TenantId = @param1 AND Roles = @param2",
            parameters: new object[] { userId.ToString(), tenantId.ToString(), PorteiroDefaults.Role },
            ct: ct);

        if (rows is null || rows.Rows.Count == 0)
            throw new InvalidOperationException($"Porteiro {userId} was not found for tenant {tenantId}.");

        var now = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
        const int fieldCount = 2;
        await _db.UpdateAsync(
            new[] { "Active", "UpdatedAtUtc" },
            TableName,
            new[] { active ? "1" : "0", now },
            $"Id = @param{fieldCount}",
            new object[] { userId.ToString() },
            ct: ct);

        if (!active)
        {
            await DeactivateAttendantProfilesAsync(userId, ct);
            await RevokeRefreshTokensAsync(userId, ct);
        }
    }

    public async Task DeletePorteiroAsync(Guid tenantId, Guid userId, CancellationToken ct)
    {
        var rows = await _db.SelectAsync(
            fields: SelectFields,
            table: TableName,
            whereClause: "Id = @param0 AND TenantId = @param1 AND Roles = @param2",
            parameters: new object[] { userId.ToString(), tenantId.ToString(), PorteiroDefaults.Role },
            ct: ct);

        if (rows is null || rows.Rows.Count == 0)
            throw new InvalidOperationException($"Porteiro {userId} was not found for tenant {tenantId}.");

        await _db.DeleteAsync("AttendantProfiles", "UserId = @param0 AND TenantId = @param1", new object[] { userId.ToString(), tenantId.ToString() }, ct);
        await _db.DeleteAsync("RefreshTokens", "UserId = @param0", new object[] { userId.ToString() }, ct);
        await _db.DeleteAsync(TableName, "Id = @param0", new object[] { userId.ToString() }, ct);
    }

    private async Task DeactivateAttendantProfilesAsync(Guid userId, CancellationToken ct)
    {
        await _db.UpdateAsync(
            new[] { "Active", "UpdatedAtUtc" },
            "AttendantProfiles",
            new[] { "0", DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss") },
            "UserId = @param2 AND Active = 1",
            new object[] { userId.ToString() },
            ct: ct);
    }

    private async Task RevokeRefreshTokensAsync(Guid userId, CancellationToken ct)
    {
        await _db.UpdateAsync(
            new[] { "RevokedAtUtc" },
            "RefreshTokens",
            new[] { DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss") },
            "UserId = @param1 AND RevokedAtUtc IS NULL",
            new object[] { userId.ToString() },
            ct: ct);
    }

    public async Task<bool> EmailExistsAsync(string email, Guid? exceptUserId, CancellationToken ct)
    {
        var rows = await _db.SelectAsync(
            fields: "Id",
            table: TableName,
            whereClause: "Email = @param0",
            parameters: new object[] { email },
            ct: ct);

        if (rows is null || rows.Rows.Count == 0)
            return false;

        if (exceptUserId is null)
            return true;

        var existingId = Guid.Parse(rows.Rows[0]["Id"].ToString() ?? string.Empty);
        return existingId != exceptUserId.Value;
    }

    public async Task EnsureAttendantProfileAsync(
        Guid userId,
        Guid tenantId,
        string displayName,
        string roles,
        CancellationToken ct)
    {
        if (!roles.Contains("TenantAdmin", StringComparison.Ordinal) &&
            !roles.Contains("PlatformAdmin", StringComparison.Ordinal))
        {
            return;
        }

        var isPlatformAdmin = roles.Contains("PlatformAdmin", StringComparison.Ordinal);
        var permissions = isPlatformAdmin
            ? "platform:*"
            : TenantAdminDefaults.Permissions;
        var profileTenantId = isPlatformAdmin
            ? PlatformTenant.Id
            : tenantId;

        var existing = await _db.SelectAsync(
            fields: "Id, Permissions",
            table: "AttendantProfiles",
            whereClause: "UserId = @param0 AND TenantId = @param1 AND Active = 1",
            parameters: new object[] { userId, profileTenantId },
            ct: ct);

        if (existing is not null && existing.Rows.Count > 0)
        {
            if (!isPlatformAdmin)
            {
                var profileId = existing.Rows[0]["Id"].ToString() ?? string.Empty;
                var currentPermissions = existing.Rows[0]["Permissions"]?.ToString() ?? string.Empty;
                var currentTokens = currentPermissions
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .ToList();
                var currentSet = new HashSet<string>(currentTokens, StringComparer.OrdinalIgnoreCase);

                var defaultTokens = TenantAdminDefaults.Permissions
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                var missing = defaultTokens.Where(p => !currentSet.Contains(p)).ToList();

                if (missing.Count > 0)
                {
                    currentTokens.AddRange(missing);
                    var newPermissions = string.Join(",", currentTokens);
                    const int fieldCount = 2;
                    await _db.UpdateAsync(
                        new[] { "Permissions", "UpdatedAtUtc" },
                        "AttendantProfiles",
                        new[] { newPermissions, DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss") },
                        $"Id = @param{fieldCount}",
                        new object[] { profileId },
                        ct: ct);
                }
            }
            return;
        }

        await _db.InsertAsync(
            new[] { "Id", "TenantId", "UserId", "DisplayName", "ShiftId", "GatehouseId", "Permissions", "Active", "CreatedAtUtc", "tenant_id" },
            "AttendantProfiles",
            new object?[]
            {
                Guid.NewGuid(), profileTenantId, userId, displayName,
                DBNull.Value, DBNull.Value, permissions, true, DateTime.UtcNow, profileTenantId
            },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);
    }

    public async Task RevokeAdminAsync(Guid userId, CancellationToken ct)
    {
        const int fieldCount = 2;
        await _db.UpdateAsync(
            new[] { "Roles", "UpdatedAtUtc" },
            TableName,
            new[] { "", DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss") },
            $"Id = @param{fieldCount}",
            new object[] { userId.ToString() },
            ct: ct);

        await DeactivateAttendantProfilesAsync(userId, ct);
        await RevokeRefreshTokensAsync(userId, ct);
    }
}