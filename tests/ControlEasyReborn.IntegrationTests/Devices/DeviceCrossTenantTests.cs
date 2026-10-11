using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using FluentAssertions;
using MySqlConnector;
using Xunit;

namespace ControlEasyReborn.IntegrationTests.Devices;

internal static class HttpClientPatchExtensions
{
    public static Task<HttpResponseMessage> PatchAsJsonAsync<T>(
        this HttpClient client, string requestUri, T payload)
    {
        var json = JsonSerializer.Serialize(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var request = new HttpRequestMessage(HttpMethod.Patch, requestUri) { Content = content };
        return client.SendAsync(request);
    }
}

[Collection("Devices Collection")]
public sealed class DeviceCrossTenantTests : IAsyncLifetime
{
    private readonly DevicesTestFixture _fx;
    private Guid TenantBId { get; } = Guid.NewGuid();

    public DeviceCrossTenantTests(MySqlContainerFixture mySql)
    {
        _fx = new DevicesTestFixture(mySql);
    }

    public async Task InitializeAsync()
    {
        await _fx.InitializeAsync();
        await _fx.SeedAsync();
        await _fx.ResetSimulatorAsync();

        await using var conn = new MySqlConnection(_fx.MySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            @"INSERT INTO Tenants (Id, Slug, DisplayName, Status, CreatedAtUtc, DoorIntegrationEnabled)
              VALUES (@id, @slug, @name, 0, UTC_TIMESTAMP(6), 1)
              ON DUPLICATE KEY UPDATE DoorIntegrationEnabled = 1", conn);
        cmd.Parameters.AddWithValue("@id", TenantBId.ToString());
        cmd.Parameters.AddWithValue("@slug", $"tenantb-{TenantBId:N}".Substring(0, 32));
        cmd.Parameters.AddWithValue("@name", "Tenant B Test");
        await cmd.ExecuteNonQueryAsync();
    }

    public Task DisposeAsync() => _fx.DisposeAsync();

    private HttpClient TenantAdminClientFor(Guid tenantId)
    {
        var client = _fx.Factory.CreateClient();
        var token = JwtTestHelper.GenerateToken(
            userId: Guid.NewGuid(),
            email: $"tenant-admin-{Guid.NewGuid()}@controleasy.test",
            tenantId: tenantId,
            profileId: _fx.ActorProfileId,
            roles: new[] { "TenantAdmin" },
            permissions: new[]
            {
                "devices.read", "devices.write", "tenants.toggle_door_integration",
                "devices.unlock"
            });

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    [Fact]
    public async Task RegisterDevice_WithOtherTenantGatehouse_Returns404()
    {
        var gatehouseId = Guid.NewGuid();
        await SeedGatehouseAsync(TenantBId, gatehouseId);

        var client = TenantAdminClientFor(_fx.TenantId);
        var req = new RegisterDeviceRequest(
            DeviceType: "reader",
            Vendor: "Generic",
            GatehouseId: gatehouseId,
            ConnectionParams: new Dictionary<string, object> { ["endpoint"] = "https://x" });

        var response = await client.PostAsJsonAsync("/api/v1/devices", req);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ListDevices_DoesNotReturnOtherTenantsDevices()
    {
        var gatehouseId = Guid.NewGuid();
        await SeedGatehouseAsync(_fx.TenantId, gatehouseId);
        await SeedGatehouseAsync(TenantBId, Guid.NewGuid());

        var clientA = TenantAdminClientFor(_fx.TenantId);
        var clientB = TenantAdminClientFor(TenantBId);

        var aReq = new RegisterDeviceRequest("reader", "Generic", gatehouseId,
            new Dictionary<string, object> { ["endpoint"] = "https://a" });
        var aReg = await clientA.PostAsJsonAsync("/api/v1/devices", aReq);
        aReg.StatusCode.Should().Be(HttpStatusCode.Created);

        var bReq = new RegisterDeviceRequest("reader", "Generic", null,
            new Dictionary<string, object> { ["endpoint"] = "https://b" });
        var bReg = await clientB.PostAsJsonAsync("/api/v1/devices", bReq);
        bReg.StatusCode.Should().Be(HttpStatusCode.Created);

        var aList = await clientA.GetAsync("/api/v1/devices");
        var aItems = await aList.Content.ReadFromJsonAsync<List<DeviceListItem>>();
        var bList = await clientB.GetAsync("/api/v1/devices");
        var bItems = await bList.Content.ReadFromJsonAsync<List<DeviceListItem>>();

        aItems.Should().NotBeNull();
        bItems.Should().NotBeNull();

        var aIds = aItems!.Select(d => d.Id).ToHashSet();
        var bIds = bItems!.Select(d => d.Id).ToHashSet();
        aIds.Intersect(bIds).Should().BeEmpty();
    }

    [Fact]
    public async Task EditDevice_AsOtherTenant_Returns404()
    {
        var gatehouseId = Guid.NewGuid();
        await SeedGatehouseAsync(_fx.TenantId, gatehouseId);

        var clientA = TenantAdminClientFor(_fx.TenantId);
        var req = new RegisterDeviceRequest("reader", "Generic", gatehouseId,
            new Dictionary<string, object> { ["endpoint"] = "https://a" });
        var reg = await clientA.PostAsJsonAsync("/api/v1/devices", req);
        var detail = await reg.Content.ReadFromJsonAsync<DeviceDetail>();
        var deviceId = detail!.Id;

        var clientB = TenantAdminClientFor(TenantBId);
        var edit = await clientB.PatchAsJsonAsync(
            $"/api/v1/devices/{deviceId}",
            new EditDeviceRequest(Vendor: "Hikvision", GatehouseId: null, ConnectionParams: null));
        edit.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task RemoveDevice_AsOtherTenant_Returns404()
    {
        var gatehouseId = Guid.NewGuid();
        await SeedGatehouseAsync(_fx.TenantId, gatehouseId);

        var clientA = TenantAdminClientFor(_fx.TenantId);
        var req = new RegisterDeviceRequest("reader", "Generic", gatehouseId,
            new Dictionary<string, object> { ["endpoint"] = "https://a" });
        var reg = await clientA.PostAsJsonAsync("/api/v1/devices", req);
        var detail = await reg.Content.ReadFromJsonAsync<DeviceDetail>();
        var deviceId = detail!.Id;

        var clientB = TenantAdminClientFor(TenantBId);
        var remove = await clientB.DeleteAsync($"/api/v1/devices/{deviceId}");
        remove.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ToggleDoorIntegration_AffectsOnlyOwnTenant()
    {
        var clientA = TenantAdminClientFor(_fx.TenantId);
        var clientB = TenantAdminClientFor(TenantBId);

        var aFlag = await clientA.PutAsJsonAsync(
            "/api/v1/tenants/current/door-integration",
            new ToggleDoorIntegrationRequest(true));
        aFlag.StatusCode.Should().Be(HttpStatusCode.OK);

        var bFlag = await clientB.GetAsync("/api/v1/tenants/current/door-integration");
        var bDto = await bFlag.Content.ReadFromJsonAsync<TenantDoorIntegrationDto>();
        // B's flag was seeded ON — should remain unchanged after A flipped its own flag.
        bDto!.DoorIntegrationEnabled.Should().BeTrue();

        var aGet = await clientA.GetAsync("/api/v1/tenants/current/door-integration");
        var aDto = await aGet.Content.ReadFromJsonAsync<TenantDoorIntegrationDto>();
        aDto!.DoorIntegrationEnabled.Should().BeTrue();
    }

    private async Task SeedGatehouseAsync(Guid tenantId, Guid gatehouseId)
    {
        await using var conn = new MySqlConnection(_fx.MySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            @"INSERT INTO Gatehouses (Id, TenantId, Name, tenant_id)
              VALUES (@id, @tid, @name, @tid)", conn);
        cmd.Parameters.AddWithValue("@id", gatehouseId.ToString());
        cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
        cmd.Parameters.AddWithValue("@name", "Test Gatehouse");
        await cmd.ExecuteNonQueryAsync();
    }
}