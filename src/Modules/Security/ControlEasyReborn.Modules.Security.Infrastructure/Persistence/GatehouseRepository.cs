using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.Security.Application.Abstractions;
using ControlEasyReborn.Modules.Security.Domain.Entities;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using DBTools.Abstractions;
using System.Data;

namespace ControlEasyReborn.Modules.Security.Infrastructure.Persistence;

public sealed class GatehouseRepository : IGatehouseRepository
{
    private const string TableName = "Gatehouses";

    private readonly ITenantContext _ctx;
    private readonly ITenantAwareLinqFactory _factory;

    public GatehouseRepository(ITenantContext ctx, ITenantAwareLinqFactory factory)
    {
        _ctx = ctx;
        _factory = factory;
    }

    public async Task<Gatehouse?> FindAsync(Guid id, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: "Id, TenantId, Name, Location, Active",
            table: TableName,
            whereClause: "Id = @param0",
            parameters: new object[] { id },
            ct: ct);
        return MapFirstOrDefault(rows);
    }

    public async Task<IReadOnlyList<Gatehouse>> ListByTenantAsync(Guid tenantId, bool includeInactive, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: "Id, TenantId, Name, Location, Active",
            table: TableName,
            whereClause: includeInactive ? "TenantId = @param0" : "TenantId = @param0 AND Active = 1",
            parameters: new object[] { tenantId },
            ct: ct);
        return MapList(rows);
    }

    public async Task AddAsync(Gatehouse gatehouse, CancellationToken ct)
    {
        var tenantId = _ctx.TenantId
            ?? throw new InvalidOperationException("A resolved tenant context is required to insert a gatehouse.");
        if (tenantId != gatehouse.TenantId)
        {
            throw new InvalidOperationException("The gatehouse tenant does not match the authenticated tenant context.");
        }

        var db = _factory.Create(_ctx);
        var inserted = await db.InsertAsync(
            new[] { "Id", "TenantId", "Name", "Location", "tenant_id" },
            TableName,
            new object?[]
            {
                gatehouse.Id,
                tenantId,
                gatehouse.Name,
                (object?)gatehouse.Location ?? DBNull.Value,
                tenantId
            },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);

        if (!inserted)
        {
            ct.ThrowIfCancellationRequested();
            throw new InvalidOperationException($"Failed to insert gatehouse {gatehouse.Id}. {db.Error}");
        }
    }

    public async Task UpdateAsync(Gatehouse gatehouse, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        await db.UpdateAsync(
            new[] { "Name", "Location" },
            TableName,
            new[] { gatehouse.Name, gatehouse.Location ?? string.Empty },
            "Id = @param0",
            new object[] { gatehouse.Id },
            ct: ct);
    }

    public async Task SetActiveAsync(Gatehouse gatehouse, CancellationToken ct)
    {
        var tenantId = _ctx.TenantId
            ?? throw new InvalidOperationException("A resolved tenant context is required to update a gatehouse.");
        if (tenantId != gatehouse.TenantId)
        {
            throw new InvalidOperationException("The gatehouse tenant does not match the authenticated tenant context.");
        }

        var db = _factory.Create(_ctx);
        var updated = await db.UpdateAsync(
            new[] { "Active" },
            TableName,
            new[] { gatehouse.Active ? "1" : "0" },
            "Id = @param1 AND tenant_id = @param2",
            new object[] { gatehouse.Id.ToString(), tenantId.ToString() },
            ct: ct);
        if (!updated)
        {
            ct.ThrowIfCancellationRequested();
            throw new InvalidOperationException($"Failed to update gatehouse {gatehouse.Id} lifecycle state. {db.Error}");
        }
    }

    private static Gatehouse? MapFirstOrDefault(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return null;
        return MapRow(rows.Rows[0]);
    }

    private static IReadOnlyList<Gatehouse> MapList(DataTable rows)
    {
        if (rows is null || rows.Rows.Count == 0) return Array.Empty<Gatehouse>();
        var list = new List<Gatehouse>(rows.Rows.Count);
        foreach (DataRow r in rows.Rows)
        {
            var mapped = MapRow(r);
            if (mapped is not null) list.Add(mapped);
        }
        return list;
    }

    private static Gatehouse? MapRow(DataRow r)
    {
        return new Gatehouse(
            id: Guid.Parse(r["Id"].ToString() ?? string.Empty),
            tenantId: Guid.Parse(r["TenantId"].ToString() ?? string.Empty),
            name: r["Name"]?.ToString() ?? string.Empty,
            location: string.IsNullOrEmpty(r["Location"]?.ToString()) ? null : r["Location"].ToString(),
            active: Convert.ToBoolean(r["Active"]));
    }
}
