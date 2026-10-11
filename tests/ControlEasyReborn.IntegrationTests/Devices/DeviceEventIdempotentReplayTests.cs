using System.Net;
using System.Net.Http.Json;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ControlEasyReborn.IntegrationTests.Devices;

[Collection("Devices Collection")]
public sealed class DeviceEventIdempotentReplayTests : IAsyncLifetime
{
    private readonly DevicesTestFixture _fx;

    public DeviceEventIdempotentReplayTests(MySqlContainerFixture mySql)
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

    private void ResetInMemoryQueue()
    {
        using var scope = _fx.Factory.Services.CreateScope();
        var queue = scope.ServiceProvider.GetRequiredService<IDeviceEventQueue>();
        queue.Reset(_fx.TenantId, _fx.DeviceId);
    }

    [Fact]
    public async Task Replay_SameExternalEventId_NoDoubleProcessing()
    {
        ResetInMemoryQueue();
        var before = await _fx.CountDeviceEventsAsync();
        var refusedBefore = await _fx.CountRefusedScanAttemptsAsync();

        var client = PorteiroClient();
        var residentId = Guid.NewGuid();
        var payloads = new List<DeviceEventPayload>();
        for (var i = 0; i < 5; i++)
        {
            payloads.Add(new DeviceEventPayload(
                EventType: ControlEasyReborn.Modules.Devices.Domain.Enums.DeviceEventType.CardRead,
                OccurredAtUtc: DateTime.UtcNow.AddSeconds(-i),
                SequenceNumber: 100 + i,
                ExternalEventId: Guid.NewGuid(),
                OpaqueToken: $"sim-test-resident-{residentId:N}",
                PayloadJson: "{}"));
        }

        // First pass — all 5 produce device_events rows. The sim-test-
        // resident-* token resolves through DeviceCredentialResolver to
        // a synthetic CredentialMatch; RecordAccessScanHandler then
        // dispatches its own HMAC-token check which fails (the synthetic
        // token isn't a real HMAC-issued QR). The refused-scan rows
        // prove the single-write-path: even "matched-resident" simulator
        // tokens end up via RecordRefusedScanHandler / RecordAccessScanHandler
        // for the eventual ledger write.
        foreach (var payload in payloads)
        {
            var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload);
            response.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        (await _fx.CountDeviceEventsAsync()).Should().Be(before + 5);
        var refusedAfterFirstPass = await _fx.CountRefusedScanAttemptsAsync();
        refusedAfterFirstPass.Should().BeGreaterThanOrEqualTo(refusedBefore + 5);

        // Second pass — each redelivered event returns ReplayDuplicate;
        // the idempotency-key check short-circuits BEFORE any ledger
        // side effect.
        foreach (var payload in payloads)
        {
            var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload);
            response.StatusCode.Should().Be(HttpStatusCode.OK);

            var dto = await response.Content.ReadFromJsonAsync<DeviceEventIngestionDto>();
            dto!.Outcome.Should().Be("replay_duplicate");
        }

        // No new device_events rows + no new refused-scan rows.
        (await _fx.CountDeviceEventsAsync()).Should().Be(before + 5);
        (await _fx.CountRefusedScanAttemptsAsync()).Should().Be(refusedAfterFirstPass);
    }

    [Fact]
    public async Task Replay_NullExternalEventId_SequenceOnlyUniqueness()
    {
        ResetInMemoryQueue();
        var client = PorteiroClient();

        var payload1 = new DeviceEventPayload(
            EventType: ControlEasyReborn.Modules.Devices.Domain.Enums.DeviceEventType.CardRead,
            OccurredAtUtc: DateTime.UtcNow.AddSeconds(-1),
            SequenceNumber: 42,
            ExternalEventId: null,
            OpaqueToken: $"sim-test-resident-{Guid.NewGuid():N}",
            PayloadJson: "{}");

        var first = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload1);
        first.StatusCode.Should().Be(HttpStatusCode.OK);

        var second = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload1);
        second.StatusCode.Should().Be(HttpStatusCode.OK);

        var dto = await second.Content.ReadFromJsonAsync<DeviceEventIngestionDto>();
        dto!.Outcome.Should().Be("replay_duplicate");
    }

    [Fact]
    public async Task Replay_AfterDisconnection_NoEventLost()
    {
        ResetInMemoryQueue();

        // Simulate 5 events being "queued" while the simulator is offline.
        var queuedPayloads = new List<DeviceEventPayload>();
        for (var i = 0; i < 5; i++)
        {
            queuedPayloads.Add(new DeviceEventPayload(
                EventType: ControlEasyReborn.Modules.Devices.Domain.Enums.DeviceEventType.CardRead,
                OccurredAtUtc: DateTime.UtcNow.AddSeconds(-i - 1),
                SequenceNumber: 200 + i,
                ExternalEventId: Guid.NewGuid(),
                OpaqueToken: $"sim-test-resident-{Guid.NewGuid():N}",
                PayloadJson: "{}"));
        }

        // "Reconnect" via sequential POST /events.
        var before = await _fx.CountDeviceEventsAsync();
        var client = PorteiroClient();
        foreach (var payload in queuedPayloads)
        {
            var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload);
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            var dto = await response.Content.ReadFromJsonAsync<DeviceEventIngestionDto>();
            dto!.Outcome.Should().NotBe("replay_duplicate");
        }

        // Exactly 5 new device_events rows; no rows were lost.
        (await _fx.CountDeviceEventsAsync()).Should().Be(before + 5);

        // Re-post the same 5 (simulating the recovery pipe resending the
        // backlog twice). Each is a no-op replay.
        foreach (var payload in queuedPayloads)
        {
            var second = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload);
            second.StatusCode.Should().Be(HttpStatusCode.OK);
            var dto = await second.Content.ReadFromJsonAsync<DeviceEventIngestionDto>();
            dto!.Outcome.Should().Be("replay_duplicate");
        }

        // Still exactly 5 rows.
        (await _fx.CountDeviceEventsAsync()).Should().Be(before + 5);
    }
}
