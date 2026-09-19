using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ControlEasyReborn.Modules.AccessControl.Application.Contracts;
using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;
using ControlEasyReborn.Modules.AccessControl.Infrastructure.Services;
using ControlEasyReborn.Modules.Apartments.Application.Contracts;
using ControlEasyReborn.Modules.Reports.Application.Contracts;
using ControlEasyReborn.Modules.Residents.Application.Contracts;
using ControlEasyReborn.Modules.Visits.Application.Contracts;
using FluentAssertions;
using MySqlConnector;
using Xunit;

namespace ControlEasyReborn.IntegrationTests;

[Collection("MySql Collection")]
public sealed class ReportEndpointTests
{
    private const string TestHmacKey = "CE-INT-TEST-ACCESS-CONTROL-HMAC-KEY-v1-DETERMINISTIC-32BYTES";
    private readonly TestcontainersWebApplicationFactory _factory;
    private readonly MySqlContainerFixture _mySql;

    public ReportEndpointTests(MySqlContainerFixture mySql)
    {
        _mySql = mySql;
        _factory = new TestcontainersWebApplicationFactory(mySql);
    }

    [Fact]
    public async Task GetVisitCountsByDay_ReturnsAggregatedRows()
    {
        var client = _factory.AsTenantA();
        var apartmentId = await _factory.SeedApartmentForTenantAAsync();

        var createResponse = await client.PostAsJsonAsync("/api/v1/visits",
            new CreateVisitRequest("Report Visitor", "11122233344", null, apartmentId, "Test"));
        createResponse.EnsureSuccessStatusCode();

        var response = await client.GetAsync("/api/v1/reports/visit-counts-by-day");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<List<VisitCountByDayResponse>>();
        body.Should().NotBeNull();
        body!.Should().NotBeEmpty();
    }

    [Fact]
    public async Task CrossTenant_GetResidentsPerApartment_AsDifferentTenant_ReturnsEmptyForForeignData()
    {
        var clientA = _factory.AsTenantA();
        var clientB = _factory.AsTenantB();
        var apartmentId = Guid.NewGuid();

        await clientA.PostAsJsonAsync("/api/v1/residents", new CreateResidentRequest(
            Name: "Apartment Resident",
            Cpf: "39053344705",
            Email: null,
            Phone: null,
            ApartmentId: apartmentId));

        var responseB = await clientB.GetAsync("/api/v1/reports/residents-per-apartment");
        responseB.StatusCode.Should().Be(HttpStatusCode.OK);

        var bodyB = await responseB.Content.ReadFromJsonAsync<List<ResidentsPerApartmentResponse>>();
        bodyB.Should().NotBeNull();
        bodyB!.Should().NotContain(x => x.ApartmentId == apartmentId);
    }

    [Fact]
    public async Task DashboardStats_OccupiedApartments_IsTenantScoped()
    {
        var clientA = _factory.AsTenantA();
        var clientB = _factory.AsTenantB();
        var suffix = Guid.NewGuid().ToString("N")[..8];

        var beforeA = await clientA.GetFromJsonAsync<DashboardStatsResponse>("/api/v1/dashboard/stats");
        var beforeB = await clientB.GetFromJsonAsync<DashboardStatsResponse>("/api/v1/dashboard/stats");

        var apartmentResponse = await clientA.PostAsJsonAsync(
            "/api/v1/apartments",
            new CreateApartmentRequest($"T{suffix[..3]}", suffix[3..]));
        apartmentResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var apartment = await apartmentResponse.Content.ReadFromJsonAsync<ApartmentResponse>();

        var residentResponse = await clientA.PostAsJsonAsync(
            "/api/v1/residents",
            new CreateResidentRequest(
                Name: $"Dashboard Resident {suffix}",
                Cpf: GenerateCpf(suffix),
                Email: null,
                Phone: null,
                ApartmentId: apartment!.Id));
        residentResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var afterA = await clientA.GetFromJsonAsync<DashboardStatsResponse>("/api/v1/dashboard/stats");
        var afterB = await clientB.GetFromJsonAsync<DashboardStatsResponse>("/api/v1/dashboard/stats");

        afterA!.OccupiedApartments.Should().Be(beforeA!.OccupiedApartments + 1);
        afterB!.OccupiedApartments.Should().Be(beforeB!.OccupiedApartments);
    }

