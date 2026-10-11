using System.Net;
using System.Net.Http.Json;
using ControlEasyReborn.Modules.AccessControl.Application.Contracts;
using ControlEasyReborn.Modules.AccessControl.Infrastructure.Services;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.IntegrationTests;

[Collection("MySql Collection")]
public sealed class VehicleScanEndpointsTests
{
    private const string TestHmacKey = "CE-INT-TEST-ACCESS-CONTROL-HMAC-KEY-v1-DETERMINISTIC-32BYTES";
    private readonly MySqlContainerFixture _mySql;

    public VehicleScanEndpointsTests(MySqlContainerFixture mySql)
    {
        _mySql = mySql;
    }

    private TestcontainersWebApplicationFactory NewFactory() => new(_mySql);

    private static Guid NewTenantId() => Guid.NewGuid();

    [Fact]
    public async Task PostScan_active_vehicle_with_owner_resident_prefers_owner_apartment()
    {
        var tenantId = NewTenantId();
        var gatehouseId = await AccessControlFixture.SeedGatehouseAsync(_mySql.ConnectionString, tenantId);
        var ownerApartmentBlock = "O" + Guid.NewGuid().ToString("N")[..6];
        var ownerApartmentUnit = Guid.NewGuid().ToString("N")[..6];
        var ownerApartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, ownerApartmentBlock, ownerApartmentUnit);

