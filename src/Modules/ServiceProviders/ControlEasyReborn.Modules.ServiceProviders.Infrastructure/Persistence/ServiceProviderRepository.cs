using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.ServiceProviders.Application.Abstractions;
using ControlEasyReborn.Modules.ServiceProviders.Domain.Entities;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using DBTools.Abstractions;
using System.Data;

namespace ControlEasyReborn.Modules.ServiceProviders.Infrastructure.Persistence;

public sealed class ServiceProviderRepository : IServiceProviderRepository
{
    private const string TableName = "ServiceProviders";

    private readonly ITenantContext _ctx;
    private readonly ITenantAwareLinqFactory _factory;

    public ServiceProviderRepository(ITenantContext ctx, ITenantAwareLinqFactory factory)
    {
        _ctx = ctx;
        _factory = factory;
    }

    public async Task<ServiceProvider?> FindAsync(Guid id, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: "Id, TenantId, Name, Document, Phone, Email, ServiceType, Company, Active, CreatedAtUtc, UpdatedAtUtc",
            table: TableName,
            whereClause: "Id = @param0",
            parameters: new object[] { id },
            ct: ct);
        return MapFirstOrDefault(rows);
    }

    public async Task<IReadOnlyList<ServiceProvider>> ListAsync(string? search, int skip, int take, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var whereClause = string.IsNullOrWhiteSpace(search)
            ? "1=1"
            : "(Name LIKE @param0 OR Document LIKE @param0 OR Company LIKE @param0)";
        var parameters = string.IsNullOrWhiteSpace(search)
            ? Array.Empty<object>()
            : new object[] { "%" + search + "%" };

        var rows = await db.SelectAsync(
            fields: "Id, TenantId, Name, Document, Phone, Email, ServiceType, Company, Active, CreatedAtUtc, UpdatedAtUtc",
            table: TableName,
            whereClause: whereClause,
            parameters: parameters,
            ct: ct);

        return MapList(rows);
    }

    public async Task AddAsync(ServiceProvider provider, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        await db.InsertAsync(
            new[] { "Id", "TenantId", "Name", "Document", "Phone", "Email", "ServiceType", "Company", "Active", "CreatedAtUtc", "UpdatedAtUtc", "tenant_id" },
            TableName,
            new object?[] { provider.Id, provider.TenantId, provider.Name, provider.Document, (object?)provider.Phone ?? DBNull.Value, (object?)provider.Email ?? DBNull.Value, (object?)provider.ServiceType ?? DBNull.Value, (object?)provider.Company ?? DBNull.Value, provider.Active, provider.CreatedAtUtc, (object?)provider.UpdatedAtUtc ?? DBNull.Value, provider.TenantId },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);
    }

    public async Task UpdateAsync(ServiceProvider provider, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        await db.UpdateAsync(
            new[] { "Name", "Document", "Phone", "Email", "ServiceType", "Company", "Active", "UpdatedAtUtc" },
            TableName,
            new[] { provider.Name, provider.Document, provider.Phone ?? string.Empty, provider.Email ?? string.Empty, provider.ServiceType ?? string.Empty, provider.Company ?? string.Empty, provider.Active ? "1" : "0", provider.UpdatedAtUtc.HasValue ? provider.UpdatedAtUtc.Value.ToString("o") : string.Empty },
            "Id = @param0",
            new object[] { provider.Id },
            ct: ct);
    }

    private static ServiceProvider? MapFirstOrDefault(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return null;
        return MapRow(rows.Rows[0]);
    }

    private static IReadOnlyList<ServiceProvider> MapList(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return Array.Empty<ServiceProvider>();
        var list = new List<ServiceProvider>(rows.Rows.Count);
        foreach (DataRow r in rows.Rows)
        {
            var mapped = MapRow(r);
            if (mapped is not null) list.Add(mapped);
        }
        return list;
    }

    private static ServiceProvider? MapRow(DataRow r)
    {
        var updatedAtStr = r["UpdatedAtUtc"]?.ToString();

        return new ServiceProvider(
            id: Guid.Parse(r["Id"].ToString() ?? string.Empty),
            tenantId: Guid.Parse(r["TenantId"].ToString() ?? string.Empty),
            name: r["Name"]?.ToString() ?? string.Empty,
            document: r["Document"]?.ToString() ?? string.Empty,
            phone: string.IsNullOrEmpty(r["Phone"]?.ToString()) ? null : r["Phone"].ToString(),
            email: string.IsNullOrEmpty(r["Email"]?.ToString()) ? null : r["Email"].ToString(),
            serviceType: string.IsNullOrEmpty(r["ServiceType"]?.ToString()) ? null : r["ServiceType"].ToString(),
            company: string.IsNullOrEmpty(r["Company"]?.ToString()) ? null : r["Company"].ToString(),
            active: Convert.ToBoolean(r["Active"]),
            createdAtUtc: Convert.ToDateTime(r["CreatedAtUtc"]),
            updatedAtUtc: string.IsNullOrEmpty(updatedAtStr) ? null : DateTime.Parse(updatedAtStr, null, System.Globalization.DateTimeStyles.RoundtripKind));
    }
}
