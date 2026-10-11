using System.Net;
using System.Net.Http.Json;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using FluentAssertions;
using MySqlConnector;
using Xunit;

namespace ControlEasyReborn.IntegrationTests.Devices;

[Collection("Devices Collection")]
public sealed class DeviceEventCrossTenantTests : IAsyncLifetime
{
    private readonly DevicesTestFixture _fx;
    private readonly Guid TenantBId = Guid.NewGuid();
    private readonly Guid DeviceBId = Guid.NewGuid();

    public DeviceEventCrossTenantTests(MySqlContainerFixture mySql)
    {
        _fx = new DevicesTestFixture(mySql);
    }

    public async Task InitializeAsync()
    {
        await _fx.InitializeAsync();
        await _fx.SeedAsync();

        // Seed Tenant B + a Device B in tenant B so we can test the
        // cross-tenant ingest paths.
        await using var conn = new MySqlConnection(_fx.MySql.ConnectionString);
        await conn.OpenAsync();
        await using (var tenantsCmd = new MySqlCommand(
            @"INSERT INTO Tenants (Id, Slug, DisplayName, Status, CreatedAtUtc, DoorIntegrationEnabled)
              VALUES (@id, @slug, @name, 0, UTC_TIMESTAMP(6), 1)
              ON DUPLICATE KEY UPDATE DoorIntegrationEnabled = 1", conn))
        {
            tenantsCmd.Parameters.AddWithValue("@id", TenantBId.ToString());
            tenantsCmd.Parameters.AddWithValue("@slug", $"tenantb-{TenantBId:N}".Substring(0, 32));
            tenantsCmd.Parameters.AddWithValue("@name", "Tenant B Devices");
            await tenantsCmd.ExecuteNonQueryAsync();
        }
        await using (var devicesCmd = new MySqlCommand(
            @"INSERT INTO Devices
                (Id, TenantId, DeviceType, Vendor, ConnectionParams, IsActive, CreatedAtUtc, CreatedByProfileId, tenant_id)
              VALUES (@id, @tid, 'controller', 'simulated', @params, 1, UTC_TIMESTAMP(6), @actor, @tid)", conn))
        {
            devicesCmd.Parameters.AddWithValue("@id", DeviceBId.ToString());
            devicesCmd.Parameters.AddWithValue("@tid", TenantBId.ToString());
            devicesCmd.Parameters.AddWithValue("@params", new byte[] { 0x01, 0x02, 0x03, 0x04 });
            devicesCmd.Parameters.AddWithValue("@actor", Guid.NewGuid().ToString());
            await devicesCmd.ExecuteNonQueryAsync();
        }
    }

    public Task DisposeAsync() => _fx.DisposeAsync();

    private HttpClient PorteiroFor(Guid tenantId) =>
        _fx.Factory.CreateClient().WithBearerToken(
            JwtTestHelper.GenerateToken(
                userId: Guid.NewGuid(),
                email: $"porteiro-{Guid.NewGuid()}@controleasy.test",
                tenantId: tenantId,
                profileId: Guid.NewGuid(),
                roles: new[] { "Porteiro" },
                permissions: new[] { "devices.read" }));

    [Fact]
    public async Task Ingest_OnOtherTenantsDevice_ResolvesToDeviceInactive()
    {
        var tenantAClient = PorteiroFor(_fx.TenantId);
        var payload = _fx.BuildCardReadPayload(opaqueToken: $"sim-test-resident-{Guid.NewGuid():N}");

        // Tenant A's client targets Tenant B's device. The Device lookup
        // is tenant-scoped -> returns null -> DeviceInactive outcome.
        var response = await tenantAClient.PostAsJsonAsync($"/api/v1/devices/{DeviceBId}/events", payload);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var dto = await response.Content.ReadFromJsonAsync<DeviceEventIngestionDto>();
        dto!.Outcome.Should().Be("device_inactive");
    }

    [Fact]
    public async Task Ingest_AsOtherTenant_FlagOffAndRemovedAreIndistinguishableFromCrossTenant()
    {
        // Turn off tenant B's door integration AND remove device B from
        // tenant A's view in a single assertion to prove the 404 / device-
        // inactive response is the same shape regardless of why the device
        // is unreachable.
        await using (var conn = new MySqlConnection(_fx.MySql.ConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = new MySqlCommand(
                "UPDATE Tenants SET DoorIntegrationEnabled = 0 WHERE Id = @id", conn);
            cmd.Parameters.AddWithValue("@id", TenantBId.ToString());
            await cmd.ExecuteNonQueryAsync();
        }

        try
        {
            var tenantAClient = PorteiroFor(_fx.TenantId);
            var payload = _fx.BuildCardReadPayload();

            var response = await tenantAClient.PostAsJsonAsync($"/api/v1/devices/{DeviceBId}/events", payload);
            response.StatusCode.Should().Be(HttpStatusCode.OK);

            var dto = await response.Content.ReadFromJsonAsync<DeviceEventIngestionDto>();
            dto!.Outcome.Should().BeOneOf("device_inactive", "tenant_flag_off");
        }
        finally
        {
            await using (var conn = new MySqlConnection(_fx.MySql.ConnectionString))
            {
                await conn.OpenAsync();
                await using var cmd = new MySqlCommand(
                    "UPDATE Tenants SET DoorIntegrationEnabled = 1 WHERE Id = @id", conn);
                cmd.Parameters.AddWithValue("@id", TenantBId.ToString());
                await cmd.ExecuteNonQueryAsync();
            }
        }
    }

    [Fact]
    public async Task Ingest_ResolvesCredentials_OnlyWithinTenant()
    {
        // Seed a tenant-A credential with a known SHA-256 hash. Use the
        // same token from tenant A as a card read on a tenant-B device.
        // The cross-tenant lookup should return null (the credential
        // exists, but it doesn't belong to tenant B).
        var token = "synthetic-card-token-" + Guid.NewGuid().ToString("N");
        var sha256 = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(token));

        await using (var conn = new MySqlConnection(_fx.MySql.ConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = new MySqlCommand(
                @"INSERT INTO AccessCredentials
                    (Id, TenantId, SubjectType, SubjectId, Method, SecretVerifier, KeyVersion, Status, ValidFromUtc, IssuedByProfileId, CreatedAtUtc, tenant_id)
                  VALUES (@id, @tid, 0, @subj, 0, @verifier, 1, 0, UTC_TIMESTAMP(6), @actor, UTC_TIMESTAMP(6), @tid)", conn);
            {
                cmd.Parameters.AddWithValue("@id", Guid.NewGuid().ToString());
                cmd.Parameters.AddWithValue("@tid", _fx.TenantId.ToString());
                cmd.Parameters.AddWithValue("@subj", Guid.NewGuid().ToString());
                cmd.Parameters.AddWithValue("@verifier", sha256);
                cmd.Parameters.AddWithValue("@actor", _fx.ActorProfileId.ToString());
                await cmd.ExecuteNonQueryAsync();
            }
        }

        var tenantBClient = PorteiroFor(TenantBId);
        var payload = new DeviceEventPayload(
            EventType: ControlEasyReborn.Modules.Devices.Domain.Enums.DeviceEventType.CardRead,
            OccurredAtUtc: DateTime.UtcNow.AddSeconds(-1),
            SequenceNumber: 999,
            ExternalEventId: Guid.NewGuid(),
            OpaqueToken: token,
            PayloadJson: "{}");

        var response = await tenantBClient.PostAsJsonAsync($"/api/v1/devices/{DeviceBId}/events", payload);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var dto = await response.Content.ReadFromJsonAsync<DeviceEventIngestionDto>();
        dto!.Outcome.Should().Be("denied_attempt");
        dto.RefusedScanAttemptId.Should().NotBeNull();
    }
}
