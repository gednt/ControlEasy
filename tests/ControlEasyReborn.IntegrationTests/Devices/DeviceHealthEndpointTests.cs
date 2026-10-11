using System.Net;
using System.Net.Http.Json;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.IntegrationTests.Devices;

// Phase 26 (DOOR-13) — GET /api/v1/devices/health endpoint integration tests.
[Collection("Devices Collection")]
public sealed class DeviceHealthEndpointTests : IAsyncLifetime
{
    private readonly DevicesTestFixture _fx;

    public DeviceHealthEndpointTests(MySqlContainerFixture mySql)
    {
        _fx = new DevicesTestFixture(mySql);
    }

    public async Task InitializeAsync()
    {
        await _fx.InitializeAsync();
        await _fx.SeedAsync();
        await _fx.ResetSimulatorAsync();
    }

    public Task DisposeAsync() => _fx.DisposeAsync();

    private HttpClient TenantAdminClient() =>
        _fx.Factory.CreateClient().WithBearerToken(
            JwtTestHelper.GenerateToken(
                userId: Guid.NewGuid(),
                email: $"tenantadmin-{Guid.NewGuid()}@controleasy.test",
                tenantId: _fx.TenantId,
                profileId: _fx.ActorProfileId,
                roles: new[] { "TenantAdmin" },
                permissions: new[] { "devices.read" }));

    private HttpClient PorteiroClient() =>
        _fx.Factory.CreateClient().WithBearerToken(
            JwtTestHelper.GenerateToken(
                userId: Guid.NewGuid(),
                email: $"porteiro-{Guid.NewGuid()}@controleasy.test",
                tenantId: _fx.TenantId,
                profileId: _fx.ActorProfileId,
                roles: new[] { "Porteiro" },
                permissions: new[] { "devices.read" }));

    [Fact]
    public async Task GetHealth_AsTenantAdmin_ReturnsAllTenantDevices()
    {
        // Seed two extra devices with mixed statuses.
        var d2 = Guid.NewGuid();
        var d3 = Guid.NewGuid();
        await _fx.SeedSecondDeviceAsync(newDeviceId: d2, vendor: "Intelbras");
        await _fx.SeedSecondDeviceAsync(newDeviceId: d3, vendor: "Control iD");

        // d1 (original) -> Online (default), d2 -> Offline, d3 -> Degraded.
        await _fx.SeedHeartbeatRowAsync(_fx.DeviceId, DateTime.UtcNow.AddSeconds(-2), (int)DeviceStatus.Online);
        await _fx.SeedHeartbeatRowAsync(d2, DateTime.UtcNow.AddSeconds(-90), (int)DeviceStatus.Offline);
        await _fx.SeedHeartbeatRowAsync(d3, DateTime.UtcNow.AddSeconds(-2), (int)DeviceStatus.Degraded);

        var client = TenantAdminClient();
        var response = await client.GetAsync("/api/v1/devices/health");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var items = await response.Content.ReadFromJsonAsync<List<DeviceHealthDto>>();
        items.Should().NotBeNull();
        items!.Should().HaveCount(3);

        var byId = items.ToDictionary(d => d.DeviceId);
        byId[_fx.DeviceId].Status.Should().Be(DeviceStatus.Online);
        byId[_fx.DeviceId].IsOfflineExceeded.Should().BeFalse();

        byId[d2].Status.Should().Be(DeviceStatus.Offline);
        byId[d2].IsOfflineExceeded.Should().BeTrue();

        byId[d3].Status.Should().Be(DeviceStatus.Degraded);
        byId[d3].IsOfflineExceeded.Should().BeFalse();
    }

    [Fact]
    public async Task GetHealth_AsPorteiro_Returns200()
    {
        var client = PorteiroClient();
        var response = await client.GetAsync("/api/v1/devices/health");
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetHealth_DevicesWithoutHeartbeats_AppearAsOffline()
    {
        // The original device has no heartbeat row seeded.
        var client = TenantAdminClient();
        var response = await client.GetAsync("/api/v1/devices/health");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var items = await response.Content.ReadFromJsonAsync<List<DeviceHealthDto>>();
        items.Should().NotBeNull();
        items!.Should().HaveCount(1);

        var onlyRow = items![0];
        onlyRow.DeviceId.Should().Be(_fx.DeviceId);
        onlyRow.Status.Should().Be(DeviceStatus.Offline);
        onlyRow.LastHeartbeatAtUtc.Should().BeNull();
        onlyRow.IsOfflineExceeded.Should().BeTrue();
    }

    [Fact]
    public async Task GetHealth_OnRemovedDevice_ExcludesRemoved()
    {
        // Soft-delete the device.
        await _fx.SoftDeleteDeviceAsync();

        var client = TenantAdminClient();
        var response = await client.GetAsync("/api/v1/devices/health");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var items = await response.Content.ReadFromJsonAsync<List<DeviceHealthDto>>();
        items.Should().NotBeNull();
        // The deleted device is filtered out by IDeviceRepository.ListAsync.
        items!.Should().BeEmpty();

        // Re-activate for subsequent tests.
        await using var conn = new MySqlConnector.MySqlConnection(_fx.MySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlConnector.MySqlCommand(
            "UPDATE Devices SET IsActive=1, RemovedAtUtc=NULL WHERE Id=@id", conn);
        cmd.Parameters.AddWithValue("@id", _fx.DeviceId.ToString());
        await cmd.ExecuteNonQueryAsync();
    }
}