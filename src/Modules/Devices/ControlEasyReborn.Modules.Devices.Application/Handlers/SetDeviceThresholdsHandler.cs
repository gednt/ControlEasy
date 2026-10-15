using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Application.Errors;
using ControlEasyReborn.Modules.Devices.Application.Logging;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace ControlEasyReborn.Modules.Devices.Application.Handlers;

// Per-device Configure flow — persisted heartbeat thresholds
// (PUT /api/v1/devices/{deviceId}/thresholds). Mirrors EditDeviceHandler's
// structure: IValidator<T> → module exceptions → repo mutate. The device
// lookup is tenant-scoped (foreign / missing / removed devices are all "not
// found" so another tenant's device ids cannot be probed). The DeviceHeartbeat
// entity's InvalidOperationException invariants must stay unreachable —
// UpdateDeviceThresholdsValidator rejects invalid input first.
public sealed class SetDeviceThresholdsHandler
{
    private readonly IDeviceRepository _devices;
    private readonly IDeviceHeartbeatRepository _heartbeats;
    private readonly IValidator<UpdateDeviceThresholdsRequest> _validator;
    private readonly ILogger<SetDeviceThresholdsHandler> _logger;

    public SetDeviceThresholdsHandler(
        IDeviceRepository devices,
        IDeviceHeartbeatRepository heartbeats,
        IValidator<UpdateDeviceThresholdsRequest> validator,
        ILogger<SetDeviceThresholdsHandler>? logger = null)
    {
        _devices = devices;
        _heartbeats = heartbeats;
        _validator = validator;
        _logger = logger ?? Microsoft.Extensions.Logging.Abstractions.NullLogger<SetDeviceThresholdsHandler>.Instance;
    }

    public async Task<DeviceThresholdsDto> HandleAsync(
        Guid tenantId,
        Guid deviceId,
        UpdateDeviceThresholdsRequest request,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            throw new Errors.ValidationException(validation.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()));
        }

        var device = await _devices.GetByIdAsync(tenantId, deviceId, ct);
        if (device is null || device.IsRemoved)
        {
            throw new NotFoundException($"Device {deviceId} not found.");
        }

        // ErrorRateThresholdPercent is DECIMAL(5,2) in device_heartbeats — a
        // request like 12.345 would be silently rounded by MySQL on store
        // while the 200 body echoed the un-rounded value. Round to the stored
        // scale (AwayFromZero, matching MySQL's default) before persisting
        // AND echoing so the response always tells the truth.
        var errorRateThresholdPercent =
            decimal.Round(request.ErrorRateThresholdPercent, 2, MidpointRounding.AwayFromZero);

        await _heartbeats.SetThresholdsAsync(
            tenantId,
            deviceId,
            request.OfflineAfterSeconds,
            errorRateThresholdPercent,
            ct);

        using (DeviceLoggingProperties.BeginScope(tenantId, device.Id, outcome: "device.thresholds.set"))
        {
            _logger.LogInformation(
                "device.thresholds.set tenant {TenantId} device {DeviceId} offlineAfterSeconds {OfflineAfterSeconds} errorRateThresholdPercent {ErrorRateThresholdPercent}.",
                tenantId, device.Id, request.OfflineAfterSeconds, errorRateThresholdPercent);
        }

        return new DeviceThresholdsDto(
            DeviceId: device.Id,
            OfflineAfterSeconds: request.OfflineAfterSeconds,
            ErrorRateThresholdPercent: errorRateThresholdPercent);
    }
}