    [Fact]
    public async Task DashboardStats_ConsentAuditRowsAreNotDoubleCounted()
    {
        var client = _factory.AsTenantA();
        var before = await client.GetFromJsonAsync<DashboardStatsResponse>("/api/v1/dashboard/stats");

        // A legacy consent-audit row that used to be double-added into
        // OpenVisits/TodayVisits by the dashboard read model (refusal rows carry
        // no photo by design, so the DB check constraint is satisfied).
        var tenantId = TenantAwareWebApplicationFactory.TenantAId;
        var entryLogId = Guid.NewGuid();
        await using (var conn = new MySqlConnector.MySqlConnection(_mySql.ConnectionString))
        {
            await conn.OpenAsync();
            var insertSql = @"
                INSERT INTO ConsentAuditLog (Id, TenantId, EntryState, OverrideReason, PhotoId, SubjectType, SubjectName, SubjectDocument, PerformedByProfileId, RecordedAt, tenant_id)
                VALUES (@Id, @TenantId, 'entered_without_consent', NULL, NULL, 'visitor', 'Double Count Probe', '12345678901', NULL, UTC_TIMESTAMP(3), @TenantId);";
            await using var cmd = new MySqlConnector.MySqlCommand(insertSql, conn);
            cmd.Parameters.AddWithValue("@Id", entryLogId.ToString());
            cmd.Parameters.AddWithValue("@TenantId", tenantId.ToString());
            await cmd.ExecuteNonQueryAsync();
        }

        // The same consent row must NOT alter the visit counters.
        var afterConsent = await client.GetFromJsonAsync<DashboardStatsResponse>("/api/v1/dashboard/stats");
        afterConsent!.OpenVisits.Should().Be(before!.OpenVisits);
        afterConsent.TodayVisits.Should().Be(before.TodayVisits);
        afterConsent.RecentVisits.Should().NotContain(v => v.Id == entryLogId);

        // But a real visit does move the counters.
        var apartmentResponse = await client.PostAsJsonAsync(
            "/api/v1/apartments",
            new CreateApartmentRequest($"D{Guid.NewGuid().ToString("N")[..3]}", Guid.NewGuid().ToString("N")[..4]));
        apartmentResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var apartment = await apartmentResponse.Content.ReadFromJsonAsync<ApartmentResponse>();

        var visitResponse = await client.PostAsJsonAsync(
            "/api/v1/visits",
            new CreateVisitRequest(
                VisitorName: "Honest Counter Visit",
                VisitorDocument: GenerateCpf(Guid.NewGuid().ToString("N")[..9]),
                VisitorPhone: null,
                ApartmentId: apartment!.Id,
                Purpose: "visit",
                CheckInNow: true));
        visitResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var afterVisit = await client.GetFromJsonAsync<DashboardStatsResponse>("/api/v1/dashboard/stats");
        afterVisit!.OpenVisits.Should().Be(afterConsent.OpenVisits + 1);
        afterVisit.TodayVisits.Should().Be(afterConsent.TodayVisits + 1);
    }

    private static string GenerateCpf(string suffix)
    {
        var seed = Math.Abs(suffix.GetHashCode()).ToString("D9")[..9];
        var digits = seed.Select(c => c - '0').ToArray();
        var first = CalculateCpfDigit(digits, 10);
        var second = CalculateCpfDigit(digits.Append(first).ToArray(), 11);
        return seed + first + second;
    }

    private static int CalculateCpfDigit(IReadOnlyList<int> digits, int weight)
    {
        var sum = digits.Select((digit, index) => digit * (weight - index)).Sum();
        var remainder = sum % 11;
        return remainder < 2 ? 0 : 11 - remainder;
    }

    // ---------------------------------------------------------------------
    // Unified ledger — GET /api/v1/reports/history (VISIT-04/05, D-03)
    // ---------------------------------------------------------------------

