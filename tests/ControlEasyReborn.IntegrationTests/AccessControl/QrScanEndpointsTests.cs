using System.Net;
using System.Net.Http.Json;
using ControlEasyReborn.Modules.AccessControl.Application.Contracts;
using ControlEasyReborn.Modules.AccessControl.Infrastructure.Services;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.IntegrationTests;

[Collection("MySql Collection")]
public sealed class QrScanEndpointsTests
{
    private const string TestHmacKey = "CE-INT-TEST-ACCESS-CONTROL-HMAC-KEY-v1-DETERMINISTIC-32BYTES";
    private readonly MySqlContainerFixture _mySql;

    public QrScanEndpointsTests(MySqlContainerFixture mySql)
    {
        _mySql = mySql;
    }

    private TestcontainersWebApplicationFactory NewFactory() => new(_mySql);

    private static Guid NewTenantId() => Guid.NewGuid();

    [Fact]
    public async Task PostScan_resident_qr_success_records_event_with_destination_snapshot()
    {
        var tenantId = NewTenantId();
        var gatehouseId = await AccessControlFixture.SeedGatehouseAsync(_mySql.ConnectionString, tenantId);
        var block = "Z" + Guid.NewGuid().ToString("N")[..6];
        var unit = Guid.NewGuid().ToString("N")[..6];
        var apartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, block, unit);
        var residentId = await AccessControlFixture.SeedActiveResidentAsync(_mySql.ConnectionString, tenantId, "Maria QR", Guid.NewGuid().ToString("N")[..11], apartmentId);

        var hmacKey = System.Text.Encoding.UTF8.GetBytes(TestHmacKey);
        var issuer = new OpaqueTokenIssuer();
        var issued = issuer.Issue(hmacKey);

        var credentialId = await AccessControlFixture.SeedActiveCredentialAsync(
            _mySql.ConnectionString,
            tenantId,
            ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects.SubjectType.Resident,
            residentId,
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
        body.SubjectType.Should().Be("resident");
        body.SubjectId.Should().Be(residentId);
        body.CredentialId.Should().Be(credentialId);
        body.DestinationApartmentId.Should().Be(apartmentId);
        body.DestinationBlock.Should().Be(block);
        body.DestinationUnit.Should().Be(unit);
        body.Direction.Should().Be("entrance");
        body.PolicyOutcome.Should().Be("permit");
        body.AccessMethod.Should().Be("qr");
    }

    [Fact]
    public async Task PostScan_revoked_credential_records_refused_attempt_with_credential_inactive_code()
    {
        var tenantId = NewTenantId();
        var gatehouseId = await AccessControlFixture.SeedGatehouseAsync(_mySql.ConnectionString, tenantId);
        var apartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, "Z" + Guid.NewGuid().ToString("N")[..6], Guid.NewGuid().ToString("N")[..6]);
        var residentId = await AccessControlFixture.SeedActiveResidentAsync(_mySql.ConnectionString, tenantId, "Maria R", Guid.NewGuid().ToString("N")[..11], apartmentId);

        var hmacKey = System.Text.Encoding.UTF8.GetBytes(TestHmacKey);
        var issuer = new OpaqueTokenIssuer();
        var issued = issuer.Issue(hmacKey);

        var credentialId = await AccessControlFixture.SeedActiveCredentialAsync(
            _mySql.ConnectionString,
            tenantId,
            ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects.SubjectType.Resident,
            residentId,
            issued.Verifier,
            issued.KeyVersion,
            Guid.NewGuid());

        await SetCredentialStatusAsync(credentialId, (int)ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects.CredentialStatus.Revoked);

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
        problem!.FailureCode.Should().Be("credential_inactive");

