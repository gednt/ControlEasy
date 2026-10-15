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

[Collection("Devices Collection")]
public sealed class DeviceAdminEndpointTests : IAsyncLifetime
{
    private readonly DevicesTestFixture _fx;

    public DeviceAdminEndpointTests(MySqlContainerFixture mySql)
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

    private HttpClient CreateAdminClient(string[] roles, string[] permissions)
    {
        var client = _fx.Factory.CreateClient();
        var token = JwtTestHelper.GenerateToken(
            userId: Guid.NewGuid(),
            email: $"devices-admin-{Guid.NewGuid()}@controleasy.test",
            tenantId: _fx.TenantId,
            profileId: _fx.ActorProfileId,
            roles: roles,
            permissions: permissions);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private HttpClient TenantAdminClient() =>
        CreateAdminClient(new[] { "TenantAdmin" }, new[] { "devices.read", "devices.write", "tenants.toggle_door_integration" });

    private HttpClient TenantAdminWithoutWriteClient() =>
        CreateAdminClient(new[] { "TenantAdmin" }, new[] { "devices.read", "tenants.toggle_door_integration" });

    private HttpClient PorteiroClient() =>
        CreateAdminClient(new[] { "Porteiro" }, new[] { "devices.unlock" });

    private static HttpContent JsonBody(object payload) =>
        new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

    [Fact]
    public async Task ToggleDoorIntegration_AsTenantAdmin_ChangesFlag()
    {
        var client = TenantAdminClient();
        var response = await client.PutAsJsonAsync(
            "/api/v1/tenants/current/door-integration",
            new ToggleDoorIntegrationRequest(true));

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var get = await client.GetAsync("/api/v1/tenants/current/door-integration");
        get.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await get.Content.ReadFromJsonAsync<TenantDoorIntegrationDto>();
        dto.Should().NotBeNull();
        dto!.DoorIntegrationEnabled.Should().BeTrue();
    }

    [Fact]
    public async Task ToggleDoorIntegration_AsPorteiro_Returns403()
    {
        var client = PorteiroClient();
        var response = await client.PutAsJsonAsync(
            "/api/v1/tenants/current/door-integration",
            new ToggleDoorIntegrationRequest(true));
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task RegisterDevice_WithValidPayload_Returns201AndPersistsEncryptedParams()
    {
        var client = TenantAdminClient();

        var request = new RegisterDeviceRequest(
            DeviceType: "reader",
            Vendor: "Generic",
            GatehouseId: null,
            ConnectionParams: new Dictionary<string, object>
            {
                ["endpoint"] = "https://device.example.com/api",
                ["apiKey"] = "synthetic-redacted-key"
            });

        var response = await client.PostAsJsonAsync("/api/v1/devices", request);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var detail = await response.Content.ReadFromJsonAsync<DeviceDetail>();
        detail.Should().NotBeNull();
        detail!.Id.Should().NotBe(Guid.Empty);
        detail.ConnectionParams.Redacted.Should().BeTrue();
        detail.ConnectionParams.Last4.Should().NotBeNullOrEmpty();

        // Direct DB inspection — the stored ConnectionParams ciphertext must
        // NOT contain plaintext from the request body.
        await using var conn = new MySqlConnection(_fx.MySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "SELECT ConnectionParams FROM Devices WHERE Id = @id", conn);
        cmd.Parameters.AddWithValue("@id", detail.Id.ToString());
        var stored = (byte[]?)(await cmd.ExecuteScalarAsync());
        stored.Should().NotBeNull();
        var asString = Encoding.UTF8.GetString(stored);
        asString.Should().NotContain("endpoint");
        asString.Should().NotContain("synthetic-redacted-key");
        asString.Should().NotContain("https://device.example.com");
    }

    [Fact]
    public async Task ListDevices_AfterRegister_ReturnsDeviceWithoutPlaintextConnectionParams()
    {
        var client = TenantAdminClient();
        var req = new RegisterDeviceRequest(
            DeviceType: "controller",
            Vendor: "Control iD",
            GatehouseId: null,
            ConnectionParams: new Dictionary<string, object>
            {
                ["endpoint"] = "https://controller.example/api"
            });
        var register = await client.PostAsJsonAsync("/api/v1/devices", req);
        register.StatusCode.Should().Be(HttpStatusCode.Created);

        var list = await client.GetAsync("/api/v1/devices");
        list.StatusCode.Should().Be(HttpStatusCode.OK);
        var items = await list.Content.ReadFromJsonAsync<List<DeviceListItem>>();
        items.Should().NotBeNull();
        items!.Should().HaveCountGreaterThan(0);

        var detailResp = await client.GetAsync($"/api/v1/devices/{items![0].Id}");
        var detail = await detailResp.Content.ReadFromJsonAsync<DeviceDetail>();
        detail.Should().NotBeNull();
        detail!.ConnectionParams.Redacted.Should().BeTrue();
        detail.ConnectionParams.Last4.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task EditDevice_WithConnectionParams_RotatesCiphertext()
    {
        var client = TenantAdminClient();
        var req = new RegisterDeviceRequest(
            DeviceType: "reader",
            Vendor: "Generic",
            GatehouseId: null,
            ConnectionParams: new Dictionary<string, object> { ["endpoint"] = "https://first" });
        var register = await client.PostAsJsonAsync("/api/v1/devices", req);
        var detail = await register.Content.ReadFromJsonAsync<DeviceDetail>();
        var deviceId = detail!.Id;

        var firstBytes = await ReadConnectionParamsAsync(deviceId);

        var edit = await client.PatchAsJsonAsync(
            $"/api/v1/devices/{deviceId}",
            new EditDeviceRequest(
                Vendor: null,
                GatehouseId: null,
                ConnectionParams: new Dictionary<string, object> { ["endpoint"] = "https://rotated" }));
        edit.StatusCode.Should().Be(HttpStatusCode.OK);

        var secondBytes = await ReadConnectionParamsAsync(deviceId);
        secondBytes.Should().NotEqual(firstBytes);
    }

    [Fact]
    public async Task EditDevice_WithoutConnectionParams_KeepsCiphertext()
    {
        var client = TenantAdminClient();
        var req = new RegisterDeviceRequest(
            DeviceType: "reader",
            Vendor: "Generic",
            GatehouseId: null,
            ConnectionParams: new Dictionary<string, object> { ["endpoint"] = "https://stable" });
        var register = await client.PostAsJsonAsync("/api/v1/devices", req);
        var detail = await register.Content.ReadFromJsonAsync<DeviceDetail>();
        var deviceId = detail!.Id;

        var firstBytes = await ReadConnectionParamsAsync(deviceId);

        var edit = await client.PatchAsJsonAsync(
            $"/api/v1/devices/{deviceId}",
            new EditDeviceRequest(Vendor: "Hikvision", GatehouseId: null, ConnectionParams: null));
        edit.StatusCode.Should().Be(HttpStatusCode.OK);

        var secondBytes = await ReadConnectionParamsAsync(deviceId);
        secondBytes.Should().Equal(firstBytes);
    }

    // Configure-dialog unbind: GatehouseId=Guid.Empty is the documented
    // "clear the binding" marker (EditDeviceRequest contract comment). null
    // must keep the binding UNCHANGED — sending a vendor-only partial edit
    // that deserializes gatehouseId=null must never silently unbind.
    [Fact]
    public async Task EditDevice_EmptyGatehouseId_Unbinds_ButNullGatehouseId_KeepsBinding()
    {
        var client = TenantAdminClient();
        var req = new RegisterDeviceRequest(
            DeviceType: "reader",
            Vendor: "Generic",
            GatehouseId: _fx.GatehouseId,
            ConnectionParams: new Dictionary<string, object> { ["endpoint"] = "https://bind.example" });
        var register = await client.PostAsJsonAsync("/api/v1/devices", req);
        register.StatusCode.Should().Be(HttpStatusCode.Created);
        var registered = await register.Content.ReadFromJsonAsync<DeviceDetail>();
        var deviceId = registered!.Id;
        registered.GatehouseId.Should().Be(_fx.GatehouseId);

        // gatehouseId=null (absent from the JSON) → binding preserved.
        var keepEdit = await client.PatchAsJsonAsync(
            $"/api/v1/devices/{deviceId}",
            new EditDeviceRequest(Vendor: "Synthetic unchanged-gatehouse vendor", GatehouseId: null, ConnectionParams: null));
        keepEdit.StatusCode.Should().Be(HttpStatusCode.OK);
        var kept = await keepEdit.Content.ReadFromJsonAsync<DeviceDetail>();
        kept!.GatehouseId.Should().Be(_fx.GatehouseId);

        // gatehouseId=Guid.Empty ("No binding") → binding cleared.
        var unbind = await client.PatchAsJsonAsync(
            $"/api/v1/devices/{deviceId}",
            new EditDeviceRequest(Vendor: null, GatehouseId: Guid.Empty, ConnectionParams: null));
        unbind.StatusCode.Should().Be(HttpStatusCode.OK);
        var unbound = await unbind.Content.ReadFromJsonAsync<DeviceDetail>();
        unbound!.GatehouseId.Should().BeNull();
    }

    [Fact]
    public async Task InactiveGatehouse_BlocksNewBindingAndUnlock_ButAllowsUnchangedDeviceAssignment()
    {
        await using (var conn = new MySqlConnection(_fx.MySql.ConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = new MySqlCommand(
                "UPDATE Gatehouses SET Active = 0 WHERE Id = @id AND tenant_id = @tid", conn);
            cmd.Parameters.AddWithValue("@id", _fx.GatehouseId.ToString());
            cmd.Parameters.AddWithValue("@tid", _fx.TenantId.ToString());
            await cmd.ExecuteNonQueryAsync();
        }

        var admin = TenantAdminClient();
        var register = await admin.PostAsJsonAsync(
            "/api/v1/devices",
            new RegisterDeviceRequest(
                DeviceType: "reader",
                Vendor: "Synthetic reader",
                GatehouseId: _fx.GatehouseId,
                ConnectionParams: new Dictionary<string, object> { ["endpoint"] = "https://inactive.example.test" }));
        register.StatusCode.Should().Be(HttpStatusCode.NotFound);

        var edit = await admin.PatchAsJsonAsync(
            $"/api/v1/devices/{_fx.DeviceId}",
            new EditDeviceRequest(Vendor: "Updated synthetic controller", GatehouseId: _fx.GatehouseId, ConnectionParams: null));
        edit.StatusCode.Should().Be(HttpStatusCode.OK);

        var porteiro = PorteiroClient();
        var unlock = await porteiro.PostAsJsonAsync(
            $"/api/v1/devices/{_fx.DeviceId}/unlock",
            _fx.BuildSignedRequestForDevice(_fx.DeviceId));
        unlock.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SetActivation_Deactivates_UnlockRejected()
    {
        var client = TenantAdminClient();
        var req = new RegisterDeviceRequest(
            DeviceType: "reader",
            Vendor: "Generic",
            GatehouseId: null,
            ConnectionParams: new Dictionary<string, object> { ["endpoint"] = "https://x" });
        var register = await client.PostAsJsonAsync("/api/v1/devices", req);
        var detail = await register.Content.ReadFromJsonAsync<DeviceDetail>();
        var deviceId = detail!.Id;

        var deact = await client.PutAsJsonAsync(
            $"/api/v1/devices/{deviceId}/activation",
            new SetDeviceActivationRequest(false));
        deact.StatusCode.Should().Be(HttpStatusCode.OK);

        // After deactivation, the device is in the soft-deleted state — it
        // should not appear in the list, and the Phase 23 unlock endpoint
        // should reject it (404 / device-inactive).
        var list = await client.GetAsync("/api/v1/devices");
        var items = await list.Content.ReadFromJsonAsync<List<DeviceListItem>>();
        items!.Should().NotContain(d => d.Id == deviceId);

        // Switch flag on for the unlock endpoint.
        await _fx.SetDoorIntegrationEnabledAsync(true);

        var porteiro = PorteiroClient();
        var unlockReq = _fx.BuildSignedRequestForDevice(deviceId);
        var unlock = await porteiro.PostAsJsonAsync($"/api/v1/devices/{deviceId}/unlock", unlockReq);
        unlock.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task RemoveDevice_WithRecentActivity_Returns409()
    {
        var client = TenantAdminClient();
        var req = new RegisterDeviceRequest(
            DeviceType: "reader",
            Vendor: "Generic",
            GatehouseId: null,
            ConnectionParams: new Dictionary<string, object> { ["endpoint"] = "https://x" });
        var register = await client.PostAsJsonAsync("/api/v1/devices", req);
        var detail = await register.Content.ReadFromJsonAsync<DeviceDetail>();
        var deviceId = detail!.Id;

        // Seed a recent unlock-audit row (1h ago — within the 24h quiet period).
        await using (var conn = new MySqlConnection(_fx.MySql.ConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = new MySqlCommand(
                @"INSERT INTO DeviceUnlockAudit
                    (Id, TenantId, DeviceId, ActorProfileId, CommandHash, OccurredAtUtc,
                     ResponseOutcome, CommandNonce, CorrelationId, tenant_id)
                  VALUES (@id, @tid, @did, @actor, @hash, @ts, 'Success', @nonce, @corr, @tid)", conn);
            cmd.Parameters.AddWithValue("@id", Guid.NewGuid().ToString());
            cmd.Parameters.AddWithValue("@tid", _fx.TenantId.ToString());
            cmd.Parameters.AddWithValue("@did", deviceId.ToString());
            cmd.Parameters.AddWithValue("@actor", _fx.ActorProfileId.ToString());
            cmd.Parameters.AddWithValue("@hash", new string('a', 64));
            cmd.Parameters.AddWithValue("@ts", DateTime.UtcNow.AddHours(-1));
            cmd.Parameters.AddWithValue("@nonce", Guid.NewGuid().ToString());
            cmd.Parameters.AddWithValue("@corr", Guid.NewGuid().ToString());
            await cmd.ExecuteNonQueryAsync();
        }

        var remove = await client.DeleteAsync($"/api/v1/devices/{deviceId}");
        remove.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task RemoveDevice_AfterQuietPeriod_Succeeds()
    {
        var client = TenantAdminClient();
        var req = new RegisterDeviceRequest(
            DeviceType: "reader",
            Vendor: "Generic",
            GatehouseId: null,
            ConnectionParams: new Dictionary<string, object> { ["endpoint"] = "https://x" });
        var register = await client.PostAsJsonAsync("/api/v1/devices", req);
        var detail = await register.Content.ReadFromJsonAsync<DeviceDetail>();
        var deviceId = detail!.Id;

        // Seed an audit row from 25h ago — outside the 24h quiet period.
        await using (var conn = new MySqlConnection(_fx.MySql.ConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = new MySqlCommand(
                @"INSERT INTO DeviceUnlockAudit
                    (Id, TenantId, DeviceId, ActorProfileId, CommandHash, OccurredAtUtc,
                     ResponseOutcome, CommandNonce, CorrelationId, tenant_id)
                  VALUES (@id, @tid, @did, @actor, @hash, @ts, 'Success', @nonce, @corr, @tid)", conn);
            cmd.Parameters.AddWithValue("@id", Guid.NewGuid().ToString());
            cmd.Parameters.AddWithValue("@tid", _fx.TenantId.ToString());
            cmd.Parameters.AddWithValue("@did", deviceId.ToString());
            cmd.Parameters.AddWithValue("@actor", _fx.ActorProfileId.ToString());
            cmd.Parameters.AddWithValue("@hash", new string('b', 64));
            cmd.Parameters.AddWithValue("@ts", DateTime.UtcNow.AddHours(-25));
            cmd.Parameters.AddWithValue("@nonce", Guid.NewGuid().ToString());
            cmd.Parameters.AddWithValue("@corr", Guid.NewGuid().ToString());
            await cmd.ExecuteNonQueryAsync();
        }

        var remove = await client.DeleteAsync($"/api/v1/devices/{deviceId}");
        remove.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task ListDevices_AfterRemove_ExcludesRemoved()
    {
        var client = TenantAdminClient();
        var req = new RegisterDeviceRequest(
            DeviceType: "reader",
            Vendor: "Generic",
            GatehouseId: null,
            ConnectionParams: new Dictionary<string, object> { ["endpoint"] = "https://x" });
        var register = await client.PostAsJsonAsync("/api/v1/devices", req);
        var detail = await register.Content.ReadFromJsonAsync<DeviceDetail>();
        var deviceId = detail!.Id;

        var remove = await client.DeleteAsync($"/api/v1/devices/{deviceId}");
        remove.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var list = await client.GetAsync("/api/v1/devices");
        var items = await list.Content.ReadFromJsonAsync<List<DeviceListItem>>();
        items!.Should().NotContain(d => d.Id == deviceId);
    }

    private async Task<byte[]> ReadConnectionParamsAsync(Guid deviceId)
    {
        await using var conn = new MySqlConnection(_fx.MySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "SELECT ConnectionParams FROM Devices WHERE Id = @id", conn);
        cmd.Parameters.AddWithValue("@id", deviceId.ToString());
        return (byte[]?)(await cmd.ExecuteScalarAsync()) ?? Array.Empty<byte>();
    }
}
