using System.Net;
using System.Net.Http.Json;
using ControlEasyReborn.Modules.AccessControl.Application.Contracts;
using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;
using ControlEasyReborn.Modules.AccessControl.Infrastructure.Services;
using FluentAssertions;
using MySqlConnector;
using Xunit;

namespace ControlEasyReborn.IntegrationTests;

[Collection("MySql Collection")]
public sealed class VisitorScanVisitUnificationTests
{
    private const string TestHmacKey = "CE-INT-TEST-ACCESS-CONTROL-HMAC-KEY-v1-DETERMINISTIC-32BYTES";
    private readonly MySqlContainerFixture _mySql;

    public VisitorScanVisitUnificationTests(MySqlContainerFixture mySql)
    {
        _mySql = mySql;
    }

    private TestcontainersWebApplicationFactory NewFactory() => new(_mySql);

    private static Guid NewTenantId() => Guid.NewGuid();

    [Fact]
    public async Task Unmatched_visitor_scan_creates_exactly_one_checked_in_visit()
    {
        var tenantId = NewTenantId();
        var block = "U" + Guid.NewGuid().ToString("N")[..6];
        var unit = Guid.NewGuid().ToString("N")[..6];
        var apartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, block, unit);

        var hmacKey = System.Text.Encoding.UTF8.GetBytes(TestHmacKey);
        var issuer = new OpaqueTokenIssuer();
        var issued = issuer.Issue(hmacKey);

        // Unmatched: visitor credential whose SubjectId points at NO Visit row
        // (standalone visitor credential). The Visit row must be created from
        // the scan-payload profile, landing directly CheckedIn.
        var visitorSubjectId = Guid.NewGuid();
        var visitorName = "Scan Visitor " + Guid.NewGuid().ToString("N")[..6];
        var document = Guid.NewGuid().ToString("N")[..11];

        await AccessControlFixture.SeedActiveCredentialAsync(
            _mySql.ConnectionString,
            tenantId,
            SubjectType.Visitor,
            visitorSubjectId,
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
            GatehouseId: null,
            ConfirmDuplicate: false,
            VisitorName: visitorName,
            VisitorDocument: document);

        var response = await client.PostAsJsonAsync("/api/v1/access-events/scans", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ScanResponse>();
        body!.SubjectType.Should().Be("visitor");

        var (visitCount, checkedInAt, status) = await CountVisitsByDocumentAsync(tenantId, document);
        visitCount.Should().Be(1, "unmatched visitor scan must produce exactly one Visit row");
        status.Should().Be(1, "the new Visit row must land directly CheckedIn");
        checkedInAt.Should().NotBeNull();
        var eventCount = await CountAccessEventsAsync(tenantId, scanAttemptId);
        eventCount.Should().Be(1, "the scan records one AccessEvent in the same request cycle");
        _ = apartmentId;
    }

    [Fact]
    public async Task Duplicate_visitor_scan_with_new_attempt_id_is_idempotent()
    {
        var tenantId = NewTenantId();
        var block = "U" + Guid.NewGuid().ToString("N")[..6];
        var unit = Guid.NewGuid().ToString("N")[..6];
        var apartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, block, unit);

        var hmacKey = System.Text.Encoding.UTF8.GetBytes(TestHmacKey);
        var issuer = new OpaqueTokenIssuer();
        var issued = issuer.Issue(hmacKey);

        var visitorSubjectId = Guid.NewGuid();
        var visitorName = "Idem Visitor " + Guid.NewGuid().ToString("N")[..6];
        var document = Guid.NewGuid().ToString("N")[..11];

        await AccessControlFixture.SeedActiveCredentialAsync(
            _mySql.ConnectionString,
            tenantId,
            SubjectType.Visitor,
            visitorSubjectId,
            issued.Verifier,
            issued.KeyVersion,
            Guid.NewGuid());

        var factory = NewFactory();
        var client = QrScanTestClient.ForTenant(factory, tenantId);

