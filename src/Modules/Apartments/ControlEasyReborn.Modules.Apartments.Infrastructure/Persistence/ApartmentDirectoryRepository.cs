using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.Apartments.Application.Abstractions;
using ControlEasyReborn.Modules.Apartments.Domain.Entities;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using DBTools.Abstractions;
using System.Data;

namespace ControlEasyReborn.Modules.Apartments.Infrastructure.Persistence;

public sealed class ApartmentDirectoryRepository : IApartmentDirectory
{
    private const string TableName = "Apartments";
    private const string Fields = "Id, TenantId, Block, Unit, Active, CreatedAtUtc, UpdatedAtUtc";

    private readonly ITenantContext _ctx;
    private readonly ITenantAwareLinqFactory _factory;

    public ApartmentDirectoryRepository(ITenantContext ctx, ITenantAwareLinqFactory factory)
    {
        _ctx = ctx;
        _factory = factory;
    }

    public async Task<Apartment?> FindActiveAsync(Guid tenantId, Guid apartmentId, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: "Id = @param0 AND Active = 1",
            parameters: new object[] { apartmentId },
            ct: ct);
        return MapFirstOrDefault(rows);
    }

    public async Task<IReadOnlyList<Apartment>> SearchByBlockAsync(Guid tenantId, string block, int skip, int take, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: "Block = @param0 AND Active = 1",
            parameters: new object[] { block },
            ct: ct);
        return MapList(rows).Skip(skip).Take(take).ToList();
    }

    public async Task<Apartment?> FindFirstActiveAsync(Guid tenantId, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: Fields,
            table: TableName,
            whereClause: "Active = 1",
            parameters: Array.Empty<object>(),
            ct: ct);
        return MapFirstOrDefault(rows);
    }

    private static Apartment? MapFirstOrDefault(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return null;
        return MapRow(rows.Rows[0]);
    }

    private static IReadOnlyList<Apartment> MapList(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return Array.Empty<Apartment>();
        var list = new List<Apartment>(rows.Rows.Count);
        foreach (DataRow r in rows.Rows)
        {
            var mapped = MapRow(r);
            if (mapped is not null) list.Add(mapped);
        }
        return list;
    }

    private static Apartment? MapRow(DataRow r)
    {
        var updatedAtStr = r["UpdatedAtUtc"]?.ToString();
        return new Apartment(
            id: Guid.Parse(r["Id"].ToString() ?? string.Empty),
            tenantId: Guid.Parse(r["TenantId"].ToString() ?? string.Empty),
            block: r["Block"]?.ToString() ?? string.Empty,
            unit: r["Unit"]?.ToString() ?? string.Empty,
            active: Convert.ToBoolean(r["Active"]),
            createdAtUtc: Convert.ToDateTime(r["CreatedAtUtc"]),
            updatedAtUtc: string.IsNullOrEmpty(updatedAtStr) ? null : DateTime.Parse(updatedAtStr, null, System.Globalization.DateTimeStyles.RoundtripKind));
    }
}
