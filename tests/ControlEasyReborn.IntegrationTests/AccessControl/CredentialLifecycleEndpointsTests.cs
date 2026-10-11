using System.Net;
using System.Net.Http.Json;
using ControlEasyReborn.Modules.AccessControl.Infrastructure.Services;
using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.IntegrationTests;

[Collection("MySql Collection")]
public sealed class CredentialLifecycleEndpointsTests
{
    private const string TestHmacKey = "CE-INT-TEST-ACCESS-CONTROL-HMAC-KEY-v1-DETERMINISTIC-32BYTES";
    private readonly MySqlContainerFixture _mySql;

    public CredentialLifecycleEndpointsTests(MySqlContainerFixture mySql)
    {
        _mySql = mySql;
    }

    private TestcontainersWebApplicationFactory NewFactory() => new(_mySql);

    private static Guid NewTenantId() => Guid.NewGuid();

    [Fact]
    public async Task Issue_replace_revoke_lifecycle_executes_successfully()
    {
        var tenantId = NewTenantId();
        var gatehouseId = await AccessControlFixture.SeedGatehouseAsync(_mySql.ConnectionString, tenantId);
        var apartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, "Z" + Guid.NewGuid().ToString("N")[..6], Guid.NewGuid().ToString("N")[..6]);
        var residentId = await AccessControlFixture.SeedActiveResidentAsync(_mySql.ConnectionString, tenantId, "Lifecycle Resident", Guid.NewGuid().ToString("N")[..11], apartmentId);

        var factory = NewFactory();
        var client = LifecycleTestClient.ForTenant(factory, tenantId);

        var issueResponse = await client.PostAsJsonAsync("/api/v1/access-credentials", new
        {
            subjectType = "resident",
            subjectId = residentId
        });
        issueResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var issued = await issueResponse.Content.ReadFromJsonAsync<dynamic>();
        var firstCredentialId = Guid.Parse(issued!.GetProperty("id").GetString()!);

        var scanFirstResponse = await client.PostAsJsonAsync("/api/v1/access-events/scans", new
        {
            qrPayload = issued.GetProperty("qrPayload").GetString()!,
            direction = "entrance",
            scanAttemptId = Guid.NewGuid(),
            gatehouseId
        });
        scanFirstResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var replaceResponse = await client.PostAsJsonAsync($"/api/v1/access-credentials/{firstCredentialId}/replace", new { });
        replaceResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var replaced = await replaceResponse.Content.ReadFromJsonAsync<dynamic>();
        var newCredentialId = Guid.Parse(replaced!.GetProperty("newCredentialId").GetString()!);

        var scanOldResponse = await client.PostAsJsonAsync("/api/v1/access-events/scans", new
        {
            qrPayload = issued.GetProperty("qrPayload").GetString()!,
            direction = "entrance",
            scanAttemptId = Guid.NewGuid(),
            gatehouseId
        });
        scanOldResponse.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);

        var revokeResponse = await client.PostAsJsonAsync($"/api/v1/access-credentials/{newCredentialId}/revoke", new
        {
            reasonCode = "test_revocation",
            reasonText = "Integration test revocation"
        });
        revokeResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var scanRevokedResponse = await client.PostAsJsonAsync("/api/v1/access-events/scans", new
        {
            qrPayload = replaced.GetProperty("qrPayload").GetString()!,
            direction = "entrance",
            scanAttemptId = Guid.NewGuid(),
            gatehouseId
        });
        scanRevokedResponse.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }

    [Fact]
    public async Task Issue_when_active_already_exists_returns_conflict()
    {
        var tenantId = NewTenantId();
        var apartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, "Z" + Guid.NewGuid().ToString("N")[..6], Guid.NewGuid().ToString("N")[..6]);
        var residentId = await AccessControlFixture.SeedActiveResidentAsync(_mySql.ConnectionString, tenantId, "Dupe Resident", Guid.NewGuid().ToString("N")[..11], apartmentId);

        var factory = NewFactory();
        var client = LifecycleTestClient.ForTenant(factory, tenantId);

        var firstResponse = await client.PostAsJsonAsync("/api/v1/access-credentials", new
        {
            subjectType = "resident",
            subjectId = residentId
        });
        firstResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var secondResponse = await client.PostAsJsonAsync("/api/v1/access-credentials", new
        {
            subjectType = "resident",
            subjectId = residentId
        });
        secondResponse.StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Revoke_already_revoked_credential_is_idempotent()
    {
        var tenantId = NewTenantId();
        var apartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, "Z" + Guid.NewGuid().ToString("N")[..6], Guid.NewGuid().ToString("N")[..6]);
        var residentId = await AccessControlFixture.SeedActiveResidentAsync(_mySql.ConnectionString, tenantId, "Idempotent Resident", Guid.NewGuid().ToString("N")[..11], apartmentId);

        var factory = NewFactory();
        var client = LifecycleTestClient.ForTenant(factory, tenantId);

        var issueResponse = await client.PostAsJsonAsync("/api/v1/access-credentials", new
        {
            subjectType = "resident",
            subjectId = residentId
        });
        var issued = await issueResponse.Content.ReadFromJsonAsync<dynamic>();
        var credentialId = Guid.Parse(issued!.GetProperty("id").GetString()!);

        var firstRevokeResponse = await client.PostAsJsonAsync($"/api/v1/access-credentials/{credentialId}/revoke", new { });
        firstRevokeResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var secondRevokeResponse = await client.PostAsJsonAsync($"/api/v1/access-credentials/{credentialId}/revoke", new { });
        secondRevokeResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task List_credentials_returns_issued_credentials_with_status_filters()
    {
        var tenantId = NewTenantId();
        var apartmentId = await AccessControlFixture.SeedActiveApartmentAsync(_mySql.ConnectionString, tenantId, "Z" + Guid.NewGuid().ToString("N")[..6], Guid.NewGuid().ToString("N")[..6]);
        var residentId = await AccessControlFixture.SeedActiveResidentAsync(_mySql.ConnectionString, tenantId, "List Resident", Guid.NewGuid().ToString("N")[..11], apartmentId);

        var factory = NewFactory();
        var client = LifecycleTestClient.ForTenant(factory, tenantId);

        await client.PostAsJsonAsync("/api/v1/access-credentials", new
        {
            subjectType = "resident",
            subjectId = residentId
        });

        var listResponse = await client.GetAsync("/api/v1/access-credentials?status=active");
        listResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var list = await listResponse.Content.ReadFromJsonAsync<dynamic[]>();
        list.Should().NotBeNull();
        list!.Length.Should().BeGreaterThan(0);
    }

    private static class LifecycleTestClient
    {
        public static HttpClient ForTenant(TestcontainersWebApplicationFactory factory, Guid tenantId)
        {
            var token = JwtTestHelper.GenerateTenantToken(
                userId: Guid.NewGuid(),
                email: $"lifecycle-test-{tenantId}@controleasy.local",
                tenantId: tenantId,
                roles: new[] { "TenantAdmin" },
                permissions: new[] { "Access.Control.Issue", "Access.Control.Replace", "Access.Control.Revoke", "Access.Read", "Access.Access.Operate" });
            var client = factory.CreateClient();
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            return client;
        }
    }
}
