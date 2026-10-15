using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Application.Errors;
using ControlEasyReborn.Modules.Devices.Application.Handlers;
using ControlEasyReborn.Modules.Devices.Application.Validators;
using ControlEasyReborn.Modules.Devices.Domain.Entities;
using FluentAssertions;
using NSubstitute;
using Xunit;
using ValidationException = ControlEasyReborn.Modules.Devices.Application.Errors.ValidationException;

namespace ControlEasyReborn.UnitTests.Modules.Devices;

// Per-device Configure flow — persisted heartbeat thresholds. The validator
// keeps the DeviceHeartbeat entity's InvalidOperationException invariants
// unreachable (a 500 instead of a 400 would be a regression).
public sealed class SetDeviceThresholdsHandlerTests
{
    private readonly IDeviceRepository _devices = Substitute.For<IDeviceRepository>();
    private readonly IDeviceHeartbeatRepository _heartbeats = Substitute.For<IDeviceHeartbeatRepository>();
    private readonly UpdateDeviceThresholdsValidator _validator = new();

    private SetDeviceThresholdsHandler CreateSut() =>
        new(_devices, _heartbeats, _validator);

    private static Device SyntheticDevice(Guid tenantId, Guid deviceId, bool removed = false) =>
        new(
            deviceId,
            tenantId,
            "reader",
            "ControlEasy simulator",
            [1],
            null,
            !removed,
            Guid.NewGuid(),
            DateTime.UtcNow,
            removedAtUtc: removed ? DateTime.UtcNow : null);

    [Fact]
    public async Task InvalidOfflineAfterSeconds_ThrowsValidationException_AndNeverTouchesRepos()
    {
        var tenantId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();

        var act = async () => await CreateSut().HandleAsync(
            tenantId, deviceId, new UpdateDeviceThresholdsRequest(0, 10m), CancellationToken.None);

        (await act.Should().ThrowAsync<ValidationException>())
            .Which.Errors.Should().ContainKey("OfflineAfterSeconds");
        await _devices.DidNotReceive().GetByIdAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await _heartbeats.DidNotReceive().SetThresholdsAsync(
            Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<int>(), Arg.Any<decimal>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task PercentAbove100_ThrowsValidationException_AndNeverTouchesRepos()
    {
        var tenantId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();

        var act = async () => await CreateSut().HandleAsync(
            tenantId, deviceId, new UpdateDeviceThresholdsRequest(60, 120m), CancellationToken.None);

        (await act.Should().ThrowAsync<ValidationException>())
            .Which.Errors.Should().ContainKey("ErrorRateThresholdPercent");
        await _heartbeats.DidNotReceive().SetThresholdsAsync(
            Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<int>(), Arg.Any<decimal>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UnknownDevice_ThrowsNotFoundException_AndNeverWrites()
    {
        var tenantId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();
        _devices.GetByIdAsync(tenantId, deviceId, Arg.Any<CancellationToken>())
            .Returns((Device?)null);

        var act = async () => await CreateSut().HandleAsync(
            tenantId, deviceId, new UpdateDeviceThresholdsRequest(60, 10m), CancellationToken.None);

        (await act.Should().ThrowAsync<NotFoundException>())
            .Which.Message.Should().Contain(deviceId.ToString());
        await _heartbeats.DidNotReceive().SetThresholdsAsync(
            Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<int>(), Arg.Any<decimal>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RemovedDevice_ThrowsNotFoundException_AndNeverWrites()
    {
        var tenantId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();
        _devices.GetByIdAsync(tenantId, deviceId, Arg.Any<CancellationToken>())
            .Returns(SyntheticDevice(tenantId, deviceId, removed: true));

        var act = async () => await CreateSut().HandleAsync(
            tenantId, deviceId, new UpdateDeviceThresholdsRequest(60, 10m), CancellationToken.None);

        (await act.Should().ThrowAsync<NotFoundException>()).Which.Message.Should().Contain(deviceId.ToString());
        await _heartbeats.DidNotReceive().SetThresholdsAsync(
            Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<int>(), Arg.Any<decimal>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ValidRequest_PersistsTenantScopedThresholds_AndReturnsDto()
    {
        var tenantId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();
        _devices.GetByIdAsync(tenantId, deviceId, Arg.Any<CancellationToken>())
            .Returns(SyntheticDevice(tenantId, deviceId));

        var dto = await CreateSut().HandleAsync(
            tenantId, deviceId, new UpdateDeviceThresholdsRequest(300, 12.5m), CancellationToken.None);

        dto.DeviceId.Should().Be(deviceId);
        dto.OfflineAfterSeconds.Should().Be(300);
        dto.ErrorRateThresholdPercent.Should().Be(12.5m);

        await _heartbeats.Received(1).SetThresholdsAsync(
            tenantId, deviceId, 300, 12.5m, Arg.Any<CancellationToken>());
    }

    // ErrorRateThresholdPercent is DECIMAL(5,2) on device_heartbeats: a
    // request percent with more than 2 decimals (e.g. 12.345) passes
    // validation and would otherwise be rounded by MySQL on store while the
    // 200 body echoed the un-rounded value. The handler rounds to the stored
    // scale (AwayFromZero) BEFORE persisting and echoes the rounded value.
    [Fact]
    public async Task PercentWithMoreThanTwoDecimals_IsRoundedToStoredScale_BeforePersistAndEcho()
    {
        var tenantId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();
        _devices.GetByIdAsync(tenantId, deviceId, Arg.Any<CancellationToken>())
            .Returns(SyntheticDevice(tenantId, deviceId));

        var dto = await CreateSut().HandleAsync(
            tenantId, deviceId, new UpdateDeviceThresholdsRequest(60, 12.345m), CancellationToken.None);

        dto.ErrorRateThresholdPercent.Should().Be(12.35m);

        await _heartbeats.Received(1).SetThresholdsAsync(
            tenantId, deviceId, 60, 12.35m, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task PercentRounding_UsesAwayFromZero()
    {
        var tenantId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();
        _devices.GetByIdAsync(tenantId, deviceId, Arg.Any<CancellationToken>())
            .Returns(SyntheticDevice(tenantId, deviceId));

        var dto = await CreateSut().HandleAsync(
            tenantId, deviceId, new UpdateDeviceThresholdsRequest(60, 10.005m), CancellationToken.None);

        dto.ErrorRateThresholdPercent.Should().Be(10.01m);
    }
}