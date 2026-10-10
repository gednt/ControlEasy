using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Domain.Entities;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using DBTools.Abstractions;

namespace ControlEasyReborn.Modules.Devices.Infrastructure.Persistence;

public sealed class DeviceUnlockAuditRepository : IDeviceUnlockAuditRepository
{
    private const string TableName = "DeviceUnlockAudit";

    private readonly ITenantContext _ctx;
    private readonly ITenantAwareLinqFactory _factory;

    public DeviceUnlockAuditRepository(ITenantContext ctx, ITenantAwareLinqFactory factory)
    {
        _ctx = ctx;
        _factory = factory;
    }

    public async Task InsertAsync(DeviceUnlockAudit audit, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        await db.InsertAsync(
            new[]
            {
                "Id", "TenantId", "DeviceId", "ActorProfileId", "CommandHash", "OccurredAtUtc",
                "ResponseOutcome", "CommandNonce", "CorrelationId", "tenant_id"
            },
            TableName,
            new object[]
            {
                audit.Id,
                audit.TenantId,
                audit.DeviceId,
                audit.ActorProfileId,
                audit.CommandHash,
                audit.OccurredAtUtc,
                audit.ResponseOutcome.ToString(),
                audit.CommandNonce,
                audit.CorrelationId,
                audit.TenantId
            },
            primaryKeyName: "Id",
            autoIncrement: false,
            ct: ct);
    }
}