    private static HttpClient ForTenant(TestcontainersWebApplicationFactory factory, Guid tenantId)
    {
        var token = JwtTestHelper.GenerateTenantToken(
            userId: Guid.NewGuid(),
            email: $"history-{tenantId}@controleasy.local",
            tenantId: tenantId,
            roles: new[] { "GatehouseOperator" },
            permissions: new[] { "Access.Access.Operate", "Access.Read" });
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private async Task<Guid> CreateLookupAuditAsync(HttpClient client, Guid tenantId, string cpf, Guid apartmentId)
    {
        _ = tenantId;
        _ = apartmentId;
        var searchRequest = new LookupSubjectRequest(Criterion: "cpf", Value: cpf, Unit: null);
        var searchResponse = await client.PostAsJsonAsync("/api/v1/access-subjects/search", searchRequest);
        searchResponse.EnsureSuccessStatusCode();
        var body = await searchResponse.Content.ReadFromJsonAsync<LookupResponse>();
        return body!.LookupAuditId;
    }

    [Fact]
    public async Task History_returns_visit_package_and_legacy_rows_once_each()
    {
        var tenantId = Guid.NewGuid();
        var block = "H" + Guid.NewGuid().ToString("N")[..6];
        var unit = Guid.NewGuid().ToString("N")[..6];
        var apartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, block, unit);
        var cpf = Guid.NewGuid().ToString("N")[..11];
        await AccessControlFixture.SeedActiveResidentAsync(_mySql.ConnectionString, tenantId, "Hist Res", cpf, apartmentId);

        var client = ForTenant(_factory, tenantId);

        // 1. Walk-in visit (CheckInNow) → 'visit' row.
        var visitResponse = await client.PostAsJsonAsync("/api/v1/visits",
            new CreateVisitRequest("History Walker", "11223344551", null, apartmentId, "Walk-in test", CheckInNow: true));
        visitResponse.EnsureSuccessStatusCode();

        // 2. Package drop (condominium-level) → 'access-event' row with Source=package-drop.
        var lookupAuditId = await CreateLookupAuditAsync(client, tenantId, cpf, apartmentId);
        var dropResponse = await client.PostAsJsonAsync("/api/v1/access-events/manual",
            new RecordManualAccessRequest(
                LookupAuditId: lookupAuditId,
                SubjectType: "visitor",
                SubjectId: Guid.Empty,
                Direction: "entrance",
                GatehouseId: null,
                Kind: "package-drop",
                PackageDescription: "History boxes",
                PackageCarrierCode: "Jadlog"));
        dropResponse.EnsureSuccessStatusCode();

        // 3. Legacy consent row (pre-cutoff, RecordedAt < 2026-09-19) → legacy-entry-log row.
        await SeedLegacyConsentRowAsync(tenantId, "Legacy Subject", recordedAtUtc: new DateTime(2026, 9, 10, 12, 0, 0, DateTimeKind.Utc));
        await SeedLegacyGatehouseOnlyRowAsync(tenantId, "Legacy Gatehouse", recordedAtUtc: new DateTime(2026, 9, 18, 12, 0, 0, DateTimeKind.Utc));

        var response = await client.GetAsync("/api/v1/reports/history?page=1&pageSize=50");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        response.Headers.Contains("X-Total-Count").Should().BeTrue();
        var total = int.Parse(response.Headers.GetValues("X-Total-Count").First());
        total.Should().BeGreaterThanOrEqualTo(4, "the seeded visit, package drop, and two legacy rows must all be counted");

        var rows = await response.Content.ReadFromJsonAsync<List<HistoryRowResponse>>();
        rows.Should().NotBeNull();

        rows!.Should().Contain(r => r.Kind == "visit" && r.SubjectName == "History Walker" && r.NativeState == "CheckedIn");
        rows.Should().Contain(r => r.Kind == "access-event" && r.Source == "package-drop" && r.PackageCarrierCode == "Jadlog" && r.PackageDescription == "History boxes");
        rows.Should().Contain(r => r.Kind == "legacy-entry-log" && r.NativeState == "entered_override");
        rows.Should().Contain(r => r.Kind == "legacy-entry-log" && r.NativeState == "gatehouse_only" && r.DestinationLabel == "Gatehouse");

        // Double-count guard: the walk-in visit appears exactly once as a visit row.
        rows.Count(r => r.Kind == "visit" && r.SubjectName == "History Walker").Should().Be(1);
        // Post-cutoff legacy rows are excluded.
        rows.Should().NotContain(r => r.Kind == "legacy-entry-log" && r.OccurredAt >= new DateTime(2026, 9, 19, 0, 0, 0, DateTimeKind.Utc));
    }

    [Fact]
    public async Task History_carrier_code_filter_returns_only_matching_package_rows()
    {
        var tenantId = Guid.NewGuid();
        var block = "H" + Guid.NewGuid().ToString("N")[..6];
        var unit = Guid.NewGuid().ToString("N")[..6];
        var apartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, block, unit);
        var cpf = Guid.NewGuid().ToString("N")[..11];
        await AccessControlFixture.SeedActiveResidentAsync(_mySql.ConnectionString, tenantId, "Carrier Res", cpf, apartmentId);

