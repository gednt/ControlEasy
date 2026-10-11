using System.Text;
using System.Text.Json;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Application.Errors;
using ControlEasyReborn.Modules.Devices.Application.Logging;
using ControlEasyReborn.Modules.Devices.Domain.Entities;
using ControlEasyReborn.Modules.Devices.Domain.Errors;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace ControlEasyReborn.Modules.Devices.Application.Handlers;

// DOOR-06: registers a new device for the actor's tenant. Encrypts the
// connection params via IDeviceConnectionCryptoService before persistence;
// returns a DeviceDetail whose connectionParams are always redacted (last-4
// fingerprint only — never plaintext).
public sealed class RegisterDeviceHandler
{
    private readonly IDeviceRepository _devices;
    private readonly IGatehouseLookup _gatehouses;
    private readonly IDeviceConnectionCryptoService _crypto;
    private readonly IValidator<RegisterDeviceRequest> _validator;
    private readonly ILogger<RegisterDeviceHandler> _logger;

    public RegisterDeviceHandler(
        IDeviceRepository devices,
        IGatehouseLookup gatehouses,
        IDeviceConnectionCryptoService crypto,
        IValidator<RegisterDeviceRequest> validator,
        ILogger<RegisterDeviceHandler>? logger = null)
    {
        _devices = devices;
        _gatehouses = gatehouses;
        _crypto = crypto;
        _validator = validator;
        _logger = logger ?? Microsoft.Extensions.Logging.Abstractions.NullLogger<RegisterDeviceHandler>.Instance;
    }

    public async Task<DeviceDetail> HandleAsync(
        Guid tenantId,
        RegisterDeviceRequest request,
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

        // Cross-tenant gatehouse check. A gatehouse belonging to another tenant
        // is indistinguishable from a non-existent one (404, not 403) so the
        // existence of another tenant's gatehouses cannot be probed.
        if (request.GatehouseId.HasValue && request.GatehouseId.Value != Guid.Empty)
        {
            var gatehouseTenant = await _gatehouses.GetGatehouseTenantAsync(request.GatehouseId.Value, ct);
            if (gatehouseTenant is null || gatehouseTenant.Value != tenantId)
            {
                throw new NotFoundException($"Gatehouse {request.GatehouseId} not found for this tenant.");
            }
        }

        var plaintextJson = JsonSerializer.SerializeToUtf8Bytes(request.ConnectionParams ?? new Dictionary<string, object>());
        var ciphertext = _crypto.Encrypt(tenantId, plaintextJson);

        var device = new Device(
            id: Guid.NewGuid(),
            tenantId: tenantId,
            deviceType: request.DeviceType.ToLowerInvariant(),
            vendor: request.Vendor,
            connectionParamsCiphertext: ciphertext,
            gatehouseId: request.GatehouseId,
            isActive: true,
            createdByProfileId: actorProfileId,
            createdAtUtc: DateTime.UtcNow);

        await _devices.InsertAsync(device, ct);

        using (DeviceLoggingProperties.BeginScope(tenantId, device.Id, actorProfileId,
                   outcome: "device.registered"))
        {
            _logger.LogInformation(
                "device.registered tenant {TenantId} device {DeviceId} type {DeviceType} vendor {Vendor}.",
                tenantId, device.Id, device.DeviceType, device.Vendor);
        }

        return ToDetail(device);
    }

    public static DeviceDetail ToDetail(Device d) => new(
        Id: d.Id,
        TenantId: d.TenantId,
        DeviceType: d.DeviceType,
        Vendor: d.Vendor,
        ConnectionParams: new RedactedConnectionParams(true, Last4OfCiphertext(d.ConnectionParamsCiphertext)),
        GatehouseId: d.GatehouseId,
        GatehouseName: null,
        IsActive: d.IsActive,
        CreatedAtUtc: d.CreatedAtUtc,
        UpdatedAtUtc: d.UpdatedAtUtc,
        RemovedAtUtc: d.RemovedAtUtc,
        CreatedByProfileId: d.CreatedByProfileId);

    private static string Last4OfCiphertext(byte[] ciphertext)
    {
        if (ciphertext is null || ciphertext.Length == 0) return "0000";
        var start = Math.Max(0, ciphertext.Length - 4);
        var len = ciphertext.Length - start;
        var sb = new StringBuilder(len * 2);
        for (var i = start; i < ciphertext.Length; i++) sb.Append(ciphertext[i].ToString("x2"));
        return sb.ToString();
    }
}