        var vehicleApartmentBlock = "V" + Guid.NewGuid().ToString("N")[..6];
        var vehicleApartmentUnit = Guid.NewGuid().ToString("N")[..6];
        var vehicleApartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, vehicleApartmentBlock, vehicleApartmentUnit);

        var ownerResidentId = await AccessControlFixture.SeedActiveResidentAsync(
            _mySql.ConnectionString, tenantId, "Owner", Guid.NewGuid().ToString("N")[..11], ownerApartmentId);

        var vehicleId = await AccessControlFixture.SeedActiveVehicleAsync(
            _mySql.ConnectionString, tenantId, Guid.NewGuid().ToString("N")[..7].ToUpperInvariant(), vehicleApartmentId, ownerResidentId);

        var hmacKey = System.Text.Encoding.UTF8.GetBytes(TestHmacKey);
        var issuer = new OpaqueTokenIssuer();
        var issued = issuer.Issue(hmacKey);

        await AccessControlFixture.SeedActiveCredentialAsync(
            _mySql.ConnectionString,
            tenantId,
            ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects.SubjectType.Vehicle,
            vehicleId,
            issued.Verifier,
            issued.KeyVersion,
            Guid.NewGuid());

        var factory = NewFactory();
        var client = QrScanTestClient.ForTenant(factory, tenantId);
        var request = new RecordAccessScanRequest(
            QrPayload: issued.Token,
            Direction: "entrance",
            ScanAttemptId: Guid.NewGuid(),
            GatehouseId: gatehouseId,
            ConfirmDuplicate: false);

        var response = await client.PostAsJsonAsync("/api/v1/access-events/scans", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ScanResponse>();
        body.Should().NotBeNull();
        body!.Decision.Should().Be("recorded");
        body.SubjectType.Should().Be("vehicle");
        body.SubjectId.Should().Be(vehicleId);
        body.DestinationApartmentId.Should().Be(ownerApartmentId);
        body.DestinationBlock.Should().Be(ownerApartmentBlock);
        body.DestinationUnit.Should().Be(ownerApartmentUnit);
    }

    [Fact]
    public async Task PostScan_active_vehicle_without_owner_falls_back_to_vehicle_apartment()
    {
        var tenantId = NewTenantId();
        var gatehouseId = await AccessControlFixture.SeedGatehouseAsync(_mySql.ConnectionString, tenantId);
        var vehicleApartmentBlock = "X" + Guid.NewGuid().ToString("N")[..6];
        var vehicleApartmentUnit = Guid.NewGuid().ToString("N")[..6];
        var vehicleApartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, vehicleApartmentBlock, vehicleApartmentUnit);

        var vehicleId = await AccessControlFixture.SeedActiveVehicleAsync(
            _mySql.ConnectionString, tenantId, Guid.NewGuid().ToString("N")[..7].ToUpperInvariant(), vehicleApartmentId, ownerResidentId: null);

        var hmacKey = System.Text.Encoding.UTF8.GetBytes(TestHmacKey);
        var issuer = new OpaqueTokenIssuer();
        var issued = issuer.Issue(hmacKey);

        await AccessControlFixture.SeedActiveCredentialAsync(
            _mySql.ConnectionString,
            tenantId,
            ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects.SubjectType.Vehicle,
            vehicleId,
            issued.Verifier,
            issued.KeyVersion,
            Guid.NewGuid());

        var factory = NewFactory();
        var client = QrScanTestClient.ForTenant(factory, tenantId);
        var request = new RecordAccessScanRequest(
            QrPayload: issued.Token,
            Direction: "entrance",
            ScanAttemptId: Guid.NewGuid(),
            GatehouseId: gatehouseId,
            ConfirmDuplicate: false);

        var response = await client.PostAsJsonAsync("/api/v1/access-events/scans", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ScanResponse>();
        body.Should().NotBeNull();
        body!.DestinationApartmentId.Should().Be(vehicleApartmentId);
        body.DestinationBlock.Should().Be(vehicleApartmentBlock);
        body.DestinationUnit.Should().Be(vehicleApartmentUnit);
    }

    [Fact]
    public async Task PostScan_deactivated_vehicle_records_refused_vehicle_inactive()
    {
        var tenantId = NewTenantId();
        var gatehouseId = await AccessControlFixture.SeedGatehouseAsync(_mySql.ConnectionString, tenantId);
        var apartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, "X" + Guid.NewGuid().ToString("N")[..6], Guid.NewGuid().ToString("N")[..6]);

        var vehicleId = await AccessControlFixture.SeedActiveVehicleAsync(
            _mySql.ConnectionString, tenantId, Guid.NewGuid().ToString("N")[..7].ToUpperInvariant(), apartmentId, ownerResidentId: null);

        var hmacKey = System.Text.Encoding.UTF8.GetBytes(TestHmacKey);
        var issuer = new OpaqueTokenIssuer();
        var issued = issuer.Issue(hmacKey);

        await AccessControlFixture.SeedActiveCredentialAsync(
            _mySql.ConnectionString,
            tenantId,
            ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects.SubjectType.Vehicle,
            vehicleId,
            issued.Verifier,
            issued.KeyVersion,
            Guid.NewGuid());

        await SetVehicleActiveAsync(vehicleId, active: false);

        var factory = NewFactory();
        var client = QrScanTestClient.ForTenant(factory, tenantId);
        var request = new RecordAccessScanRequest(
            QrPayload: issued.Token,
            Direction: "entrance",
            ScanAttemptId: Guid.NewGuid(),
            GatehouseId: gatehouseId,
            ConfirmDuplicate: false);

        var response = await client.PostAsJsonAsync("/api/v1/access-events/scans", request);

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetailsShape>();
        problem.Should().NotBeNull();
        problem!.FailureCode.Should().Be("vehicle_inactive");
    }

    [Fact]
    public async Task PostScan_cross_tenant_vehicle_returns_invalid_credential_without_disclosure()
    {
        var tenantA = NewTenantId();
        var apartmentA = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantA, "Z" + Guid.NewGuid().ToString("N")[..6], Guid.NewGuid().ToString("N")[..6]);
        var ownerA = await AccessControlFixture.SeedActiveResidentAsync(_mySql.ConnectionString, tenantA, "Owner A", Guid.NewGuid().ToString("N")[..11], apartmentA);
        var vehicleA = await AccessControlFixture.SeedActiveVehicleAsync(_mySql.ConnectionString, tenantA, Guid.NewGuid().ToString("N")[..7].ToUpperInvariant(), apartmentA, ownerA);

        var hmacKey = System.Text.Encoding.UTF8.GetBytes(TestHmacKey);
        var issuer = new OpaqueTokenIssuer();
        var issued = issuer.Issue(hmacKey);

        await AccessControlFixture.SeedActiveCredentialAsync(
            _mySql.ConnectionString,
            tenantA,
            ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects.SubjectType.Vehicle,
            vehicleA,
            issued.Verifier,
            issued.KeyVersion,
            Guid.NewGuid());

        var tenantB = NewTenantId();
        var gatehouseId = await AccessControlFixture.SeedGatehouseAsync(_mySql.ConnectionString, tenantB);
        var factory = NewFactory();
        var client = QrScanTestClient.ForTenant(factory, tenantB);
        var request = new RecordAccessScanRequest(
            QrPayload: issued.Token,
            Direction: "entrance",
            ScanAttemptId: Guid.NewGuid(),
            GatehouseId: gatehouseId,
            ConfirmDuplicate: false);

        var response = await client.PostAsJsonAsync("/api/v1/access-events/scans", request);

        response.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetailsShape>();
        problem.Should().NotBeNull();
        problem!.FailureCode.Should().Be("invalid_credential");

        await AssertNoAccessEventForTenantAsync(tenantB, scanAttemptId: request.ScanAttemptId);
    }

    private async Task SetVehicleActiveAsync(Guid vehicleId, bool active)
    {
        await using var conn = new MySqlConnector.MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlConnector.MySqlCommand(
            "UPDATE Vehicles SET Active = @active, UpdatedAtUtc = UTC_TIMESTAMP(6) WHERE Id = @id", conn);
        cmd.Parameters.AddWithValue("@active", active ? 1 : 0);
        cmd.Parameters.AddWithValue("@id", vehicleId.ToString());
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task AssertNoAccessEventForTenantAsync(Guid tenantId, Guid scanAttemptId)
    {
        await using var conn = new MySqlConnector.MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlConnector.MySqlCommand(
            "SELECT COUNT(*) FROM AccessEvents WHERE tenant_id = @tid AND ScanAttemptId = @sa", conn);
        cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
        cmd.Parameters.AddWithValue("@sa", scanAttemptId.ToString());
        var count = Convert.ToInt32(await cmd.ExecuteScalarAsync());
        count.Should().Be(0, "no AccessEvent may be persisted for a cross-tenant refusal");
    }

    private sealed record ProblemDetailsShape(string? FailureCode);

    private static class QrScanTestClient
    {
        public static HttpClient ForTenant(TestcontainersWebApplicationFactory factory, Guid tenantId)
        {
            var token = JwtTestHelper.GenerateTenantToken(
                userId: Guid.NewGuid(),
                email: $"vehicle-test-{tenantId}@controleasy.local",
                tenantId: tenantId,
                roles: new[] { "GatehouseOperator" },
                permissions: new[] { "Access.Access.Operate", "Access.Read" });
            var client = factory.CreateClient();
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            return client;
        }
    }
}
