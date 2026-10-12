using ControlEasyReborn.Modules.Security.Application.Contracts;
using ControlEasyReborn.Modules.Security.Application.Validators;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.Security;

public sealed class GatehouseRequestValidatorTests
{
    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Update_rejects_blank_name(string name)
    {
        var result = await new UpdateGatehouseRequestValidator()
            .ValidateAsync(new UpdateGatehouseRequest(name, null));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(error => error.PropertyName == nameof(UpdateGatehouseRequest.Name));
    }

    [Fact]
    public async Task Create_and_update_share_trimmed_length_limits()
    {
        var validName = $" {new string('N', 120)} ";
        var invalidLocation = $" {new string('L', 501)} ";

        var createResult = await new CreateGatehouseRequestValidator()
            .ValidateAsync(new CreateGatehouseRequest(validName, invalidLocation));
        var updateResult = await new UpdateGatehouseRequestValidator()
            .ValidateAsync(new UpdateGatehouseRequest(validName, invalidLocation));

        createResult.Errors.Should().ContainSingle(error => error.PropertyName == nameof(CreateGatehouseRequest.Location));
        updateResult.Errors.Should().ContainSingle(error => error.PropertyName == nameof(UpdateGatehouseRequest.Location));
    }

    [Fact]
    public async Task Create_and_update_reject_name_over_120_characters()
    {
        var invalidName = new string('N', 121);

        var createResult = await new CreateGatehouseRequestValidator()
            .ValidateAsync(new CreateGatehouseRequest(invalidName, null));
        var updateResult = await new UpdateGatehouseRequestValidator()
            .ValidateAsync(new UpdateGatehouseRequest(invalidName, null));

        createResult.Errors.Should().ContainSingle(error => error.PropertyName == nameof(CreateGatehouseRequest.Name));
        updateResult.Errors.Should().ContainSingle(error => error.PropertyName == nameof(UpdateGatehouseRequest.Name));
    }
}
