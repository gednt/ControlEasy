using ControlEasyReborn.Modules.Devices.Application.Errors;
using ControlEasyReborn.Modules.Devices.Application.Validators;
using ControlEasyReborn.Modules.Devices.Domain.Entities;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.Devices;

// Device.UpdateMetadata gatehouse semantics (EditDeviceRequest contract):
// null = leave the binding unchanged, Guid.Empty = clear the binding, any
// other value = rebind. The unbind path backs the Configure dialog's
// "No binding" option on /devices.
public sealed class DeviceEntityTests
{
    private static Device SyntheticDevice(Guid? gatehouseId = null) =>
        new(
            Guid.NewGuid(),
            Guid.NewGuid(),
            "reader",
            "ControlEasy simulator",
            [1],
            gatehouseId,
            true,
            Guid.NewGuid(),
            DateTime.UtcNow);

    [Fact]
    public void UpdateMetadata_EmptyGatehouseId_ClearsBinding()
    {
        var gatehouseId = Guid.NewGuid();
        var device = SyntheticDevice(gatehouseId);

        device.UpdateMetadata(vendor: null, gatehouseId: Guid.Empty);

        device.GatehouseId.Should().BeNull();
    }

    [Fact]
    public void UpdateMetadata_NullGatehouseId_KeepsBinding()
    {
        var gatehouseId = Guid.NewGuid();
        var device = SyntheticDevice(gatehouseId);

        device.UpdateMetadata(vendor: null, gatehouseId: null);

        device.GatehouseId.Should().Be(gatehouseId);
    }

    [Fact]
    public void UpdateMetadata_RealGatehouseId_Rebinds()
    {
        var device = SyntheticDevice(null);
        var newGatehouseId = Guid.NewGuid();

        device.UpdateMetadata(vendor: null, gatehouseId: newGatehouseId);

        device.GatehouseId.Should().Be(newGatehouseId);
    }

    [Fact]
    public async Task EditDeviceValidator_EmptyGatehouseId_IsAcceptedAsUnbindMarker()
    {
        var validator = new EditDeviceValidator();
        var request = new ControlEasyReborn.Modules.Devices.Application.Contracts.EditDeviceRequest(
            Vendor: null,
            GatehouseId: Guid.Empty,
            ConnectionParams: null);

        var result = await validator.ValidateAsync(request);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task EditDeviceValidator_VendorOnly_Passes()
    {
        var validator = new EditDeviceValidator();
        var request = new ControlEasyReborn.Modules.Devices.Application.Contracts.EditDeviceRequest(
            Vendor: "ControlEasy simulator",
            GatehouseId: null,
            ConnectionParams: null);

        var result = await validator.ValidateAsync(request);

        result.IsValid.Should().BeTrue();
    }
}