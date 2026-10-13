using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ControlEasyReborn.Modules.Devices.Api.Endpoints;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.IntegrationTests.Devices;

[Collection("Devices Collection")]
public sealed class DeviceEventIngestionEndpointTests : IAsyncLifetime
{
    private readonly DevicesTestFixture _fx;

    public DeviceEventIngestionEndpointTests(MySqlContainerFixture mySql)
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

    [Fact]
    public async Task Ingest_CardRead_MatchedResident_DispatchesThroughAccessScanHandler()
    {
        var deviceEventsBefore = await _fx.CountDeviceEventsAsync();

        var client = PorteiroClient();
        var residentId = Guid.NewGuid();
        var payload = _fx.BuildCardReadPayload(opaqueToken: $"sim-test-resident-{residentId:N}");

        var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var dto = await response.Content.ReadFromJsonAsync<DeviceEventIngestionDto>();
        dto.Should().NotBeNull();
        // The sim-test-* synthetic token is not a real issued QR credential,
        // so the canonical RecordAccessScanHandler refuses it — one
        // denied_attempt with one linked refused-scan row through the
        // single-write-path. (Previously this test allowed "matched_dweller":
        // the old ingestion-side credential pre-resolution fabricated match
        // outcomes that the canonical decision then contradicted.)
        dto!.Outcome.Should().Be("denied_attempt");

        // The device_events row is the ledger marker.
        (await _fx.CountDeviceEventsAsync()).Should().Be(deviceEventsBefore + 1);
    }

    [Fact]
    public async Task Ingest_CardRead_UnknownCard_WritesRefusedScanAttempt()
    {
        var refusedBefore = await _fx.CountRefusedScanAttemptsAsync();

        var client = PorteiroClient();
        var payload = _fx.BuildCardReadPayload(
            opaqueToken: $"sim-test-unknown-{Guid.NewGuid():N}",
            sequenceNumber: 100);

        var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var dto = await response.Content.ReadFromJsonAsync<DeviceEventIngestionDto>();
        dto.Should().NotBeNull();
        dto!.Outcome.Should().Be("denied_attempt");
        dto.RefusedScanAttemptId.Should().NotBeNull();

        var refusedAfter = await _fx.CountRefusedScanAttemptsAsync();
        refusedAfter.Should().Be(refusedBefore + 1);
    }

    [Fact]
    public async Task Ingest_CardRead_InactiveCredential_DeniesScan()
    {
        // The simulator prefix returns synthetic CredentialMatch objects with
        // IsActive=true, so this test simply proves the unknown/prefix path
        // for a token without an Active credential row.
        var client = PorteiroClient();
        var payload = _fx.BuildCardReadPayload(
            opaqueToken: "no-such-token-in-resolver",
            sequenceNumber: 200);

        var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var dto = await response.Content.ReadFromJsonAsync<DeviceEventIngestionDto>();
        dto.Should().NotBeNull();
        dto!.Outcome.Should().Be("denied_attempt");
    }

