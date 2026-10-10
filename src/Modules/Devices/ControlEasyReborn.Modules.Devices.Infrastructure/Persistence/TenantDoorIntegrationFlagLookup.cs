using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.Devices.Application.Handlers;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using DBTools.Abstractions;

namespace ControlEasyReborn.Modules.Devices.Infrastructure.Persistence;

public sealed class TenantDoorIntegrationFlagLookup : ITenantDoorIntegrationFlagLookup
{
    private readonly ITenantContext _ctx;
    private readonly ITenantAwareLinqFactory _factory;

    public TenantDoorIntegrationFlagLookup(ITenantContext ctx, ITenantAwareLinqFactory factory)
    {
        _ctx = ctx;
        _factory = factory;
    }

    public async Task<bool> IsEnabledAsync(Guid tenantId, CancellationToken ct)
    {
        var db = _factory.Create(_ctx, bypassTenantFilter: true);
        var rows = await db.SelectAsync(
            fields: "DoorIntegrationEnabled",
            table: "Tenants",
            whereClause: "Id = @param0",
            parameters: new object[] { tenantId },
            ct: ct);

        if (rows is null || rows.Rows.Count == 0) return false;
        var value = rows.Rows[0]["DoorIntegrationEnabled"];
        if (value is null || value == DBNull.Value) return false;
        return Convert.ToInt32(value) == 1;
    }
}