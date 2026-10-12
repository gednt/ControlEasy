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
}
