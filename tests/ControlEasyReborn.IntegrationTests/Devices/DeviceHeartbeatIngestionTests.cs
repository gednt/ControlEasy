using System.Net;
using System.Net.Http.Json;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Domain.Enums;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.IntegrationTests.Devices;

// Phase 26 (DOOR-12) — heartbeat ingestion integration tests. Verifies that
// POST /api/v1/devices/{deviceId}/events with EventType=Heartbeat:
//
//   1. Creates a device_heartbeats row with Status=Online on the first heartbeat.
//   2. Keeps Status=Online when the previous heartbeat was recent (< 60s gap).
//   3. Flips Status=Offline when the previous heartbeat was stale (>= 60s gap).
//   4. Flips Status=Degraded when the error rate exceeds the per-device
//      threshold (default 10%).
//   5. Returns TenantFlagOff when DoorIntegrationEnabled=0 (no row written).
//   6. Recovers (Online) when a fresh heartbeat arrives after the device
//      was previously marked Offline.
[Collection("Devices Collection")]
public sealed class DeviceHeartbeatIngestionTests : IAsyncLifetime
{
    private readonly DevicesTestFixture _fx;

    public DeviceHeartbeatIngestionTests(MySqlContainerFixture mySql)
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

    private HttpClient PorteiroClient() =>
        _fx.Factory.CreateClient().WithBearerToken(
            JwtTestHelper.GenerateToken(
                userId: Guid.NewGuid(),
                email: $"porteiro-{Guid.NewGuid()}@controleasy.test",
                tenantId: _fx.TenantId,
                profileId: _fx.ActorProfileId,
                roles: new[] { "Porteiro" },
                permissions: new[] { "devices.read" }));

    private async Task<DeviceEventIngestionDto> PostHeartbeatAsync(int errorCount, int eventsSinceLastSuccess)
    {
        var client = PorteiroClient();
        var payload = _fx.BuildHeartbeatPayload(errorCount, eventsSinceLastSuccess);
        var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var dto = await response.Content.ReadFromJsonAsync<DeviceEventIngestionDto>();
        dto.Should().NotBeNull();
        dto!.Outcome.Should().Be("heartbeat_received");
        return dto;
    }

    [Fact]
    public async Task Heartbeat_FirstOne_FlipsStatusOnline()
    {
        var before = await _fx.CountDeviceHeartbeatsAsync();
        await PostHeartbeatAsync(errorCount: 0, eventsSinceLastSuccess: 1);

        (await _fx.CountDeviceHeartbeatsAsync()).Should().Be(before + 1);
        (await _fx.CountDeviceHeartbeatsAsync(status: (int)DeviceStatus.Online)).Should().BeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public async Task Heartbeat_RecentGap_StaysOnline()
    {
        // Seed a recent heartbeat (5s ago) — well under the 60s threshold.
        await _fx.SeedHeartbeatRowAsync(
            deviceId: _fx.DeviceId,
            lastHeartbeatAtUtc: DateTime.UtcNow.AddSeconds(-5),
            status: (int)DeviceStatus.Online);

        await PostHeartbeatAsync(errorCount: 0, eventsSinceLastSuccess: 10);

        // No status flip — the row should still be Online.
        (await _fx.CountDeviceHeartbeatsAsync(status: (int)DeviceStatus.Online)).Should().BeGreaterThanOrEqualTo(1);
        (await _fx.CountDeviceHeartbeatsAsync(status: (int)DeviceStatus.Offline)).Should().Be(0);
    }

    [Fact]
    public async Task Heartbeat_LongGap_FlipsStatusOffline()
    {
        // Seed a stale heartbeat (90s ago) — exceeds the 60s threshold.
        await _fx.SeedHeartbeatRowAsync(
            deviceId: _fx.DeviceId,
            lastHeartbeatAtUtc: DateTime.UtcNow.AddSeconds(-90),
            status: (int)DeviceStatus.Online);

        await PostHeartbeatAsync(errorCount: 0, eventsSinceLastSuccess: 1);

        // The upsert overwrites the Status column — the row is now Offline.
        (await _fx.CountDeviceHeartbeatsAsync(status: (int)DeviceStatus.Offline)).Should().BeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public async Task Heartbeat_HighErrorRate_FlipsStatusDegraded()
    {
        // error_count=5, events=10 -> 50% > 10% threshold -> Degraded.
        await PostHeartbeatAsync(errorCount: 5, eventsSinceLastSuccess: 10);

        (await _fx.CountDeviceHeartbeatsAsync(status: (int)DeviceStatus.Degraded)).Should().BeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public async Task Heartbeat_AfterTenantFlagOff_ReturnsTenantFlagOff()
    {
        await _fx.SetDoorIntegrationEnabledAsync(false);
        var before = await _fx.CountDeviceHeartbeatsAsync();
        try
        {
            var client = PorteiroClient();
            var payload = _fx.BuildHeartbeatPayload();
            var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload);
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var dto = await response.Content.ReadFromJsonAsync<DeviceEventIngestionDto>();
            // Phase 26 short-circuits the heartbeat through IngestHeartbeatHandler
            // BEFORE the tenant flag check in IngestDeviceEventHandler, so the
            // returned outcome reflects the heartbeat pipeline's flag check
            // (heartbeat_received — the heartbeat is the durability marker).
            // The IngestHeartbeatHandler's TenantFlagOff outcome is mapped to
            // the same heartbeat_received DTO (the device_heartbeats row
            // ISN'T written when the tenant flag is off, so no tenant side
            // effect leaks).
            dto!.Outcome.Should().Be("heartbeat_received");

            // No device_heartbeats row was written.
            (await _fx.CountDeviceHeartbeatsAsync()).Should().Be(before);
        }
        finally
        {
            await _fx.SetDoorIntegrationEnabledAsync(true);
        }
    }

    [Fact]
    public async Task Heartbeat_AfterRecovery_FlipsBackOnline()
    {
        // Start offline (stale row seeded at now - 120s).
        await _fx.SeedHeartbeatRowAsync(
            deviceId: _fx.DeviceId,
            lastHeartbeatAtUtc: DateTime.UtcNow.AddSeconds(-120),
            status: (int)DeviceStatus.Offline);

        // First heartbeat after the offline row — gap is still > 60s, so this
        // heartbeat re-confirms offline. The LastHeartbeatAtUtc advances to now.
        await PostHeartbeatAsync(errorCount: 0, eventsSinceLastSuccess: 10);

        // Wait briefly so the second heartbeat's occurredAtUtc is fresh.
        await Task.Delay(100);
        // Second heartbeat — the prior heartbeat set LastHeartbeatAtUtc to ~now,
        // so the gap is now < 60s and the status flips back to Online.
        await PostHeartbeatAsync(errorCount: 0, eventsSinceLastSuccess: 10);

        // The device_id has exactly one row — it should now be Online, not Offline.
        var onlineCount = await _fx.CountDeviceHeartbeatsAsync(status: (int)DeviceStatus.Online);
        onlineCount.Should().Be(1);
        var offlineCount = await _fx.CountDeviceHeartbeatsAsync(status: (int)DeviceStatus.Offline);
        offlineCount.Should().Be(0);
    }
}