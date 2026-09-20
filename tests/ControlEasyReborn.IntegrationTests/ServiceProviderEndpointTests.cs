using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ControlEasyReborn.Modules.ServiceProviders.Application.Contracts;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.IntegrationTests;

[Collection("MySql Collection")]
public sealed class ServiceProviderEndpointTests
{
    private readonly TestcontainersWebApplicationFactory _factory;

    public ServiceProviderEndpointTests(MySqlContainerFixture mySql)
    {
        _factory = new TestcontainersWebApplicationFactory(mySql);
    }

    [Fact]
    public async Task CreateServiceProvider_AsTenantA_ReturnsCreated()
    {
        var client = _factory.AsTenantA();
        var request = new CreateServiceProviderRequest("Clean Co", "11222333000181", "11999990000", null, "Cleaning", null);

        var response = await client.PostAsJsonAsync("/api/v1/service-providers", request);
        response.StatusCode.Should().Be(HttpStatusCode.Created);

        var body = await response.Content.ReadFromJsonAsync<ServiceProviderResponse>();
        body.Should().NotBeNull();
        body!.Name.Should().Be("Clean Co");
    }

    [Fact]
    public async Task CrossTenant_GetServiceProvider_AsDifferentTenant_Returns404()
    {
        var clientA = _factory.AsTenantA();
        var clientB = _factory.AsTenantB();

        var createResponse = await clientA.PostAsJsonAsync("/api/v1/service-providers",
            new CreateServiceProviderRequest("Tenant A Provider", "99888777000166", null, null, null, null));
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var created = await createResponse.Content.ReadFromJsonAsync<ServiceProviderResponse>();
        created.Should().NotBeNull();

        var getResponse = await clientB.GetAsync($"/api/v1/service-providers/{created!.Id}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task DeactivateServiceProvider_AsOwningTenant_ReturnsInactive()
    {
        var client = _factory.AsTenantA();
        var createResponse = await client.PostAsJsonAsync(
            "/api/v1/service-providers",
            new CreateServiceProviderRequest("Active Provider", "11222333000182", null, null, "Cleaning", null));
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await createResponse.Content.ReadFromJsonAsync<ServiceProviderResponse>();

        var getResponse = await client.GetAsync($"/api/v1/service-providers/{created!.Id}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var deactivateResponse = await client.PostAsync($"/api/v1/service-providers/{created.Id}/deactivate", null);

        deactivateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var deactivated = await deactivateResponse.Content.ReadFromJsonAsync<ServiceProviderResponse>();
        deactivated.Should().NotBeNull();
        deactivated!.Active.Should().BeFalse();
    }

    [Fact]
    public async Task DeactivateServiceProvider_WithoutWritePermission_ReturnsForbidden()
    {
        var tenantAdmin = _factory.AsTenantA();
        var createResponse = await tenantAdmin.PostAsJsonAsync(
            "/api/v1/service-providers",
            new CreateServiceProviderRequest("Protected Provider", "11222333000183", null, null, "Cleaning", null));
        var created = await createResponse.Content.ReadFromJsonAsync<ServiceProviderResponse>();

        var readOnlyClient = CreateClientWithPermissions(
            TenantAwareWebApplicationFactory.TenantAId,
            "ServiceProviders.Read");
        var deactivateResponse = await readOnlyClient.PostAsync($"/api/v1/service-providers/{created!.Id}/deactivate", null);

        deactivateResponse.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    private HttpClient CreateClientWithPermissions(Guid tenantId, params string[] permissions)
    {
        var client = _factory.CreateClient();
        var token = JwtTestHelper.GenerateTenantToken(
            Guid.NewGuid(),
            "operator@tenanta.test",
            tenantId,
            roles: ["Operator"],
            permissions: permissions);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
}
