using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using DBTools.Abstractions;

namespace ControlEasyReborn.Modules.Devices.Infrastructure.Persistence;

// Persists the per-tenant DoorIntegrationEnabled flag + audit-trail columns
// (DoorIntegrationChangedAtUtc / DoorIntegrationChangedByProfileId) to the
// Tenants table. The Phase 23 TenantDoorIntegrationFlagLookup is a read-only
// helper — this repo also WRITES.
public sealed class TenantDoorIntegrationRepository : ITenantDoorIntegrationRepository
{
    private const string TableName = "Tenants";

    private readonly ITenantContext _ctx;
    private readonly ITenantAwareLinqFactory _factory;

    public TenantDoorIntegrationRepository(ITenantContext ctx, ITenantAwareLinqFactory factory)
    {
        _ctx = ctx;
        _factory = factory;
    }

    public async Task<TenantDoorIntegrationState?> GetAsync(Guid tenantId, CancellationToken ct)
    {
        var db = _factory.Create(_ctx, bypassTenantFilter: true);
        var rows = await db.SelectAsync(
            fields: "Id, DoorIntegrationEnabled, DoorIntegrationChangedAtUtc, DoorIntegrationChangedByProfileId",
            table: TableName,
            whereClause: "Id = @param0",
            parameters: new object[] { tenantId },
            ct: ct);

        if (rows is null || rows.Rows.Count == 0) return null;

        var row = rows.Rows[0];
        var enabledObj = row["DoorIntegrationEnabled"];
        var enabled = enabledObj is not null && enabledObj != DBNull.Value && Convert.ToInt32(enabledObj) == 1;

        var changedAtObj = row["DoorIntegrationChangedAtUtc"];
        DateTime? changedAt = null;
        if (changedAtObj is not null && changedAtObj != DBNull.Value && DateTime.TryParse(changedAtObj.ToString(), null, System.Globalization.DateTimeStyles.RoundtripKind, out var dt))
        {
            changedAt = dt;
        }

        var changedByObj = row["DoorIntegrationChangedByProfileId"];
        Guid? changedBy = null;
        if (changedByObj is not null && changedByObj != DBNull.Value)
        {
            var s = changedByObj.ToString();
            if (!string.IsNullOrEmpty(s) && Guid.TryParse(s, out var g)) changedBy = g;
        }

        return new TenantDoorIntegrationState(tenantId, enabled, changedAt, changedBy);
    }

    public async Task SetAsync(
        Guid tenantId,
        bool isEnabled,
        Guid actorProfileId,
        DateTime occurredAtUtc,
        CancellationToken ct)
    {
        var db = _factory.Create(_ctx, bypassTenantFilter: true);
        var updated = await db.UpdateAsync(
            new[] { "DoorIntegrationEnabled", "DoorIntegrationChangedAtUtc", "DoorIntegrationChangedByProfileId" },
            TableName,
            new[]
            {
                isEnabled ? "1" : "0",
                occurredAtUtc.ToString("yyyy-MM-dd HH:mm:ss.ffffff"),
                actorProfileId.ToString()
            },
            "Id = @param0",
            new object[] { tenantId },
            ct: ct);

        if (!updated || !string.IsNullOrEmpty(db.Error))
            throw new InvalidOperationException($"Failed to update tenant {tenantId} door integration flag. {db.Error}");
    }
}