        await AssertRefusedScanAttemptExistsAsync(tenantId, request.ScanAttemptId);
    }

    [Fact]
    public async Task PostScan_duplicate_scan_attempt_returns_same_decision_idempotently()
    {
        var tenantId = NewTenantId();
        var gatehouseId = await AccessControlFixture.SeedGatehouseAsync(_mySql.ConnectionString, tenantId);
        var apartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, "Z" + Guid.NewGuid().ToString("N")[..6], Guid.NewGuid().ToString("N")[..6]);
        var residentId = await AccessControlFixture.SeedActiveResidentAsync(_mySql.ConnectionString, tenantId, "Maria D", Guid.NewGuid().ToString("N")[..11], apartmentId);

        var hmacKey = System.Text.Encoding.UTF8.GetBytes(TestHmacKey);
        var issuer = new OpaqueTokenIssuer();
        var issued = issuer.Issue(hmacKey);

        await AccessControlFixture.SeedActiveCredentialAsync(
            _mySql.ConnectionString,
            tenantId,
            ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects.SubjectType.Resident,
            residentId,
            issued.Verifier,
            issued.KeyVersion,
            Guid.NewGuid());

        var factory = NewFactory();
        var client = QrScanTestClient.ForTenant(factory, tenantId);
        var scanAttemptId = Guid.NewGuid();
        var request = new RecordAccessScanRequest(
            QrPayload: issued.Token,
            Direction: "entrance",
            ScanAttemptId: scanAttemptId,
            GatehouseId: gatehouseId,
            ConfirmDuplicate: false);

        var first = await client.PostAsJsonAsync("/api/v1/access-events/scans", request);
        first.StatusCode.Should().Be(HttpStatusCode.OK);
        var firstBody = await first.Content.ReadFromJsonAsync<ScanResponse>();
        firstBody.Should().NotBeNull();
        firstBody!.Decision.Should().Be("recorded");

        var second = await client.PostAsJsonAsync("/api/v1/access-events/scans", request);
        second.StatusCode.Should().Be(HttpStatusCode.OK);
        var secondBody = await second.Content.ReadFromJsonAsync<ScanResponse>();
        secondBody.Should().NotBeNull();
        secondBody!.AccessEventId.Should().Be(firstBody.AccessEventId);
    }

    [Fact]
    public async Task PostScan_cross_tenant_credential_returns_invalid_credential_without_disclosure()
    {
        var tenantA = NewTenantId();
        var apartmentA = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantA, "Z" + Guid.NewGuid().ToString("N")[..6], Guid.NewGuid().ToString("N")[..6]);
        var residentA = await AccessControlFixture.SeedActiveResidentAsync(_mySql.ConnectionString, tenantA, "Tenant A Res", Guid.NewGuid().ToString("N")[..11], apartmentA);

        var hmacKey = System.Text.Encoding.UTF8.GetBytes(TestHmacKey);
        var issuer = new OpaqueTokenIssuer();
        var issued = issuer.Issue(hmacKey);

        await AccessControlFixture.SeedActiveCredentialAsync(
            _mySql.ConnectionString,
            tenantA,
            ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects.SubjectType.Resident,
            residentA,
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

    [Fact]
    public async Task PostScan_foreign_gatehouse_returns_bad_request_without_persisting_event()
    {
        var tenantA = NewTenantId();
        var foreignGatehouseId = await AccessControlFixture.SeedGatehouseAsync(_mySql.ConnectionString, tenantA);
        var tenantB = NewTenantId();
        var scanAttemptId = Guid.NewGuid();
        var client = QrScanTestClient.ForTenant(NewFactory(), tenantB);

        var response = await client.PostAsJsonAsync("/api/v1/access-events/scans", new RecordAccessScanRequest(
            QrPayload: Guid.NewGuid().ToString(),
            Direction: "entrance",
            ScanAttemptId: scanAttemptId,
            GatehouseId: foreignGatehouseId,
            ConfirmDuplicate: false));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        await AssertNoAccessEventForTenantAsync(tenantB, scanAttemptId);
    }

    private async Task SetCredentialStatusAsync(Guid credentialId, int statusValue)
    {
        await using var conn = new MySqlConnector.MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlConnector.MySqlCommand(
            "UPDATE AccessCredentials SET Status = @status, UpdatedAtUtc = UTC_TIMESTAMP(6) WHERE Id = @id", conn);
        cmd.Parameters.AddWithValue("@status", statusValue);
        cmd.Parameters.AddWithValue("@id", credentialId.ToString());
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task AssertRefusedScanAttemptExistsAsync(Guid tenantId, Guid scanAttemptId)
    {
        await using var conn = new MySqlConnector.MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlConnector.MySqlCommand(
            "SELECT COUNT(*) FROM RefusedScanAttempts WHERE tenant_id = @tid AND ScanAttemptId = @sa", conn);
        cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
        cmd.Parameters.AddWithValue("@sa", scanAttemptId.ToString());
        var count = Convert.ToInt32(await cmd.ExecuteScalarAsync());
        count.Should().BeGreaterThan(0, "refused scan attempt must be persisted for refusal code responses");
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
                email: $"qr-test-{tenantId}@controleasy.local",
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