        var first = new RecordAccessScanRequest(
            QrPayload: issued.Token,
            Direction: "entrance",
            ScanAttemptId: Guid.NewGuid(),
            GatehouseId: null,
            ConfirmDuplicate: false,
            VisitorName: visitorName,
            VisitorDocument: document);
        var firstResponse = await client.PostAsJsonAsync("/api/v1/access-events/scans", first);
        firstResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        // Re-scan by the same visitor while their latest Visit is still CheckedIn:
        // no second Visit row is created (idempotent), but a new AccessEvent is recorded.
        var second = new RecordAccessScanRequest(
            QrPayload: issued.Token,
            Direction: "entrance",
            ScanAttemptId: Guid.NewGuid(),
            GatehouseId: null,
            ConfirmDuplicate: false,
            VisitorName: visitorName,
            VisitorDocument: document);
        var secondResponse = await client.PostAsJsonAsync("/api/v1/access-events/scans", second);
        secondResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var (visitCount, _, _) = await CountVisitsByDocumentAsync(tenantId, document);
        visitCount.Should().Be(1, "re-scan while CheckedIn must be a no-op for Visits");
        var eventCount = await CountAccessEventsForVisitorAsync(tenantId, visitorSubjectId);
        eventCount.Should().Be(2, "each scan attempt still records its own AccessEvent");
        _ = apartmentId;
    }

    [Fact]
    public async Task Resident_scan_creates_no_visit_rows()
    {
        var tenantId = NewTenantId();
        var block = "U" + Guid.NewGuid().ToString("N")[..6];
        var unit = Guid.NewGuid().ToString("N")[..6];
        var apartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, block, unit);
        var residentId = await AccessControlFixture.SeedActiveResidentAsync(_mySql.ConnectionString, tenantId, "Res NoVisit", Guid.NewGuid().ToString("N")[..11], apartmentId);

        var hmacKey = System.Text.Encoding.UTF8.GetBytes(TestHmacKey);
        var issuer = new OpaqueTokenIssuer();
        var issued = issuer.Issue(hmacKey);

        await AccessControlFixture.SeedActiveCredentialAsync(
            _mySql.ConnectionString,
            tenantId,
            SubjectType.Resident,
            residentId,
            issued.Verifier,
            issued.KeyVersion,
            Guid.NewGuid());

        var beforeVisits = await CountTenantVisitsAsync(tenantId);

        var factory = NewFactory();
        var client = QrScanTestClient.ForTenant(factory, tenantId);
        var request = new RecordAccessScanRequest(
            QrPayload: issued.Token,
            Direction: "entrance",
            ScanAttemptId: Guid.NewGuid(),
            GatehouseId: null,
            ConfirmDuplicate: false);

        var response = await client.PostAsJsonAsync("/api/v1/access-events/scans", request);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var afterVisits = await CountTenantVisitsAsync(tenantId);
        afterVisits.Should().Be(beforeVisits, "resident/vehicle scans must not create Visit rows");
    }

    private async Task<(int Count, DateTime? CheckedInAt, int? Status)> CountVisitsByDocumentAsync(Guid tenantId, string document)
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "SELECT COUNT(*), MAX(CheckedInAtUtc), MAX(Status) FROM Visits WHERE tenant_id = @tid AND REPLACE(REPLACE(VisitorDocument, '.', ''), '-', '') = @doc", conn);
        cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
        cmd.Parameters.AddWithValue("@doc", document);
        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            return (0, null, 0);
        }
        var count = Convert.ToInt32(reader.GetValue(0));
        DateTime? checkedInAt = reader.IsDBNull(1) ? null : Convert.ToDateTime(reader.GetValue(1));
        var status = reader.IsDBNull(2) ? 0 : Convert.ToInt32(reader.GetValue(2));
        return (count, checkedInAt, status);
    }

    private async Task<int> CountAccessEventsAsync(Guid tenantId, Guid scanAttemptId)
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "SELECT COUNT(*) FROM AccessEvents WHERE tenant_id = @tid AND ScanAttemptId = @sa", conn);
        cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
        cmd.Parameters.AddWithValue("@sa", scanAttemptId.ToString());
        return Convert.ToInt32(await cmd.ExecuteScalarAsync());
    }

    private async Task<int> CountAccessEventsForVisitorAsync(Guid tenantId, Guid subjectId)
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "SELECT COUNT(*) FROM AccessEvents WHERE tenant_id = @tid AND SubjectId = @sid", conn);
        cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
        cmd.Parameters.AddWithValue("@sid", subjectId.ToString());
        return Convert.ToInt32(await cmd.ExecuteScalarAsync());
    }

    private async Task<int> CountTenantVisitsAsync(Guid tenantId)
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "SELECT COUNT(*) FROM Visits WHERE tenant_id = @tid", conn);
        cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
        return Convert.ToInt32(await cmd.ExecuteScalarAsync());
    }

    private static class QrScanTestClient
    {
        public static HttpClient ForTenant(TestcontainersWebApplicationFactory factory, Guid tenantId)
        {
            var token = JwtTestHelper.GenerateTenantToken(
                userId: Guid.NewGuid(),
                email: $"visitor-uni-{tenantId}@controleasy.local",
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