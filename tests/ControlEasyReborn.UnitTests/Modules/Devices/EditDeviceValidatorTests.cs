using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Application.Validators;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.Devices;

// EditDeviceValidator gatehouse semantics (EditDeviceRequest contract):
// null = leave the binding unchanged, Guid.Empty = clear the binding ("No
// binding" in the Configure dialog), any other value = rebind (existence +
// tenant + active checks live in EditDeviceHandler).
public sealed class EditDeviceValidatorTests
{
    [Fact]
    public async Task EditDeviceValidator_EmptyGatehouseId_IsAcceptedAsUnbindMarker()
    {
        var validator = new EditDeviceValidator();
        var request = new EditDeviceRequest(
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
        var request = new EditDeviceRequest(
            Vendor: "ControlEasy simulator",
            GatehouseId: null,
            ConnectionParams: null);

        var result = await validator.ValidateAsync(request);

        result.IsValid.Should().BeTrue();
    }
}