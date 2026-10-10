using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Application.Validators;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.Devices;

public sealed class UnlockDeviceValidatorTests
{
    private static DoorUnlockRequest ValidRequest() => new(
        Nonce: "AAAAAAAAAAAAAAAAAAAAAA",
        TimestampUtc: DateTime.UtcNow,
        Signature: "PDw-dummy-signature-value-here-padding",
        BodyHash: new string('a', 64));

    private readonly UnlockDeviceValidator _sut = new();

    [Fact]
    public async Task ValidRequest_Passes()
    {
        var result = await _sut.ValidateAsync(ValidRequest());
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task MissingNonce_Fails()
    {
        var req = ValidRequest() with { Nonce = "" };
        var result = await _sut.ValidateAsync(req);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Nonce");
    }

    [Fact]
    public async Task MalformedNonce_Fails()
    {
        var req = ValidRequest() with { Nonce = "!!!not-base64!!!" };
        var result = await _sut.ValidateAsync(req);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Nonce");
    }

    [Fact]
    public async Task FutureTimestamp_Fails()
    {
        var req = ValidRequest() with { TimestampUtc = DateTime.UtcNow.AddHours(1) };
        var result = await _sut.ValidateAsync(req);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "TimestampUtc");
    }

    [Fact]
    public async Task AncientTimestamp_Fails()
    {
        var req = ValidRequest() with { TimestampUtc = DateTime.UtcNow.AddMinutes(-15) };
        var result = await _sut.ValidateAsync(req);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "TimestampUtc");
    }

    [Fact]
    public async Task MissingSignature_Fails()
    {
        var req = ValidRequest() with { Signature = "" };
        var result = await _sut.ValidateAsync(req);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Signature");
    }

    [Fact]
    public async Task MalformedSignature_Fails()
    {
        var req = ValidRequest() with { Signature = "@@@" };
        var result = await _sut.ValidateAsync(req);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Signature");
    }

    [Fact]
    public async Task WrongLengthBodyHash_Fails()
    {
        var req = ValidRequest() with { BodyHash = new string('a', 32) };
        var result = await _sut.ValidateAsync(req);
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "BodyHash");
    }
}