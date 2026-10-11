using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.Tenants.Application.Abstractions;
using ControlEasyReborn.Modules.Tenants.Domain;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using DBTools.Abstractions;

namespace ControlEasyReborn.Modules.Tenants.Infrastructure.Persistence;

public sealed class TenantRepository : ITenantRepository
{
    private const string TableName = "Tenants";

    private readonly ITenantContext _ctx;
    private readonly ITenantAwareLinqFactory _factory;

    public TenantRepository(ITenantContext ctx, ITenantAwareLinqFactory factory)
    {
        _ctx = ctx;
        _factory = factory;
    }

    public async Task<Tenant?> FindAsync(Guid id, CancellationToken ct)
    {
        var db = _factory.Create(_ctx, bypassTenantFilter: true);
        var rows = await db.SelectAsync(
            fields: "Id, Slug, DisplayName, Status, CreatedAtUtc",
            table: TableName,
            whereClause: "Id = @param0",
            parameters: new object[] { id },
            ct: ct);
        return MapFirstOrDefault(rows);
    }

    public async Task<Tenant?> FindBySlugAsync(string slug, CancellationToken ct)
    {
        var db = _factory.Create(_ctx, bypassTenantFilter: true);
        var rows = await db.SelectAsync(
            fields: "Id, Slug, DisplayName, Status, CreatedAtUtc",
            table: TableName,
            whereClause: "Slug = @param0",
            parameters: new object[] { slug },
            ct: ct);
        return MapFirstOrDefault(rows);
    }

    public async Task<IReadOnlyList<Tenant>> ListAsync(CancellationToken ct)
    {
        var db = _factory.Create(_ctx, bypassTenantFilter: true);
        var rows = await db.SelectAsync(
            fields: "Id, Slug, DisplayName, Status, CreatedAtUtc",
            table: TableName,
            whereClause: "1=1 ORDER BY CreatedAtUtc DESC",
            parameters: Array.Empty<object>(),
            ct: ct);
        return MapAll(rows);
    }

    public async Task AddAsync(Tenant tenant, CancellationToken ct)
    {
        var db = _factory.Create(_ctx, bypassTenantFilter: true);
        await db.InsertAsync(
            new[] { "Id", "Slug", "DisplayName", "Status", "CreatedAtUtc" },
            TableName,
            new object[] { tenant.Id, tenant.Slug, tenant.DisplayName, (int)tenant.Status, tenant.CreatedAtUtc },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);
    }

    public async Task UpdateAsync(Tenant tenant, CancellationToken ct)
    {
        var db = _factory.Create(_ctx, bypassTenantFilter: true);
        await db.UpdateAsync(
            new[] { "Slug", "DisplayName", "Status" },
            TableName,
            new[] { tenant.Slug, tenant.DisplayName, ((int)tenant.Status).ToString(System.Globalization.CultureInfo.InvariantCulture) },
            "Id = @param3",
            new object[] { tenant.Id.ToString() },
            ct: ct);
    }

    private static Tenant? MapFirstOrDefault(System.Data.DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return null;
        return MapRow(rows.Rows[0]);
    }

    private static IReadOnlyList<Tenant> MapAll(System.Data.DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0)
            return Array.Empty<Tenant>();

        var tenants = new List<Tenant>(rows.Rows.Count);
        foreach (System.Data.DataRow row in rows.Rows)
        {
            tenants.Add(MapRow(row));
        }

        return tenants;
    }

    private static Tenant MapRow(System.Data.DataRow r) =>
        new(
            id: Guid.Parse(r["Id"].ToString() ?? string.Empty),
            slug: r["Slug"]?.ToString() ?? string.Empty,
            displayName: r["DisplayName"]?.ToString() ?? string.Empty,
            status: (TenantStatus)(int)r["Status"],
            createdAtUtc: (DateTime)r["CreatedAtUtc"]);
}
