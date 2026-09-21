using System.Net;
using System.Net.Http.Json;
using ControlEasyReborn.Modules.AccessControl.Application.Contracts;
using FluentAssertions;
using MySqlConnector;
using Xunit;

namespace ControlEasyReborn.IntegrationTests;

[Collection("MySql Collection")]
public sealed class PackageDropEndpointTests
{
    private readonly MySqlContainerFixture _mySql;

    public PackageDropEndpointTests(MySqlContainerFixture mySql)
    {
        _mySql = mySql;
    }

    private TestcontainersWebApplicationFactory NewFactory() => new(_mySql);

    private static Guid NewTenantId() => Guid.NewGuid();

    private static HttpClient ForTenant(TestcontainersWebApplicationFactory factory, Guid tenantId)
    {
        var token = JwtTestHelper.GenerateTenantToken(
            userId: Guid.NewGuid(),
            email: $"pkg-drop-{tenantId}@controleasy.local",
            tenantId: tenantId,
            roles: new[] { "GatehouseOperator" },
            permissions: new[] { "Access.Access.Operate", "Access.Read" });
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    /// <summary>
    /// Establishes a lookup audit bound to the acting profile via the real
    /// search endpoint (the same flow a gatehouse operator performs), then
    /// returns the audit id for the manual registration call.
    /// </summary>
    private static async Task<Guid> CreateLookupAuditViaSearchAsync(HttpClient client, Guid tenantId, string cpf)
    {
        _ = tenantId;
        var apartmentId = Guid.NewGuid(); // placeholder; replaced by caller seeding resident
        _ = apartmentId;

        // Caller must have seeded a resident with this cpf for the tenant.
        var searchRequest = new LookupSubjectRequest(Criterion: "cpf", Value: cpf, Unit: null);
        var searchResponse = await client.PostAsJsonAsync("/api/v1/access-subjects/search", searchRequest);
        searchResponse.EnsureSuccessStatusCode();
        var body = await searchResponse.Content.ReadFromJsonAsync<LookupResponse>();
        return body!.LookupAuditId;
    }

    [Fact]
    public async Task Apartment_bound_package_drop_persists_access_event_row()
    {
        var tenantId = NewTenantId();
        var block = "P" + Guid.NewGuid().ToString("N")[..6];
        var unit = Guid.NewGuid().ToString("N")[..6];
        var apartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, block, unit);
        var cpf = Guid.NewGuid().ToString("N")[..11];
        await AccessControlFixture.SeedActiveResidentAsync(_mySql.ConnectionString, tenantId, "Res Pkg", cpf, apartmentId);

        var factory = NewFactory();
        var client = ForTenant(factory, tenantId);

        var lookupAuditId = await CreateLookupAuditViaSearchAsync(client, tenantId, cpf);
        var beforeVisits = await CountTenantVisitsAsync(tenantId);

        var request = new RecordManualAccessRequest(
            LookupAuditId: lookupAuditId,
            SubjectType: "visitor",
            SubjectId: apartmentId,
            Direction: "entrance",
            GatehouseId: null,
            Kind: "package-drop",
            PackageDescription: "2 boxes",
            PackageCarrierCode: "Correios");

        var response = await client.PostAsJsonAsync("/api/v1/access-events/manual", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ManualAccessResponse>();
        body.Should().NotBeNull();
        body!.Kind.Should().Be("package-drop");
        body.PackageDescription.Should().Be("2 boxes");
        body.PackageCarrierCode.Should().Be("Correios");
        body.DestinationApartmentId.Should().Be(apartmentId);
        body.DestinationBlock.Should().Be(block);

        var row = await QueryPackageDropRowAsync(tenantId, body.AccessEventId);
        row.Should().NotBeNull();
        row!.Value.eventKind.Should().Be(1);
        row.Value.packageDescription.Should().Be("2 boxes");
        row.Value.packageCarrierCode.Should().Be("Correios");
        row.Value.destinationApartmentId.Should().Be(apartmentId.ToString());

        var afterVisits = await CountTenantVisitsAsync(tenantId);
        afterVisits.Should().Be(beforeVisits, "package drops must NOT create Visit rows (D-04)");
    }

    [Fact]
    public async Task Condominium_level_drop_records_gatehouse_reception_snapshot()
    {
        var tenantId = NewTenantId();
        var block = "P" + Guid.NewGuid().ToString("N")[..6];
        var unit = Guid.NewGuid().ToString("N")[..6];
        var apartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, block, unit);
        var cpf = Guid.NewGuid().ToString("N")[..11];
        await AccessControlFixture.SeedActiveResidentAsync(_mySql.ConnectionString, tenantId, "Res Condo", cpf, apartmentId);

        var factory = NewFactory();
        var client = ForTenant(factory, tenantId);

        var lookupAuditId = await CreateLookupAuditViaSearchAsync(client, tenantId, cpf);
        var beforeVisits = await CountTenantVisitsAsync(tenantId);

        var request = new RecordManualAccessRequest(
            LookupAuditId: lookupAuditId,
            SubjectType: "visitor",
            SubjectId: Guid.Empty,
            Direction: "entrance",
            GatehouseId: null,
            Kind: "package-drop",
            PackageDescription: "Mail room letter");

        var response = await client.PostAsJsonAsync("/api/v1/access-events/manual", request);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await response.Content.ReadFromJsonAsync<ManualAccessResponse>();
        body.Should().NotBeNull();
        body!.DestinationBlock.Should().Be("GATEHOUSE");
        body.DestinationUnit.Should().Be("RECEPTION");
        body.Kind.Should().Be("package-drop");

        var row = await QueryPackageDropRowAsync(tenantId, body.AccessEventId);
        row.Should().NotBeNull();
        row!.Value.eventKind.Should().Be(1);
        row.Value.destinationApartmentId.Should().Be(Guid.Empty.ToString("D"));

        var afterVisits = await CountTenantVisitsAsync(tenantId);
        afterVisits.Should().Be(beforeVisits, "package drops must NOT create Visit rows (D-04)");
    }

