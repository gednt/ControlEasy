using System.Net;
using System.Net.Http.Json;
using ControlEasyReborn.Modules.AccessControl.Application.Contracts;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.IntegrationTests;

[Collection("MySql Collection")]
public sealed class ManualLookupEndpointsTests
{
    private readonly MySqlContainerFixture _mySql;

    public ManualLookupEndpointsTests(MySqlContainerFixture mySql)
    {
        _mySql = mySql;
    }

    private TestcontainersWebApplicationFactory NewFactory() => new(_mySql);

    private static Guid NewTenantId() => Guid.NewGuid();

    [Fact]
    public async Task Search_by_name_too_broad_returns_400_validation()
    {
        var tenantId = NewTenantId();
        var factory = NewFactory();
        var client = ManualLookupTestClient.ForTenant(factory, tenantId);

        var request = new LookupSubjectRequest(Criterion: "name", Value: "Ma", Unit: null);
        var response = await client.PostAsJsonAsync("/api/v1/access-subjects/search", request);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Search_by_cpf_returns_resident_with_masked_document_and_writes_audit()
    {
        var tenantId = NewTenantId();
        var cpf = "12345678901";
        var apartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, "A" + Guid.NewGuid().ToString("N")[..6], Guid.NewGuid().ToString("N")[..6]);
        var residentId = await AccessControlFixture.SeedActiveResidentAsync(_mySql.ConnectionString, tenantId, "Maria Lookup", cpf, apartmentId);

        var factory = NewFactory();
        var client = ManualLookupTestClient.ForTenant(factory, tenantId);
        var request = new LookupSubjectRequest(Criterion: "cpf", Value: cpf, Unit: null);
        var response = await client.PostAsJsonAsync("/api/v1/access-subjects/search", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<LookupResponse>();
        body.Should().NotBeNull();
        body!.Items.Should().HaveCount(1);
        body.Items[0].SubjectId.Should().Be(residentId);
        body.Items[0].DocumentMasked.Should().Be("***8901");
        body.ResultCountBand.Should().Be("1");

        await AssertLookupAuditPersistedAsync(tenantId, body.LookupAuditId);
    }

    [Fact]
    public async Task Manual_access_event_bound_to_lookup_audit_succeeds()
    {
        var tenantId = NewTenantId();
        var gatehouseId = await AccessControlFixture.SeedGatehouseAsync(_mySql.ConnectionString, tenantId);
        var cpf = "98765432100";
        var apartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, "B" + Guid.NewGuid().ToString("N")[..6], Guid.NewGuid().ToString("N")[..6]);
        var residentId = await AccessControlFixture.SeedActiveResidentAsync(_mySql.ConnectionString, tenantId, "Maria Manual", cpf, apartmentId);

        var factory = NewFactory();
        var client = ManualLookupTestClient.ForTenant(factory, tenantId);

        var searchRequest = new LookupSubjectRequest(Criterion: "cpf", Value: cpf, Unit: null);
        var searchResponse = await client.PostAsJsonAsync("/api/v1/access-subjects/search", searchRequest);
        searchResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var searchBody = await searchResponse.Content.ReadFromJsonAsync<LookupResponse>();
        var lookupAuditId = searchBody!.LookupAuditId;

        var manualRequest = new RecordManualAccessRequest(
            LookupAuditId: lookupAuditId,
            SubjectType: "resident",
            SubjectId: residentId,
            Direction: "entrance",
            GatehouseId: gatehouseId);
        var manualResponse = await client.PostAsJsonAsync("/api/v1/access-events/manual", manualRequest);

        manualResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var manualBody = await manualResponse.Content.ReadFromJsonAsync<ManualAccessResponse>();
        manualBody.Should().NotBeNull();
        manualBody!.LookupAuditId.Should().Be(lookupAuditId);
        manualBody.SubjectType.Should().Be("resident");
        manualBody.SubjectId.Should().Be(residentId);
        manualBody.AccessMethod.Should().Be("manual_lookup");
        manualBody.DestinationApartmentId.Should().Be(apartmentId);
    }

    [Fact]
    public async Task Manual_access_event_with_orphan_lookup_audit_returns_400_validation()
    {
        var tenantId = NewTenantId();
        var gatehouseId = await AccessControlFixture.SeedGatehouseAsync(_mySql.ConnectionString, tenantId);
        var factory = NewFactory();
        var client = ManualLookupTestClient.ForTenant(factory, tenantId);

        var manualRequest = new RecordManualAccessRequest(
            LookupAuditId: Guid.NewGuid(),
            SubjectType: "resident",
            SubjectId: Guid.NewGuid(),
            Direction: "entrance",
            GatehouseId: gatehouseId);
        var manualResponse = await client.PostAsJsonAsync("/api/v1/access-events/manual", manualRequest);

        manualResponse.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Cross_tenant_lookup_returns_no_results_without_disclosure()
    {
        var tenantA = NewTenantId();
        var apartmentA = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantA, "A" + Guid.NewGuid().ToString("N")[..6], Guid.NewGuid().ToString("N")[..6]);
        await AccessControlFixture.SeedActiveResidentAsync(_mySql.ConnectionString, tenantA, "Tenant A Res", "11122233344", apartmentA);

        var tenantB = NewTenantId();
        var factory = NewFactory();
        var client = ManualLookupTestClient.ForTenant(factory, tenantB);

        var request = new LookupSubjectRequest(Criterion: "cpf", Value: "11122233344", Unit: null);
        var response = await client.PostAsJsonAsync("/api/v1/access-subjects/search", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<LookupResponse>();
        body.Should().NotBeNull();
        body!.Items.Should().BeEmpty();
        body.ResultCountBand.Should().Be("0");
    }

    private async Task AssertLookupAuditPersistedAsync(Guid tenantId, Guid lookupAuditId)
    {
        await using var conn = new MySqlConnector.MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlConnector.MySqlCommand(
            "SELECT COUNT(*) FROM AccessLookupAudits WHERE tenant_id = @tid AND Id = @id", conn);
        cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
        cmd.Parameters.AddWithValue("@id", lookupAuditId.ToString());
        var count = Convert.ToInt32(await cmd.ExecuteScalarAsync());
        count.Should().Be(1, "AccessLookupAudits row must be persisted for any tenant-local lookup");
    }

    private static class ManualLookupTestClient
    {
        public static HttpClient ForTenant(TestcontainersWebApplicationFactory factory, Guid tenantId)
        {
            var token = JwtTestHelper.GenerateTenantToken(
                userId: Guid.NewGuid(),
                email: $"manual-test-{tenantId}@controleasy.local",
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
