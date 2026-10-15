using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Handlers;
using ControlEasyReborn.Modules.Devices.Domain.Entities;
using ControlEasyReborn.Modules.Devices.Domain.Enums;
using FluentAssertions;
using NSubstitute;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.Devices;

public sealed class ListDeviceHealthHandlerTests
{
    [Fact]
    public async Task HandleAsync_VirtualSimulatorWithoutHeartbeat_IsOnline()
    {
        var tenantId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();
        var devices = Substitute.For<IDeviceRepository>();
        var heartbeats = Substitute.For<IDeviceHeartbeatRepository>();
        var gatehouses = Substitute.For<IGatehouseLookup>();
        var device = new Device(
            deviceId,
            tenantId,
            "reader",
            "ControlEasy simulator",
            [1],
            null,
            true,
            Guid.NewGuid(),
            DateTime.UtcNow);
        devices.ListAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(new[] { device });
        heartbeats.ListAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<DeviceHeartbeat>());

        var sut = new ListDeviceHealthHandler(devices, heartbeats, gatehouses);

        var result = await sut.HandleAsync(tenantId, CancellationToken.None);

        result.Should().ContainSingle();
        result[0].DeviceId.Should().Be(deviceId);
        result[0].Status.Should().Be(DeviceStatus.Online);
        result[0].StatusLabel.Should().Be("Online");
        result[0].IsOfflineExceeded.Should().BeFalse();
        result[0].LastHeartbeatAtUtc.Should().BeNull();
    }

    // Per-device Configure sentinel: a heartbeat row stamped with the
    // 2000-01-01 sentinel means "thresholds configured but no real heartbeat
    // seen yet". The human-approved behavior for such rows is
    // truthful-Offline + last heartbeat "never" (DTO LastHeartbeatAtUtc=null)
    // while the configured thresholds surface. The Phase-26 branch that
    // shows a configured-less simulator WITHOUT any heartbeat row as
    // Online + never stays unchanged by that same decision (first test).
    [Fact]
    public async Task HandleAsync_SentinelNeverHeartbeatenRow_ShowsOfflineWithNeverHeartbeat()
    {
        var tenantId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();
        var devices = Substitute.For<IDeviceRepository>();
        var heartbeats = Substitute.For<IDeviceHeartbeatRepository>();
        var gatehouses = Substitute.For<IGatehouseLookup>();
        var device = new Device(
            deviceId,
            tenantId,
            "reader",
            "ControlEasy simulator",
            [1],
            null,
            true,
            Guid.NewGuid(),
            DateTime.UtcNow);

        var sentinelRow = new DeviceHeartbeat(
            id: Guid.NewGuid(),
            deviceId: deviceId,
            tenantId: tenantId,
            lastHeartbeatAtUtc: DeviceHeartbeat.SentinelLastHeartbeatAtUtc,
            status: DeviceStatus.Offline,
            errorCount: 0,
            eventsSinceLastSuccess: 0,
            offlineAfterSeconds: 300,
            errorRateThresholdPercent: 12.50m,
            updatedAtUtc: DateTime.UtcNow);

        devices.ListAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(new[] { device });
        heartbeats.ListAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(new[] { sentinelRow });

        var sut = new ListDeviceHealthHandler(devices, heartbeats, gatehouses);

        var result = await sut.HandleAsync(tenantId, CancellationToken.None);

        result.Should().ContainSingle();
        result[0].Status.Should().Be(DeviceStatus.Offline);
        result[0].StatusLabel.Should().Be("Offline");
        result[0].LastHeartbeatAtUtc.Should().BeNull();
        result[0].OfflineAfterSeconds.Should().Be(300);
        result[0].ErrorRateThresholdPercent.Should().Be(12.50m);
        result[0].ErrorCount.Should().Be(0);
        result[0].EventsSinceLastSuccess.Should().Be(0);
        result[0].IsOfflineExceeded.Should().BeTrue();
    }

    // A row with a REAL heartbeat timestamp must keep its timestamp on the DTO
    // (the sentinel mapping must not over-reach into normal rows).
    [Fact]
    public async Task HandleAsync_RealHeartbeatRow_KeepsTimestampValue()
    {
        var tenantId = Guid.NewGuid();
        var deviceId = Guid.NewGuid();
        var devices = Substitute.For<IDeviceRepository>();
        var heartbeats = Substitute.For<IDeviceHeartbeatRepository>();
        var gatehouses = Substitute.For<IGatehouseLookup>();
        var device = new Device(
            deviceId,
            tenantId,
            "reader",
            "Generic",
            [1],
            null,
            true,
            Guid.NewGuid(),
            DateTime.UtcNow);

        var lastSeen = DateTime.UtcNow.AddSeconds(-2);
        var row = new DeviceHeartbeat(
            id: Guid.NewGuid(),
            deviceId: deviceId,
            tenantId: tenantId,
            lastHeartbeatAtUtc: lastSeen,
            status: DeviceStatus.Online,
            errorCount: 0,
            eventsSinceLastSuccess: 10,
            offlineAfterSeconds: 60,
            errorRateThresholdPercent: 10.00m,
            updatedAtUtc: DateTime.UtcNow);

        devices.ListAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(new[] { device });
        heartbeats.ListAsync(tenantId, Arg.Any<CancellationToken>())
            .Returns(new[] { row });

        var sut = new ListDeviceHealthHandler(devices, heartbeats, gatehouses);

        var result = await sut.HandleAsync(tenantId, CancellationToken.None);

        result.Should().ContainSingle();
        result[0].LastHeartbeatAtUtc.Should().NotBeNull();
        result[0].Status.Should().Be(DeviceStatus.Online);
        result[0].OfflineAfterSeconds.Should().Be(60);
    }
}
