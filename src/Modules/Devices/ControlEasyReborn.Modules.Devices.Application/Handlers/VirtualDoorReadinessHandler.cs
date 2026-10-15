using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Domain.Entities;

namespace ControlEasyReborn.Modules.Devices.Application.Handlers;

// Shared validation for the development-only "virtual physical reader"
// contract. A simulator device may only present credentials when it:
//   1. exists for the tenant (cross-tenant ids are indistinguishable from
//      not-found — no other tenant's devices can be probed),
//   2. is not soft-deleted and is active,
//   3. is a card reader (device_type = 'reader'),
//   4. IS one of the simulator devices (vendor contains 'simulator' — the
//      UI registers vendor 'ControlEasy simulator'; arbitrary physical
//      readers must not be presentable through the dev surface),
//   5. is bound to a gatehouse of the same tenant and that gatehouse is
//      active (never infer a gatehouse from another tenant).
internal static class SimulatorDeviceGuard
{
    public const string ReasonDeviceNotFound = "device_not_found";
    public const string ReasonDeviceInactive = "device_inactive";
    public const string ReasonNotAReader = "not_a_reader";
    public const string ReasonNotASimulator = "not_a_simulator";
    public const string ReasonNoGatehouseBinding = "gatehouse_binding_missing";
    public const string ReasonGatehouseInactive = "gatehouse_inactive";

    public static async Task<(Device? Device, string? Reason)> ValidateAsync(
        IDeviceRepository devices,
        IGatehouseLookup gatehouses,
        Guid tenantId,
        Guid deviceId,
        CancellationToken ct)
    {
        var device = await devices.GetByIdAsync(tenantId, deviceId, ct);
        if (device is null || device.IsRemoved)
        {
            return (null, ReasonDeviceNotFound);
        }

        if (!device.IsActive)
        {
            return (null, ReasonDeviceInactive);
        }

        if (!string.Equals(device.DeviceType, "reader", StringComparison.Ordinal))
        {
            return (null, ReasonNotAReader);
        }

        if (!device.Vendor.Contains("simulator", StringComparison.OrdinalIgnoreCase))
        {
            return (null, ReasonNotASimulator);
        }

        if (!device.GatehouseId.HasValue)
        {
            return (null, ReasonNoGatehouseBinding);
        }

        if (!await gatehouses.IsActiveAsync(tenantId, device.GatehouseId.Value, ct))
        {
            return (null, ReasonGatehouseInactive);
        }

        return (device, null);
    }
}

// Development-only readiness probe for the Gatehouse "Virtual door" tab.
// Answers: can this simulator device present a credential right now?
// Always returns a readiness verdict (200) — the caller renders the
// actionable guidance from the reason; the endpoint never registers a
// non-reader device as ready.
public sealed record VirtualDoorReadiness(
    bool Ready,
    string? Reason,
    string Vendor,
    Guid? GatehouseId,
    string? GatehouseName);

public sealed class VirtualDoorReadinessHandler
{
    private readonly IDeviceRepository _devices;
    private readonly IGatehouseLookup _gatehouses;
    private readonly ITenantDoorIntegrationFlagLookup _tenantFlagLookup;

    public VirtualDoorReadinessHandler(
        IDeviceRepository devices,
        IGatehouseLookup gatehouses,
        ITenantDoorIntegrationFlagLookup tenantFlagLookup)
    {
        _devices = devices;
        _gatehouses = gatehouses;
        _tenantFlagLookup = tenantFlagLookup;
    }

    public async Task<VirtualDoorReadiness> HandleAsync(Guid tenantId, Guid deviceId, CancellationToken ct)
    {
        var (device, reason) = await SimulatorDeviceGuard.ValidateAsync(_devices, _gatehouses, tenantId, deviceId, ct);
        if (device is null || reason is not null)
        {
            return new VirtualDoorReadiness(
                Ready: false,
                Reason: reason,
                Vendor: device?.Vendor ?? string.Empty,
                GatehouseId: device?.GatehouseId,
                GatehouseName: null);
        }

        // Device checks first, then the tenant flag: with DoorIntegration
        // disabled every presentation would end in tenant_flag_off, so the
        // readiness verdict must reflect that up front.
        if (!await _tenantFlagLookup.IsEnabledAsync(tenantId, ct))
        {
            return new VirtualDoorReadiness(
                Ready: false,
                Reason: "door_integration_disabled",
                Vendor: device.Vendor,
                GatehouseId: device.GatehouseId,
                GatehouseName: null);
        }

        var gatehouseName = await _gatehouses.GetNameAsync(tenantId, device.GatehouseId!.Value, ct);
        return new VirtualDoorReadiness(
            Ready: true,
            Reason: null,
            Vendor: device.Vendor,
            GatehouseId: device.GatehouseId,
            GatehouseName: gatehouseName);
    }
}