        var client = ForTenant(_factory, tenantId);
        var lookupAuditId = await CreateLookupAuditAsync(client, tenantId, cpf, apartmentId);

        await client.PostAsJsonAsync("/api/v1/access-events/manual",
            new RecordManualAccessRequest(lookupAuditId, "visitor", Guid.Empty, "entrance", null, Kind: "package-drop", PackageDescription: "Envelope", PackageCarrierCode: "Loggi"));
        await client.PostAsJsonAsync("/api/v1/access-events/manual",
            new RecordManualAccessRequest(lookupAuditId, "visitor", Guid.Empty, "entrance", null, Kind: "package-drop", PackageDescription: "Box", PackageCarrierCode: "Correios"));

        var response = await client.GetAsync("/api/v1/reports/history?carrierCode=Correios");
        response.EnsureSuccessStatusCode();

        var rows = await response.Content.ReadFromJsonAsync<List<HistoryRowResponse>>();
        rows.Should().NotBeNull();
        rows!.Should().OnlyContain(r => r.Source == "package-drop" && r.PackageCarrierCode == "Correios");
        rows.Should().Contain(r => r.PackageDescription == "Box");
        rows.Should().NotContain(r => r.PackageDescription == "Envelope");
    }

    [Fact]
    public async Task History_refused_scan_shows_failure_code_not_visit_vocabulary()
    {
        var tenantId = Guid.NewGuid();
        var block = "H" + Guid.NewGuid().ToString("N")[..6];
        var unit = Guid.NewGuid().ToString("N")[..6];
        var apartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, block, unit);
        var residentId = await AccessControlFixture.SeedActiveResidentAsync(_mySql.ConnectionString, tenantId, "Refused Res", Guid.NewGuid().ToString("N")[..11], apartmentId);

        var hmacKey = System.Text.Encoding.UTF8.GetBytes(TestHmacKey);
        var issuer = new OpaqueTokenIssuer();
        var issued = issuer.Issue(hmacKey);
        await AccessControlFixture.SeedActiveCredentialAsync(_mySql.ConnectionString, tenantId, SubjectType.Resident, residentId, issued.Verifier, issued.KeyVersion, Guid.NewGuid());

        // Revoke the credential, then scan → refused attempt (credential_inactive).
        await SetCredentialRevokedAsync(tenantId, residentId);

        var scanClient = QrScanTestClient.ForTenant(_factory, tenantId);
        var scanRequest = new RecordAccessScanRequest(
            QrPayload: issued.Token,
            Direction: "entrance",
            ScanAttemptId: Guid.NewGuid(),
            GatehouseId: null,
            ConfirmDuplicate: false);
        var scanResponse = await scanClient.PostAsJsonAsync("/api/v1/access-events/scans", scanRequest);
        scanResponse.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        var client = ForTenant(_factory, tenantId);
        var response = await client.GetAsync("/api/v1/reports/history?status=credential_inactive");
        response.EnsureSuccessStatusCode();

        var rows = await response.Content.ReadFromJsonAsync<List<HistoryRowResponse>>();
        rows.Should().NotBeNull();
        rows!.Should().Contain(r => r.Kind == "refused-scan" && r.NativeState == "credential_inactive");
        // Refused rows never carry a VisitStatus vocabulary value.
        rows.Where(r => r.Kind == "refused-scan")
            .Should().OnlyContain(r => r.NativeState != "Pending" && r.NativeState != "CheckedIn" && r.NativeState != "CheckedOut" && r.NativeState != "Cancelled");
    }

    [Fact]
    public async Task History_pagination_slices_with_total_count()
    {
        var tenantId = Guid.NewGuid();
        var block = "H" + Guid.NewGuid().ToString("N")[..6];
        var unit = Guid.NewGuid().ToString("N")[..6];
        var apartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, block, unit);

        var client = ForTenant(_factory, tenantId);
        for (var i = 0; i < 3; i++)
        {
            await client.PostAsJsonAsync("/api/v1/visits",
                new CreateVisitRequest($"Pager {i}", $"1020304{i:D5}", null, apartmentId, null, CheckInNow: true));
        }

        var page1 = await client.GetAsync("/api/v1/reports/history?page=1&pageSize=2");
        page1.EnsureSuccessStatusCode();
        var rows1 = await page1.Content.ReadFromJsonAsync<List<HistoryRowResponse>>();
        var total = int.Parse(page1.Headers.GetValues("X-Total-Count").First());

        var page2 = await client.GetAsync("/api/v1/reports/history?page=2&pageSize=2");
        var rows2 = await page2.Content.ReadFromJsonAsync<List<HistoryRowResponse>>();
        var emptyPage = await client.GetAsync("/api/v1/reports/history?page=99&pageSize=2");
        var emptyRows = await emptyPage.Content.ReadFromJsonAsync<List<HistoryRowResponse>>();

        rows1.Should().NotBeNull();
        rows2.Should().NotBeNull();
        rows1!.Should().HaveCount(2);
        rows2!.Should().NotBeEmpty();
        rows1!.Concat(rows2!).Select(r => r.Id).Should().OnlyHaveUniqueItems();
        total.Should().BeGreaterThanOrEqualTo(3);
        emptyPage.EnsureSuccessStatusCode();
        emptyRows.Should().BeEmpty();
        int.Parse(emptyPage.Headers.GetValues("X-Total-Count").First()).Should().Be(total);
    }

    [Fact]
    public async Task History_is_tenant_isolated()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var blockA = "H" + Guid.NewGuid().ToString("N")[..6];
        var unitA = Guid.NewGuid().ToString("N")[..6];
        var aptA = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantA, blockA, unitA);

        var clientA = ForTenant(_factory, tenantA);
        var clientB = ForTenant(_factory, tenantB);

        await clientA.PostAsJsonAsync("/api/v1/visits",
            new CreateVisitRequest("Tenant A Only", "55566677788", null, aptA, null, CheckInNow: true));

        var responseB = await clientB.GetAsync("/api/v1/reports/history");
        responseB.EnsureSuccessStatusCode();
        var rowsB = await responseB.Content.ReadFromJsonAsync<List<HistoryRowResponse>>();
        rowsB.Should().NotBeNull();
        rowsB!.Should().NotContain(r => r.SubjectName == "Tenant A Only");
    }

    private async Task SeedLegacyConsentRowAsync(Guid tenantId, string subjectName, DateTime recordedAtUtc)
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "INSERT INTO ConsentAuditLog (Id, TenantId, EntryState, OverrideReason, PhotoId, SubjectType, SubjectName, SubjectDocument, PerformedByProfileId, RecordedAt, tenant_id) " +
            "VALUES (@id, @tid, 'entered_override', 'emergency', NULL, 'visitor', @name, '00000000000', NULL, @recordedAt, @tid)", conn);
        cmd.Parameters.AddWithValue("@id", Guid.NewGuid().ToString());
        cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
        cmd.Parameters.AddWithValue("@name", subjectName);
        cmd.Parameters.AddWithValue("@recordedAt", recordedAtUtc);
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task SeedLegacyGatehouseOnlyRowAsync(Guid tenantId, string subjectName, DateTime recordedAtUtc)
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "INSERT INTO ConsentAuditLog (Id, TenantId, EntryState, OverrideReason, PhotoId, SubjectType, SubjectName, SubjectDocument, PerformedByProfileId, RecordedAt, tenant_id) " +
            "VALUES (@id, @tid, 'gatehouse_only', NULL, NULL, 'service_provider', @name, '00000000000', NULL, @recordedAt, @tid)", conn);
        cmd.Parameters.AddWithValue("@id", Guid.NewGuid().ToString());
        cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
        cmd.Parameters.AddWithValue("@name", subjectName);
        cmd.Parameters.AddWithValue("@recordedAt", recordedAtUtc);
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task SetCredentialRevokedAsync(Guid tenantId, Guid residentId)
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "UPDATE AccessCredentials SET Status = @status WHERE tenant_id = @tid AND SubjectId = @sid", conn);
        cmd.Parameters.AddWithValue("@status", (int)CredentialStatus.Revoked);
        cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
        cmd.Parameters.AddWithValue("@sid", residentId.ToString());
        await cmd.ExecuteNonQueryAsync();
    }

    private static class QrScanTestClient
    {
        public static HttpClient ForTenant(TestcontainersWebApplicationFactory factory, Guid tenantId)
        {
            var token = JwtTestHelper.GenerateTenantToken(
                userId: Guid.NewGuid(),
                email: $"hist-qr-{tenantId}@controleasy.local",
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
