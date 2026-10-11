using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Application.Errors;
using ControlEasyReborn.Modules.Devices.Application.Logging;
using ControlEasyReborn.Modules.Devices.Domain.Errors;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace ControlEasyReborn.Modules.Devices.Application.Handlers;

// DOOR-06: soft-delete. Refuses to remove a device with recent unlock-audit
// rows in the last 24 hours (returns 409 to prevent destruction of audit
// context — see Phase 24 CONTEXT.md "RemoveDeviceHandler").
public sealed class RemoveDeviceHandler
{
    public static readonly TimeSpan RecentActivityWindow = TimeSpan.FromHours(24);

    private readonly IDeviceRepository _devices;
    private readonly ILogger<RemoveDeviceHandler> _logger;

    public RemoveDeviceHandler(
        IDeviceRepository devices,
        ILogger<RemoveDeviceHandler>? logger = null)
    {
        _devices = devices;
        _logger = logger ?? Microsoft.Extensions.Logging.Abstractions.NullLogger<RemoveDeviceHandler>.Instance;
    }

    public async Task HandleAsync(
        Guid tenantId,
        Guid deviceId,
        Guid actorProfileId,
        CancellationToken ct)
    {
        var device = await _devices.GetByIdAsync(tenantId, deviceId, ct);
        if (device is null || device.IsRemoved)
        {
            // Idempotent: already-removed devices return 404 (same shape as
            // never-existed — no leak of the previous existence).
            throw new NotFoundException($"Device {deviceId} not found.");
        }

        var now = DateTime.UtcNow;
        var since = now - RecentActivityWindow;
        var hasRecentActivity = await _devices.HasRecentUnlockAuditAsync(tenantId, deviceId, since, ct);
        if (hasRecentActivity)
        {
            throw new ConflictException(
                $"Device {deviceId} has unlock events in the last {RecentActivityWindow.TotalHours:0}h. Review the audit log before removing.");
        }

        device.Remove(now);
        await _devices.UpdateAsync(device, ct, rotateConnectionParams: false);

        using (DeviceLoggingProperties.BeginScope(tenantId, device.Id, actorProfileId,
                   outcome: "device.removed"))
        {
            _logger.LogInformation(
                "device.removed tenant {TenantId} device {DeviceId} by profile {ActorProfileId}.",
                tenantId, device.Id, actorProfileId);
        }
    }
}