    [Fact]
    public async Task Ingest_CardRead_MissingDirection_IsRejected()
    {
        // Strict direction contract: payload_json without "direction" is NOT
        // silently coerced to Entrance — it is a 400 validation failure.
        var client = PorteiroClient();
        var payload = _fx.BuildCardReadPayload(payloadJson: "{}");

        var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Ingest_CardRead_UnknownDirectionValue_IsRejected()
    {
        var client = PorteiroClient();
        var payload = _fx.BuildCardReadPayload(payloadJson: "{\"direction\":\"sideways\"}");

        var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Ingest_CardRead_RealVisitorCredential_Entrance_AdvancesVisitExactlyOnce()
    {
        // Real issued credential chain (synthetic data): apartment -> pending
        // visit -> visitor QR credential (SubjectId == Visit.Id). The direct
        // UUID resolution path of the canonical crypto service accepts the
        // subject id as the presented token.
        var apartmentId = await _fx.SeedSyntheticApartmentAsync();
        var (visitId, _) = await _fx.SeedSyntheticVisitAsync(apartmentId);
        await _fx.SeedSyntheticCredentialAsync(subjectType: 2 /* Visitor */, subjectId: visitId);

        var visitsBefore = await _fx.CountVisitsByStatusAsync(1 /* CheckedIn */);
        var accessBefore = await _fx.CountAccessEventsAsync();

        var client = PorteiroClient();
        var payload = _fx.BuildCardReadPayload(
            opaqueToken: visitId.ToString("D"),
            direction: "entrance");

        var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var dto = await response.Content.ReadFromJsonAsync<DeviceEventIngestionDto>();
        dto!.Outcome.Should().Be("advanced_visit");
        dto.VisitId.Should().Be(visitId);
        dto.AccessEventId.Should().NotBeNull();

        // The visit advanced exactly once.
        (await _fx.CountVisitsByStatusAsync(1)).Should().Be(visitsBefore + 1);
        (await _fx.CountAccessEventsAsync()).Should().Be(accessBefore + 1);

        // A re-presentation with a fresh scan attempt is an idempotent
        // no-op arrival (already CheckedIn): no second visit mutation.
        var replay = _fx.BuildCardReadPayload(
            opaqueToken: visitId.ToString("D"),
            sequenceNumber: 991,
            direction: "entrance");
        var replayResponse = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", replay);
        replayResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var replayDto = await replayResponse.Content.ReadFromJsonAsync<DeviceEventIngestionDto>();
        replayDto!.Outcome.Should().Be("matched_dweller");

        // Still exactly one CheckedIn visit for this credential.
        (await _fx.CountVisitsByStatusAsync(1)).Should().Be(visitsBefore + 1);
    }

    [Fact]
    public async Task Ingest_CardRead_RealVisitorCredential_Exit_RecordsExitWithoutArrival()
    {
        var apartmentId = await _fx.SeedSyntheticApartmentAsync();
        var (visitId, _) = await _fx.SeedSyntheticVisitAsync(apartmentId);
        await _fx.SeedSyntheticCredentialAsync(subjectType: 2 /* Visitor */, subjectId: visitId);

        var visitsBefore = await _fx.CountVisitsByStatusAsync(1 /* CheckedIn */);
        var accessBefore = await _fx.CountAccessEventsAsync();

        var client = PorteiroClient();
        var payload = _fx.BuildCardReadPayload(
            opaqueToken: visitId.ToString("D"),
            direction: "exit");

        var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var dto = await response.Content.ReadFromJsonAsync<DeviceEventIngestionDto>();
        dto!.Outcome.Should().Be("matched_dweller"); // Exit never advances a visit
        dto.AccessEventId.Should().NotBeNull();

        // Exit persisted: the access event carries Direction = 1 (exit).
        (await _fx.CountAccessEventsWithDirectionAsync(1)).Should().BeGreaterThan(0);
        (await _fx.CountAccessEventsAsync()).Should().Be(accessBefore + 1);

        // Exit never silently registers an arrival.
        (await _fx.CountVisitsByStatusAsync(1)).Should().Be(visitsBefore);
        (await _fx.CountDeviceEventsAsync(resultCode: "advanced_visit")).Should().Be(0);
    }

    [Fact]
    public async Task Ingest_CardDenied_ExplicitDenial_CarriesDirectionInRefusal()
    {
        var refusedBefore = await _fx.CountRefusedScanAttemptsAsync(failureCode: "invalid_credential");

        var client = PorteiroClient();
        var payload = new DeviceEventPayload(
            EventType: ControlEasyReborn.Modules.Devices.Domain.Enums.DeviceEventType.CardDenied,
            OccurredAtUtc: DateTime.UtcNow.AddSeconds(-1),
            SequenceNumber: 3001,
            ExternalEventId: Guid.NewGuid(),
            OpaqueToken: $"sim-test-unknown-{Guid.NewGuid():N}",
            PayloadJson: "{\"direction\":\"exit\"}");

        var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var dto = await response.Content.ReadFromJsonAsync<DeviceEventIngestionDto>();
        dto!.Outcome.Should().Be("denied_attempt");
        dto.FailureCode.Should().Be("invalid_credential");
        dto.RefusedScanAttemptId.Should().NotBeNull();

        var withExit = await _fx.CountRefusalsWithDirectionAsync(1 /* Exit */);
        withExit.Should().BeGreaterThan(0);
        (await _fx.CountRefusedScanAttemptsAsync(failureCode: "invalid_credential"))
            .Should().Be(refusedBefore + 1);
    }

    [Fact]
    public async Task Ingest_CardRead_RealResidentCredential_CarriesDirection()
    {
        var apartmentId = await _fx.SeedSyntheticApartmentAsync();
        var residentId = await _fx.SeedSyntheticResidentAsync(apartmentId);
        await _fx.SeedSyntheticCredentialAsync(subjectType: 0 /* Resident */, subjectId: residentId);

        var visitsBefore = await _fx.CountVisitsByStatusAsync(1 /* CheckedIn */);
        var accessBefore = await _fx.CountAccessEventsAsync();

        var client = PorteiroClient();
        // Resident EXIT: AccessEvent recorded with the exit direction, and no
        // Visit row is ever created for residents.
        var payload = _fx.BuildCardReadPayload(
            opaqueToken: residentId.ToString("D"),
            direction: "exit");

        var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var dto = await response.Content.ReadFromJsonAsync<DeviceEventIngestionDto>();
        dto!.Outcome.Should().Be("matched_dweller");
        dto.AccessEventId.Should().NotBeNull();
        dto.VisitId.Should().BeNull();
        dto.FailureCode.Should().BeNull();

        (await _fx.CountAccessEventsAsync()).Should().Be(accessBefore + 1);
        (await _fx.CountAccessEventsWithDirectionAsync(1 /* exit */)).Should().BeGreaterThan(0);
        // Residents never create Visits — canonical single-write-path intact.
        (await _fx.CountVisitsByStatusAsync(1)).Should().Be(visitsBefore);
    }

    [Fact]
    public async Task Ingest_CardDenied_MissingDirection_IsRejected()
    {
        // Explicit reader denials need a direction too — a card_read/card_denied
        // payload without payload_json "direction" is a validation failure.
        var client = PorteiroClient();
        var payload = new DeviceEventPayload(
            EventType: ControlEasyReborn.Modules.Devices.Domain.Enums.DeviceEventType.CardDenied,
            OccurredAtUtc: DateTime.UtcNow.AddSeconds(-1),
            SequenceNumber: 3002,
            ExternalEventId: Guid.NewGuid(),
            OpaqueToken: $"sim-test-unknown-{Guid.NewGuid():N}",
            PayloadJson: "{}");

        var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Ingest_CardDenied_UnknownDirectionValue_IsRejected()
    {
        var client = PorteiroClient();
        var payload = new DeviceEventPayload(
            EventType: ControlEasyReborn.Modules.Devices.Domain.Enums.DeviceEventType.CardDenied,
            OccurredAtUtc: DateTime.UtcNow.AddSeconds(-1),
            SequenceNumber: 3003,
            ExternalEventId: Guid.NewGuid(),
            OpaqueToken: $"sim-test-unknown-{Guid.NewGuid():N}",
            PayloadJson: "{\"direction\":\"sideways\"}");

        var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Ingest_WhenTenantFlagOff_ReturnsTenantFlagOffOutcome()
    {
        await _fx.SetDoorIntegrationEnabledAsync(false);
        try
        {
            var client = PorteiroClient();
            var payload = _fx.BuildCardReadPayload();

            var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload);
            response.StatusCode.Should().Be(HttpStatusCode.OK);

            var dto = await response.Content.ReadFromJsonAsync<DeviceEventIngestionDto>();
            dto!.Outcome.Should().Be("tenant_flag_off");
        }
        finally
        {
            await _fx.SetDoorIntegrationEnabledAsync(true);
        }
    }

    [Fact]
    public async Task Ingest_OnRemovedDevice_ReturnsDeviceInactiveWithoutLedgerWrite()
    {
        await _fx.SoftDeleteDeviceAsync();
        try
        {
            var before = await _fx.CountDeviceEventsAsync();

            var client = PorteiroClient();
            var payload = _fx.BuildCardReadPayload();

            var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload);
            response.StatusCode.Should().Be(HttpStatusCode.OK);

            var dto = await response.Content.ReadFromJsonAsync<DeviceEventIngestionDto>();
            dto!.Outcome.Should().Be("device_inactive");

            // The IngestDeviceEventHandler returns BEFORE the DeviceEvent insert
            // when the device is inactive -> no row is written.
            (await _fx.CountDeviceEventsAsync()).Should().Be(before);
        }
        finally
        {
            // Re-activate to keep the fixture usable for subsequent tests.
            await using var conn = new MySqlConnector.MySqlConnection(_fx.MySql.ConnectionString);
            await conn.OpenAsync();
            await using var cmd = new MySqlConnector.MySqlCommand(
                "UPDATE Devices SET IsActive=1, RemovedAtUtc=NULL WHERE Id=@id", conn);
            cmd.Parameters.AddWithValue("@id", _fx.DeviceId.ToString());
            await cmd.ExecuteNonQueryAsync();
        }
    }
}

[Collection("Devices Collection")]
public sealed class SimulatorPresentationEndpointTests : IAsyncLifetime
{
    private readonly DevicesTestFixture _fx;

    public SimulatorPresentationEndpointTests(MySqlContainerFixture mySql)
    {
        _fx = new DevicesTestFixture(mySql);
    }

    public async Task InitializeAsync()
    {
        await _fx.InitializeAsync();
        await _fx.SeedAsync();
        await _fx.ResetSimulatorAsync();
        await _fx.SeedVirtualReaderAsync();
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

    private async Task<Guid> SeedVisitorCredentialAsync()
    {
        var apartmentId = await _fx.SeedSyntheticApartmentAsync();
        var (visitId, _) = await _fx.SeedSyntheticVisitAsync(apartmentId);
        await _fx.SeedSyntheticCredentialAsync(subjectType: 2 /* Visitor */, subjectId: visitId);
        return visitId;
    }

    [Fact]
    public async Task Readiness_BoundActiveReader_ReportsReadyWithGatehouse()
    {
        var client = PorteiroClient();
        var response = await client.GetAsync($"/api/v1/_internal/devices/{_fx.VirtualReaderId}/simulator/readiness");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var readiness = await response.Content.ReadFromJsonAsync<SimulatorDeviceReadinessDto>();
        readiness!.Ready.Should().BeTrue();
        readiness.GatehouseId.Should().Be(_fx.GatehouseId);
        readiness.GatehouseName.Should().Be("Devices test gatehouse");
    }

    [Fact]
    public async Task Readiness_ControllerDevice_ReportsNotReady()
    {
        var client = PorteiroClient();
        var response = await client.GetAsync($"/api/v1/_internal/devices/{_fx.DeviceId}/simulator/readiness");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var readiness = await response.Content.ReadFromJsonAsync<SimulatorDeviceReadinessDto>();
        readiness!.Ready.Should().BeFalse();
        readiness.Reason.Should().Be("not_a_reader");
    }

    [Fact]
    public async Task Readiness_UnboundReader_ReportsMissingBinding()
    {
        // A reader with no gatehouse binding can never present — the
        // readiness verdict is actionable, not a 500.
        var unboundReaderId = await _fx.SeedUnboundReaderAsync();
        var client = PorteiroClient();
        var response = await client.GetAsync($"/api/v1/_internal/devices/{unboundReaderId}/simulator/readiness");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var readiness = await response.Content.ReadFromJsonAsync<SimulatorDeviceReadinessDto>();
        readiness!.Ready.Should().BeFalse();
        readiness.Reason.Should().Be("gatehouse_binding_missing");
    }

    [Fact]
    public async Task Present_RealVisitorCredential_Entrance_DelegatesToIngestion()
    {
        var visitId = await SeedVisitorCredentialAsync();

        var deviceEventsBefore = await _fx.CountDeviceEventsAsync();
        var visitsBefore = await _fx.CountVisitsByStatusAsync(1 /* CheckedIn */);

        var client = PorteiroClient();
        var response = await client.PostAsJsonAsync(
            $"/api/v1/_internal/devices/{_fx.VirtualReaderId}/simulator/present-credential",
            new PresentCredentialRequest(visitId.ToString("D"), "entrance"));
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<SimulatedPresentationResultDto>();
        result!.Outcome.Should().Be("advanced_visit");
        result.Direction.Should().Be("entrance");
        result.VisitId.Should().Be(visitId);
        result.AccessEventId.Should().NotBeNull();

        // One canonical ledger write reached the tenant.
        (await _fx.CountDeviceEventsAsync()).Should().Be(deviceEventsBefore + 1);
        (await _fx.CountVisitsByStatusAsync(1)).Should().Be(visitsBefore + 1);
    }

    [Fact]
    public async Task Present_WhenAlwaysDeviceOffline_ReturnsConfiguredFailureWithoutLedgerWrite()
    {
        _fx.SetSimulatorFailureMode(_fx.VirtualReaderId, SimulatorFailureMode.AlwaysDeviceOffline);

        var deviceEventsBefore = await _fx.CountDeviceEventsAsync();
        var accessBefore = await _fx.CountAccessEventsAsync();
        var refusedBefore = await _fx.CountRefusedScanAttemptsAsync();

        var visitId = await SeedVisitorCredentialAsync();

        var client = PorteiroClient();
        var response = await client.PostAsJsonAsync(
            $"/api/v1/_internal/devices/{_fx.VirtualReaderId}/simulator/present-credential",
            new PresentCredentialRequest(visitId.ToString("D"), "entrance"));
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<SimulatedPresentationResultDto>();
        result!.Outcome.Should().Be("device_offline");

        // The offline short-circuit never touches the ingestion pipeline:
        // no device event, no access event, no refusal.
        (await _fx.CountDeviceEventsAsync()).Should().Be(deviceEventsBefore);
        (await _fx.CountAccessEventsAsync()).Should().Be(accessBefore);
        (await _fx.CountRefusedScanAttemptsAsync()).Should().Be(refusedBefore);
    }

    [Fact]
    public async Task Present_WhenAlwaysAuthFailed_ShortCircuitsUntilReset()
    {
        _fx.SetSimulatorFailureMode(_fx.VirtualReaderId, SimulatorFailureMode.AlwaysAuthFailed);
        var visitId = await SeedVisitorCredentialAsync();

        var client = PorteiroClient();
        var failing = await client.PostAsJsonAsync(
            $"/api/v1/_internal/devices/{_fx.VirtualReaderId}/simulator/present-credential",
            new PresentCredentialRequest(visitId.ToString("D"), "exit"));
        failing.StatusCode.Should().Be(HttpStatusCode.OK);
        (await failing.Content.ReadFromJsonAsync<SimulatedPresentationResultDto>())!.Outcome
            .Should().Be("auth_failed");

        // Reset/recovery restores normal reads (the next presentation flows
        // through to the canonical ingestion path).
        _fx.SetSimulatorFailureMode(_fx.VirtualReaderId, SimulatorFailureMode.None);
        var recovered = await client.PostAsJsonAsync(
            $"/api/v1/_internal/devices/{_fx.VirtualReaderId}/simulator/present-credential",
            new PresentCredentialRequest(visitId.ToString("D"), "exit"));
        recovered.StatusCode.Should().Be(HttpStatusCode.OK);

        var dto = await recovered.Content.ReadFromJsonAsync<SimulatedPresentationResultDto>();
        dto!.Outcome.Should().Be("matched_dweller"); // Exit: access event, no visit advance
        dto.AccessEventId.Should().NotBeNull();
    }

    [Fact]
    public async Task Present_Anonymous_IsUnauthorized()
    {
        var client = _fx.Factory.CreateClient();
        var response = await client.PostAsJsonAsync(
            $"/api/v1/_internal/devices/{_fx.VirtualReaderId}/simulator/present-credential",
            new PresentCredentialRequest(Guid.NewGuid().ToString("D"), "entrance"));
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Readiness_Anonymous_IsUnauthorized()
    {
        var client = _fx.Factory.CreateClient();
        var response = await client.GetAsync($"/api/v1/_internal/devices/{_fx.VirtualReaderId}/simulator/readiness");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Readiness_WhenDoorIntegrationDisabled_ReportsDisabledInsteadOfReady()
    {
        await _fx.SetDoorIntegrationEnabledAsync(false);
        try
        {
            var client = PorteiroClient();
            var response = await client.GetAsync($"/api/v1/_internal/devices/{_fx.VirtualReaderId}/simulator/readiness");
            response.StatusCode.Should().Be(HttpStatusCode.OK);

            var readiness = await response.Content.ReadFromJsonAsync<SimulatorDeviceReadinessDto>();
            readiness!.Ready.Should().BeFalse();
            readiness.Reason.Should().Be("door_integration_disabled");
        }
        finally
        {
            await _fx.SetDoorIntegrationEnabledAsync(true);
        }
    }

    [Fact]
    public async Task Readiness_PlainVendorReader_ReportsNotASimulator()
    {
        // A physical (non-simulator) reader device must not be presentable
        // through the dev surface even when otherwise ready.
        var thirdPartyReaderId = Guid.NewGuid();
        await _fx.SeedSecondDeviceAsync(newDeviceId: thirdPartyReaderId, vendor: "Intelbras");

        var client = PorteiroClient();
        var response = await client.GetAsync($"/api/v1/_internal/devices/{thirdPartyReaderId}/simulator/readiness");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var readiness = await response.Content.ReadFromJsonAsync<SimulatorDeviceReadinessDto>();
        readiness!.Ready.Should().BeFalse();
        readiness.Reason.Should().Be("not_a_simulator");
    }

    [Fact]
    public async Task EnqueueOffline_Drain_Repost_PassesStrictDirectionValidation()
    {
        // Full offline-queue roundtrip: enqueue card_read payloads (the
        // inspector builds them with a strict direction), drain them via the
        // queue endpoint, and re-POST the drained payloads to the ingestion
        // endpoint — proving the drained payload_json passes the strict
        // direction validation instead of dying with 400.
        var deviceEventsBefore = await _fx.CountDeviceEventsAsync();

        var client = PorteiroClient();
        var enqueue = await client.PostAsJsonAsync(
            $"/api/v1/_internal/devices/{_fx.DeviceId}/simulator/enqueue-offline",
            new EnqueueOfflineEventsRequest(Count: 2, FromSequence: 7000));
        enqueue.StatusCode.Should().Be(HttpStatusCode.OK);

        var drain = await client.GetAsync($"/api/v1/_internal/devices/{_fx.DeviceId}/simulator/queue");
        drain.StatusCode.Should().Be(HttpStatusCode.OK);
        var drained = await drain.Content.ReadFromJsonAsync<List<DeviceEventPayload>>();
        drained.Should().NotBeNull();
        drained!.Should().HaveCount(2);

        foreach (var payload in drained!)
        {
            var response = await client.PostAsJsonAsync($"/api/v1/devices/{_fx.DeviceId}/events", payload);
            response.StatusCode.Should().Be(HttpStatusCode.OK);

            var dto = await response.Content.ReadFromJsonAsync<DeviceEventIngestionDto>();
            dto!.Outcome.Should().Be("denied_attempt"); // sim-test token → canonical refusal
        }

        // Each drained event produced exactly one ledger row.
        (await _fx.CountDeviceEventsAsync()).Should().Be(deviceEventsBefore + 2);
    }

    [Fact]
    public async Task Present_NonReaderDevice_IsRejected()
    {
        var client = PorteiroClient();
        var response = await client.PostAsJsonAsync(
            $"/api/v1/_internal/devices/{_fx.DeviceId}/simulator/present-credential",
            new PresentCredentialRequest(Guid.NewGuid().ToString("D"), "entrance"));
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}

internal sealed record SimulatorDeviceReadinessDto(
    bool Ready,
    string? Reason,
    string Vendor,
    Guid? GatehouseId,
    string? GatehouseName);

internal sealed record SimulatedPresentationResultDto(
    string Outcome,
    string? FailureCode,
    string Direction,
    Guid? ExistingEventId,
    Guid? VisitId,
    Guid? AccessEventId,
    Guid? RefusalId,
    DateTime OccurredAtUtc,
    DateTime ProcessedAtUtc);

internal static class HttpClientDeviceExtensions
{
    public static HttpClient WithBearerToken(this HttpClient client, string token)
    {
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
}
