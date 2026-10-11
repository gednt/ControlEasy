using System.Text.Json;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Application.Errors;
using ControlEasyReborn.Modules.Devices.Application.Logging;
using ControlEasyReborn.Modules.Devices.Domain.Entities;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace ControlEasyReborn.Modules.Devices.Application.Handlers;

// DOOR-06: partial-update. At least one field must be present; the
// connection params, when present, are rotated atomically (a fresh
// ciphertext replaces the old one in the same UPDATE).
public sealed class EditDeviceHandler
{
    private readonly IDeviceRepository _devices;
    private readonly IGatehouseLookup _gatehouses;
    private readonly IDeviceConnectionCryptoService _crypto;
    private readonly IValidator<EditDeviceRequest> _validator;
    private readonly ILogger<EditDeviceHandler> _logger;

    public EditDeviceHandler(
        IDeviceRepository devices,
        IGatehouseLookup gatehouses,
        IDeviceConnectionCryptoService crypto,
        IValidator<EditDeviceRequest> validator,
        ILogger<EditDeviceHandler>? logger = null)
    {
        _devices = devices;
        _gatehouses = gatehouses;
        _crypto = crypto;
        _validator = validator;
        _logger = logger ?? Microsoft.Extensions.Logging.Abstractions.NullLogger<EditDeviceHandler>.Instance;
    }

    public async Task<DeviceDetail> HandleAsync(
        Guid tenantId,
        Guid deviceId,
        EditDeviceRequest request,
        Guid actorProfileId,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            throw new Errors.ValidationException(validation.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()));
        }

        // Refuse no-op calls.
        if (request.Vendor is null && request.GatehouseId is null && request.ConnectionParams is null)
        {
            throw new Errors.ValidationException(new Dictionary<string, string[]>
            {
                ["request"] = new[] { "At least one field must be provided." }
            });
        }

        var device = await _devices.GetByIdAsync(tenantId, deviceId, ct);
        if (device is null || device.IsRemoved)
        {
            throw new NotFoundException($"Device {deviceId} not found.");
        }

        // Cross-tenant gatehouse check (same rule as register).
        var changesGatehouse = request.GatehouseId.HasValue && request.GatehouseId != device.GatehouseId;
        if (changesGatehouse && request.GatehouseId!.Value != Guid.Empty)
        {
            var gatehouseTenant = await _gatehouses.GetGatehouseTenantAsync(request.GatehouseId.Value, ct);
            if (gatehouseTenant is null || gatehouseTenant.Value != tenantId ||
                !await _gatehouses.IsActiveAsync(tenantId, request.GatehouseId.Value, ct))
            {
                throw new NotFoundException($"Gatehouse {request.GatehouseId} not found for this tenant.");
            }
        }

        device.UpdateMetadata(vendor: request.Vendor, gatehouseId: request.GatehouseId);

        var rotated = false;
        if (request.ConnectionParams is not null)
        {
            var plaintextJson = JsonSerializer.SerializeToUtf8Bytes(request.ConnectionParams);
            var newCiphertext = _crypto.Encrypt(tenantId, plaintextJson);
            device.RotateConnectionParams(newCiphertext);
            rotated = true;
        }

        await _devices.UpdateAsync(device, ct, rotateConnectionParams: rotated);

        using (DeviceLoggingProperties.BeginScope(tenantId, device.Id, actorProfileId,
                   outcome: "device.updated"))
        {
            _logger.LogInformation(
                "device.updated tenant {TenantId} device {DeviceId} by profile {ActorProfileId}.",
                tenantId, device.Id, actorProfileId);
        }

        return RegisterDeviceHandler.ToDetail(device);
    }
}
