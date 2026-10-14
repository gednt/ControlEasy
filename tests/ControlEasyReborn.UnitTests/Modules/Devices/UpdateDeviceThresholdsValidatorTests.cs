using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Application.Validators;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.Devices;

public sealed class UpdateDeviceThresholdsValidatorTests
{
    private readonly UpdateDeviceThresholdsValidator _sut = new();

    private static UpdateDeviceThresholdsRequest ValidRequest() => new(
        OfflineAfterSeconds: 60,
        ErrorRateThresholdPercent: 10.00m);

    [Fact]
    public async Task ValidRequest_Passes()
    {
        var result = await _sut.ValidateAsync(ValidRequest());
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task MinimumBounds_Pass()
    {
        var req = ValidRequest() with { OfflineAfterSeconds = 1, ErrorRateThresholdPercent = 0m };
        var result = await _sut.ValidateAsync(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task MaximumPercent_Passes()
    {
        var req = ValidRequest() with { ErrorRateThresholdPercent = 100m };
        var result = await _sut.ValidateAsync(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task DecimalPercent_Passes()
    {
        var req = ValidRequest() with { ErrorRateThresholdPercent = 12.5m };
        var result = await _sut.ValidateAsync(req);
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task ZeroOfflineAfterSeconds_Fails()
    {
        var req = ValidRequest() with { OfflineAfterSeconds = 0 };
        var result = await _sut.ValidateAsync(req);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "OfflineAfterSeconds");
    }

    [Fact]
    public async Task NegativeOfflineAfterSeconds_Fails()
    {
        var req = ValidRequest() with { OfflineAfterSeconds = -5 };
        var result = await _sut.ValidateAsync(req);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "OfflineAfterSeconds");
    }

    [Fact]
    public async Task PercentAbove100_Fails()
    {
        var req = ValidRequest() with { ErrorRateThresholdPercent = 120m };
        var result = await _sut.ValidateAsync(req);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "ErrorRateThresholdPercent");
    }

    [Fact]
    public async Task NegativePercent_Fails()
    {
        var req = ValidRequest() with { ErrorRateThresholdPercent = -0.5m };
        var result = await _sut.ValidateAsync(req);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "ErrorRateThresholdPercent");
    }
}