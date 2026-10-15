using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Domain.Enums;
using FluentAssertions;
using MySqlConnector;
using Xunit;

namespace ControlEasyReborn.IntegrationTests.Devices;

// Per-device Configure flow — PUT /api/v1/devices/{deviceId}/thresholds
// (gatehouse binding via PATCH /devices/{id} is covered by
// DeviceAdminEndpointTests). Matrix rows from the spec: persist on an
// existing heartbeat row, sentinel-row INSERT for a never-heartbeaten
// device, carry-forward on the next real ingest, 400 errors dict with no DB
// mutation, 403 without devices.write, 404 for unknown / foreign devices.
[Collection("Devices Collection")]
public sealed class DeviceThresholdsEndpointTests : IAsyncLifetime
{
    private readonly DevicesTestFixture _fx;

    public DeviceThresholdsEndpointTests(MySqlContainerFixture mySql)
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
                email: $"thresholds-admin-{Guid.NewGuid()}@controleasy.test",
                tenantId: _fx.TenantId,
                profileId: _fx.ActorProfileId,
                roles: new[] { "TenantAdmin" },
                permissions: new[] { "devices.read", "devices.write" }));

    private HttpClient ReadOnlyClient() =>
        _fx.Factory.CreateClient().WithBearerToken(
            JwtTestHelper.GenerateToken(
                userId: Guid.NewGuid(),
                email: $"thresholds-readonly-{Guid.NewGuid()}@controleasy.test",
                tenantId: _fx.TenantId,
                profileId: _fx.ActorProfileId,
                roles: new[] { "TenantAdmin" },
                permissions: new[] { "devices.read" }));

    [Fact]
    public async Task PutThresholds_OnDeviceWithHeartbeatRow_UpdatesRow_AndHealthReflects()
    {
        // Distinctive counters prove the write is threshold-columns-only:
        // a full-row overwrite would clobber the seeded Status/counters and
        // replace the seeded last-heartbeat with the sentinel/@updatedAt.
        await _fx.SeedHeartbeatRowAsync(
            _fx.DeviceId,
            DateTime.UtcNow.AddSeconds(-2),
            status: 0 /* Online */,
            errorCount: 2,
            eventsSinceLastSuccess: 10);
        var seededLastSeen = await _fx.GetHeartbeatLastSeenAsync(_fx.DeviceId);
        seededLastSeen.Should().NotBeNull();

        var client = TenantAdminClient();
        var response = await client.PutAsJsonAsync(
            $"/api/v1/devices/{_fx.DeviceId}/thresholds",
            new UpdateDeviceThresholdsRequest(300, 12.50m));

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var dto = await response.Content.ReadFromJsonAsync<DeviceThresholdsDto>();
        dto.Should().NotBeNull();
        dto!.DeviceId.Should().Be(_fx.DeviceId);
        dto.OfflineAfterSeconds.Should().Be(300);
        dto.ErrorRateThresholdPercent.Should().Be(12.50m);

        var health = await client.GetFromJsonAsync<List<DeviceHealthDto>>("/api/v1/devices/health");
        health.Should().NotBeNull();
        var row = health!.Single(d => d.DeviceId == _fx.DeviceId);
        row.OfflineAfterSeconds.Should().Be(300);
        row.ErrorRateThresholdPercent.Should().Be(12.50m);
        // Heartbeat-derived data untouched by the Configure write.
        row.Status.Should().Be(DeviceStatus.Online);
        row.StatusLabel.Should().Be("Online");
        row.ErrorCount.Should().Be(2);
        row.EventsSinceLastSuccess.Should().Be(10);
        row.ErrorRatePercent.Should().Be(20m); // 2 / 10 = 20%
        row.LastHeartbeatAtUtc.Should().NotBeNull();
        row.LastHeartbeatAtUtc!.Value.Should().BeCloseTo(seededLastSeen!.Value, TimeSpan.FromSeconds(2));
    }

    [Fact]
    public async Task PutThresholds_OnNeverHeartbeatenDevice_InsertsSentinelRow_HealthShowsNever()
    {
        // A second device with NO heartbeat row.
        var neverHeard = Guid.NewGuid();
        await _fx.SeedSecondDeviceAsync(newDeviceId: neverHeard, vendor: "Intelbras");

        var client = TenantAdminClient();
        var response = await client.PutAsJsonAsync(
            $"/api/v1/devices/{neverHeard}/thresholds",
            new UpdateDeviceThresholdsRequest(120, 5.00m));

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        // Sentinel row exists in the DB with the 2000-01-01 timestamp.
        var sentinel = await _fx.GetHeartbeatLastSeenAsync(neverHeard);
        sentinel.Should().NotBeNull();
        sentinel!.Value.Should().BeBefore(new DateTime(2001, 1, 1, 0, 0, 0, DateTimeKind.Utc));

        // Health displays truthfully: Offline + "never" + configured values.
        var health = await client.GetFromJsonAsync<List<DeviceHealthDto>>("/api/v1/devices/health");
        health.Should().NotBeNull();
        var row = health!.Single(d => d.DeviceId == neverHeard);
        row.Status.Should().Be(DeviceStatus.Offline);
        row.LastHeartbeatAtUtc.Should().BeNull();
        row.OfflineAfterSeconds.Should().Be(120);
        row.ErrorRateThresholdPercent.Should().Be(5.00m);
        row.ErrorCount.Should().Be(0);
        row.IsOfflineExceeded.Should().BeTrue();
    }

    [Fact]
    public async Task PutThresholds_ThenRealHeartbeat_PreservesConfiguredThresholds()
    {
        var deviceId = Guid.NewGuid();
        await _fx.SeedSecondDeviceAsync(newDeviceId: deviceId, vendor: "Intelbras");
        await _fx.SetDoorIntegrationEnabledAsync(true);

        var admin = TenantAdminClient();
        var put = await admin.PutAsJsonAsync(
            $"/api/v1/devices/{deviceId}/thresholds",
            new UpdateDeviceThresholdsRequest(300, 5.00m));
        put.StatusCode.Should().Be(HttpStatusCode.OK);

        // Real heartbeat (sentinel row exists) — the ingest pipeline must
        // carry the configured thresholds forward, never reset them.
        var porteiro = _fx.Factory.CreateClient().WithBearerToken(
            JwtTestHelper.GenerateToken(
                userId: Guid.NewGuid(),
                email: $"thresholds-porteiro-{Guid.NewGuid()}@controleasy.test",
                tenantId: _fx.TenantId,
                profileId: _fx.ActorProfileId,
                roles: new[] { "Porteiro" },
                permissions: new[] { "devices.read" }));

        var ingest = await porteiro.PostAsJsonAsync(
            $"/api/v1/devices/{deviceId}/events",
            _fx.BuildHeartbeatPayload(errorCount: 0, eventsSinceLastSuccess: 1));
        ingest.StatusCode.Should().Be(HttpStatusCode.OK);

        var (offline, pct) = await GetThresholdColumnsAsync(deviceId);
        offline.Should().Be(300);
        pct.Should().Be(5.00m);

        // Also confirm GET health surfaces the configured thresholds after ingest.
        var health = await admin.GetFromJsonAsync<List<DeviceHealthDto>>("/api/v1/devices/health");
        health.Should().NotBeNull();
        var row = health!.Single(d => d.DeviceId == deviceId);
        row.OfflineAfterSeconds.Should().Be(300);
        row.ErrorRateThresholdPercent.Should().Be(5.00m);
        row.LastHeartbeatAtUtc.Should().NotBeNull(); // the real heartbeat overwrote the sentinel timestamp
    }

    [Fact]
    public async Task PutThresholds_InvalidThresholds_Returns400WithErrorsDict_AndDoesNotMutate()
    {
        var neverHeard = Guid.NewGuid();
        await _fx.SeedSecondDeviceAsync(newDeviceId: neverHeard, vendor: "Intelbras");
        var rowsBefore = await _fx.CountDeviceHeartbeatsAsync();

        var client = TenantAdminClient();
        var response = await client.PutAsJsonAsync(
            $"/api/v1/devices/{neverHeard}/thresholds",
            new UpdateDeviceThresholdsRequest(0, 120m));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        doc.RootElement.TryGetProperty("errors", out var errors).Should().BeTrue();
        errors.ValueKind.Should().Be(JsonValueKind.Object);
        // The errors dict is flat per-field; both violated fields must report.
        var errorText = errors.GetRawText();
        errorText.Should().Contain("OfflineAfterSeconds");
        errorText.Should().Contain("ErrorRateThresholdPercent");

        // No row INSERTed / mutated.
        var rowsAfter = await _fx.CountDeviceHeartbeatsAsync();
        rowsAfter.Should().Be(rowsBefore);
        (await _fx.GetHeartbeatLastSeenAsync(neverHeard)).Should().BeNull();
    }

    [Fact]
    public async Task PutThresholds_WithoutWritePermission_Returns403()
    {
        var client = ReadOnlyClient();
        var response = await client.PutAsJsonAsync(
            $"/api/v1/devices/{_fx.DeviceId}/thresholds",
            new UpdateDeviceThresholdsRequest(300, 12.50m));

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task PutThresholds_UnknownDevice_Returns404()
    {
        var client = TenantAdminClient();
        var response = await client.PutAsJsonAsync(
            $"/api/v1/devices/{Guid.NewGuid()}/thresholds",
            new UpdateDeviceThresholdsRequest(300, 12.50m));

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task PutThresholds_CrossTenantDevice_Returns404_AndLeavesRowUntouched()
    {
        // Tenant B device (seeded via the fixture's reusable helpers).
        await _fx.SeedTenantBDeviceAsync();
        var deviceB = _fx.TenantBDeviceId;

        var client = TenantAdminClient();
        var response = await client.PutAsJsonAsync(
            $"/api/v1/devices/{deviceB}/thresholds",
            new UpdateDeviceThresholdsRequest(300, 12.50m));

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);

        // No row was written for the foreign device.
        var count = await CountRowsForDeviceAsync(deviceB);
        count.Should().Be(0);
    }

    // ---- helpers ----

    private async Task<int> CountRowsForDeviceAsync(Guid deviceId)
    {
        await using var conn = new MySqlConnection(_fx.MySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "SELECT COUNT(*) FROM device_heartbeats WHERE DeviceId = @did", conn);
        cmd.Parameters.AddWithValue("@did", deviceId.ToString());
        return Convert.ToInt32(await cmd.ExecuteScalarAsync());
    }

    private async Task<(int OfflineAfterSeconds, decimal ErrorRateThresholdPercent)> GetThresholdColumnsAsync(Guid deviceId)
    {
        await using var conn = new MySqlConnection(_fx.MySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "SELECT OfflineAfterSeconds, ErrorRateThresholdPercent FROM device_heartbeats WHERE DeviceId = @did AND tenant_id = @tid", conn);
        cmd.Parameters.AddWithValue("@did", deviceId.ToString());
        cmd.Parameters.AddWithValue("@tid", _fx.TenantId.ToString());
        await using var reader = await cmd.ExecuteReaderAsync();
        reader.Read().Should().BeTrue();
        return (Convert.ToInt32(reader["OfflineAfterSeconds"]), Convert.ToDecimal(reader["ErrorRateThresholdPercent"]));
    }
}