using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Application.Errors;
using ControlEasyReborn.Modules.Devices.Application.Logging;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace ControlEasyReborn.Modules.Devices.Application.Handlers;

// DOOR-06: flip IsActive. Setting isActive=false ALSO sets RemovedAtUtc=now
// (deactivation IS soft-delete — see Phase 24 CONTEXT.md). Setting
// isActive=true on an already-removed device is rejected (no undelete — must
// re-register).
public sealed class ActivateDeactivateDeviceHandler
{
    private readonly IDeviceRepository _devices;
    private readonly ILogger<ActivateDeactivateDeviceHandler> _logger;

    public ActivateDeactivateDeviceHandler(
        IDeviceRepository devices,
        ILogger<ActivateDeactivateDeviceHandler>? logger = null)
    {
        _devices = devices;
        _logger = logger ?? Microsoft.Extensions.Logging.Abstractions.NullLogger<ActivateDeactivateDeviceHandler>.Instance;
    }

    public async Task<DeviceDetail> HandleAsync(
        Guid tenantId,
        Guid deviceId,
        bool isActive,
        Guid actorProfileId,
        CancellationToken ct)
    {
        var device = await _devices.GetByIdAsync(tenantId, deviceId, ct);
        if (device is null || device.IsRemoved)
        {
            throw new NotFoundException($"Device {deviceId} not found.");
        }

        if (isActive && device.IsRemoved)
        {
            throw new Errors.ConflictException(
                $"Device {deviceId} is removed and cannot be reactivated. Re-register the device to bring it back online.");
        }

        if (isActive)
        {
            device.Activate();
        }
        else
        {
            device.Deactivate();
        }

        await _devices.UpdateAsync(device, ct, rotateConnectionParams: false);

        using (DeviceLoggingProperties.BeginScope(tenantId, device.Id, actorProfileId,
                   outcome: isActive ? "device.activated" : "device.deactivated"))
        {
            _logger.LogInformation(
                "device.{Outcome} tenant {TenantId} device {DeviceId} by profile {ActorProfileId}.",
                isActive ? "activated" : "deactivated", tenantId, device.Id, actorProfileId);
        }

        return RegisterDeviceHandler.ToDetail(device);
    }
}