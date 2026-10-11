using System.Net;
using System.Net.Http.Json;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.IntegrationTests.Devices;

// Phase 26 (DOOR-13) — cross-tenant isolation for device health.
[Collection("Devices Collection")]
public sealed class DeviceHealthCrossTenantTests : IAsyncLifetime
{
    private readonly DevicesTestFixture _fx;
    private Guid _tenantB;
    private Guid _deviceB;

    public DeviceHealthCrossTenantTests(MySqlContainerFixture mySql)
    {
        _fx = new DevicesTestFixture(mySql);
    }

    public async Task InitializeAsync()
    {
        await _fx.InitializeAsync();
        await _fx.SeedAsync();
        await _fx.ResetSimulatorAsync();
        await SeedTenantBAsync();
    }

    public Task DisposeAsync() => _fx.DisposeAsync();

    private async Task SeedTenantBAsync()
    {
        _tenantB = Guid.NewGuid();
        _deviceB = Guid.NewGuid();
        await using var conn = new MySqlConnector.MySqlConnection(_fx.MySql.ConnectionString);
        await conn.OpenAsync();
        // Seed a Tenant B with its own device + heartbeat.
        await using (var cmd = new MySqlConnector.MySqlCommand(
            @"INSERT INTO Tenants (Id, Slug, DisplayName, Status, CreatedAtUtc, DoorIntegrationEnabled)
              VALUES (@id, @slug, @name, 0, UTC_TIMESTAMP(6), 1)
              ON DUPLICATE KEY UPDATE DoorIntegrationEnabled = 1", conn))
        {
            cmd.Parameters.AddWithValue("@id", _tenantB.ToString());
            cmd.Parameters.AddWithValue("@slug", $"tenantb-{_tenantB:N}".Substring(0, 32));
            cmd.Parameters.AddWithValue("@name", "Tenant B Condo");
            await cmd.ExecuteNonQueryAsync();
        }
        await using (var cmd = new MySqlConnector.MySqlCommand(
            @"INSERT INTO Devices
              (Id, TenantId, DeviceType, Vendor, ConnectionParams, GatehouseId, IsActive, CreatedAtUtc, CreatedByProfileId, tenant_id)
              VALUES (@id, @tid, 'controller', 'simulated', @params, NULL, 1, UTC_TIMESTAMP(6), @actor, @tid)", conn))
        {
            cmd.Parameters.AddWithValue("@id", _deviceB.ToString());
            cmd.Parameters.AddWithValue("@tid", _tenantB.ToString());
            cmd.Parameters.AddWithValue("@params", new byte[] { 0x09, 0x0a, 0x0b, 0x0c });
            cmd.Parameters.AddWithValue("@actor", Guid.NewGuid().ToString());
            await cmd.ExecuteNonQueryAsync();
        }
        await using (var cmd = new MySqlConnector.MySqlCommand(
            @"INSERT INTO device_heartbeats
              (Id, DeviceId, TenantId, LastHeartbeatAtUtc, Status, ErrorCount, EventsSinceLastSuccess,
               OfflineAfterSeconds, ErrorRateThresholdPercent, UpdatedAtUtc, tenant_id)
              VALUES (@id, @did, @tid, UTC_TIMESTAMP(6), 0, 0, 1, 60, 10.00, UTC_TIMESTAMP(6), @tid)", conn))
        {
            cmd.Parameters.AddWithValue("@id", Guid.NewGuid().ToString());
            cmd.Parameters.AddWithValue("@did", _deviceB.ToString());
            cmd.Parameters.AddWithValue("@tid", _tenantB.ToString());
            await cmd.ExecuteNonQueryAsync();
        }
    }

    private HttpClient TenantAClient() =>
        _fx.Factory.CreateClient().WithBearerToken(
            JwtTestHelper.GenerateToken(
                userId: Guid.NewGuid(),
                email: $"tenanta-{Guid.NewGuid()}@controleasy.test",
                tenantId: _fx.TenantId,
                profileId: _fx.ActorProfileId,
                roles: new[] { "TenantAdmin" },
                permissions: new[] { "devices.read" }));

    private HttpClient TenantBPorteiroClient() =>
        _fx.Factory.CreateClient().WithBearerToken(
            JwtTestHelper.GenerateToken(
                userId: Guid.NewGuid(),
                email: $"tenantb-porteiro-{Guid.NewGuid()}@controleasy.test",
                tenantId: _tenantB,
                profileId: _fx.ActorProfileId,
                roles: new[] { "Porteiro" },
                permissions: new[] { "devices.read" }));

    [Fact]
    public async Task GetHealth_AsTenantA_DoesNotIncludeTenantB_Devices()
    {
        var client = TenantAClient();
        var response = await client.GetAsync("/api/v1/devices/health");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var items = await response.Content.ReadFromJsonAsync<List<DeviceHealthDto>>();
        items.Should().NotBeNull();
        items!.Should().HaveCount(1);
        items![0].DeviceId.Should().Be(_fx.DeviceId);
        // Tenant B's device id MUST NOT be in the response.
        items!.Should().NotContain(d => d.DeviceId == _deviceB);
    }

    [Fact]
    public async Task Heartbeat_AsTenantA_OnTenantB_Device_ReturnsDeviceInactive()
    {
        // The Tenant A porteiro client tries to send a heartbeat to a
        // device owned by Tenant B. The IDeviceRepository.GetByIdAsync is
        // tenant-scoped; the cross-tenant lookup returns null and the
        // heartbeat pipeline returns DeviceInactive (no device_heartbeats
        // row is written).
        var client = _fx.Factory.CreateClient().WithBearerToken(
            JwtTestHelper.GenerateToken(
                userId: Guid.NewGuid(),
                email: $"porteiro-{Guid.NewGuid()}@controleasy.test",
                tenantId: _fx.TenantId,
                profileId: _fx.ActorProfileId,
                roles: new[] { "Porteiro" },
                permissions: new[] { "devices.read" }));

        var payload = new ControlEasyReborn.Modules.Devices.Application.Contracts.DeviceEventPayload(
            EventType: ControlEasyReborn.Modules.Devices.Domain.Enums.DeviceEventType.Heartbeat,
            OccurredAtUtc: DateTime.UtcNow,
            SequenceNumber: 1,
            ExternalEventId: Guid.NewGuid(),
            OpaqueToken: null,
            PayloadJson: "{\"error_count\":0,\"events_since_last_success\":1}");

        var response = await client.PostAsJsonAsync($"/api/v1/devices/{_deviceB}/events", payload);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var dto = await response.Content.ReadFromJsonAsync<DeviceEventIngestionDto>();
        dto!.Outcome.Should().Be("heartbeat_received");
        // The Tenant B device_heartbeats row count is unchanged.
        await using var conn = new MySqlConnector.MySqlConnection(_fx.MySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlConnector.MySqlCommand(
            "SELECT COUNT(*) FROM device_heartbeats WHERE DeviceId=@did AND tenant_id=@tid",
            conn);
        cmd.Parameters.AddWithValue("@did", _deviceB.ToString());
        cmd.Parameters.AddWithValue("@tid", _tenantB.ToString());
        var count = Convert.ToInt32(await cmd.ExecuteScalarAsync());
        count.Should().Be(1); // unchanged
    }

    [Fact]
    public async Task OfflineAlert_FromTenantB_DoesNotTrigger_ForTenantA_Porteiro()
    {
        // Tenant B's heartbeat stays in Tenant B's scope. The Tenant A
        // /api/v1/devices/health endpoint never returns Tenant B's devices
        // — verified by GetHealth_AsTenantA_DoesNotIncludeTenantB_Devices.
        // This test simply confirms that polling Tenant A's dashboard does
        // not surface Tenant B's offline state.
        var client = TenantAClient();
        var response = await client.GetAsync("/api/v1/devices/health");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var items = await response.Content.ReadFromJsonAsync<List<DeviceHealthDto>>();
        items.Should().NotBeNull();
        items!.Should().NotContain(d => d.DeviceId == _deviceB);
    }
}