    [Fact]
    public async Task Missing_package_description_returns_400_problem_details()
    {
        var tenantId = NewTenantId();
        var block = "P" + Guid.NewGuid().ToString("N")[..6];
        var unit = Guid.NewGuid().ToString("N")[..6];
        var apartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, block, unit);
        var cpf = Guid.NewGuid().ToString("N")[..11];
        await AccessControlFixture.SeedActiveResidentAsync(_mySql.ConnectionString, tenantId, "Res NoDesc", cpf, apartmentId);

        var factory = NewFactory();
        var client = ForTenant(factory, tenantId);

        var lookupAuditId = await CreateLookupAuditViaSearchAsync(client, tenantId, cpf);

        var request = new RecordManualAccessRequest(
            LookupAuditId: lookupAuditId,
            SubjectType: "visitor",
            SubjectId: Guid.Empty,
            Direction: "entrance",
            GatehouseId: null,
            Kind: "package-drop",
            PackageDescription: null);

        var response = await client.PostAsJsonAsync("/api/v1/access-events/manual", request);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
        problem.GetProperty("status").GetInt32().Should().Be(400);
        problem.TryGetProperty("errors", out var errors).Should().BeTrue();
        errors.GetProperty("PackageDescription").ValueKind.Should().Be(System.Text.Json.JsonValueKind.Array);
    }

    private async Task<(int eventKind, string? packageDescription, string? packageCarrierCode, string destinationApartmentId)?> QueryPackageDropRowAsync(Guid tenantId, Guid eventId)
    {
        await using var conn = new MySqlConnection(_mySql.ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "SELECT EventKind, PackageDescription, PackageCarrierCode, DestinationApartmentId FROM AccessEvents WHERE tenant_id = @tid AND Id = @id", conn);
        cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
        cmd.Parameters.AddWithValue("@id", eventId.ToString());
        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            return null;
        }
        return (
            Convert.ToInt32(reader.GetValue(0)),
            reader.IsDBNull(1) ? null : reader.GetValue(1).ToString(),
            reader.IsDBNull(2) ? null : reader.GetValue(2).ToString(),
            reader.GetValue(3).ToString() ?? string.Empty);
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
}