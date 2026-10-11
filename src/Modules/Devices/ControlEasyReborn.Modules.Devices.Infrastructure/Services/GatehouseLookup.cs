using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using DBTools.Abstractions;

namespace ControlEasyReborn.Modules.Devices.Infrastructure.Services;

// Resolves a gatehouse id to its owning tenant. Cross-tenant gatehouse ids
// return null (same as not-found) so the handler cannot leak the existence
// of another tenant's gatehouses.
public sealed class GatehouseLookup : IGatehouseLookup
{
    private readonly ITenantContext _ctx;
    private readonly ITenantAwareLinqFactory _factory;

    public GatehouseLookup(ITenantContext ctx, ITenantAwareLinqFactory factory)
    {
        _ctx = ctx;
        _factory = factory;
    }

    public async Task<Guid?> GetGatehouseTenantAsync(Guid gatehouseId, CancellationToken ct)
    {
        var db = _factory.Create(_ctx, bypassTenantFilter: true);
        var rows = await db.SelectAsync(
            fields: "TenantId",
            table: "Gatehouses",
            whereClause: "Id = @param0",
            parameters: new object[] { gatehouseId },
            ct: ct);

        if (rows is null || rows.Rows.Count == 0) return null;

        var value = rows.Rows[0]["TenantId"]?.ToString();
        if (string.IsNullOrEmpty(value)) return null;
        return Guid.TryParse(value, out var tid) ? tid : null;
    }

    public async Task<bool> IsActiveAsync(Guid tenantId, Guid gatehouseId, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: "Id",
            table: "Gatehouses",
            whereClause: "Id = @param0 AND TenantId = @param1 AND Active = 1",
            parameters: new object[] { gatehouseId, tenantId },
            ct: ct);
        return rows is not null && rows.Rows.Count > 0;
    }

    // Phase 26 (DOOR-13) — fetch the gatehouse's display name. Tenant-scoped
    // lookup: returns null if the gatehouse is owned by another tenant. The
    // caller already has the gatehouse id from a tenant-scoped device row, so
    // the cross-tenant path is the rare fail-on-rename case.
    public async Task<string?> GetNameAsync(Guid tenantId, Guid gatehouseId, CancellationToken ct)
    {
        var owner = await GetGatehouseTenantAsync(gatehouseId, ct);
        if (owner is null || owner.Value != tenantId) return null;

        var db = _factory.Create(_ctx, bypassTenantFilter: true);
        var rows = await db.SelectAsync(
            fields: "Name",
            table: "Gatehouses",
            whereClause: "Id = @param0",
            parameters: new object[] { gatehouseId },
            ct: ct);

        if (rows is null || rows.Rows.Count == 0) return null;
        return rows.Rows[0]["Name"]?.ToString();
    }
}
