using System.Net;
using System.Net.Http.Json;
using ControlEasyReborn.Modules.Security.Application.Contracts;
using FluentAssertions;
using Xunit;
using Microsoft.Extensions.DependencyInjection;

namespace ControlEasyReborn.IntegrationTests;

[Collection("MySql Collection")]
public sealed class SecurityEndpointTests
{
    private readonly TestcontainersWebApplicationFactory _factory;

    public SecurityEndpointTests(MySqlContainerFixture mySql)
    {
        _factory = new TestcontainersWebApplicationFactory(mySql);
    }

    [Fact]
    public async Task Login_with_unknown_email_returns_unauthorized()
    {
        var client = _factory.CreateClient();
        var request = new LoginRequest("nobody@test.com", "password123");

        var response = await client.PostAsJsonAsync("/api/v1/security/auth/login", request);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task TenantLookup_with_unknown_email_returns_empty_list()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/security/tenants?email=nobody@test.com");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<List<TenantLookupResponse>>();
        body.Should().NotBeNull();
        body.Should().BeEmpty();
    }

    [Fact]
    public async Task CreateAttendantProfile_as_tenantA_returns_created()
    {
        var client = _factory.AsTenantA();
        var userId = Guid.NewGuid();
        using (var scope = _factory.Services.CreateScope())
        {
            var linqFactory = scope.ServiceProvider.GetRequiredService<ControlEasyReborn.Infrastructure.MultiTenancy.ITenantAwareLinqFactory>();
            var db = linqFactory.Create(ControlEasyReborn.SharedKernel.MultiTenancy.NullTenantContext.Instance, bypassTenantFilter: true);
            await db.InsertAsync(
                new[] { "Id", "TenantId", "Email", "PasswordHash", "DisplayName", "Active", "MustChangePassword", "Roles", "CreatedAtUtc", "tenant_id" },
                "Users",
                new object[] { userId, TenantAwareWebApplicationFactory.TenantAId, $"attendant-{userId}@tenanta.test", "hash", "Attendant User", true, false, "Attendant", DateTime.UtcNow, TenantAwareWebApplicationFactory.TenantAId },
                primaryKeyName: "Id",
                autoIncrement: false,
                ct: CancellationToken.None);
        }

        var request = new CreateAttendantProfileRequest(
            UserId: userId,
            DisplayName: "Test Attendant",
            ShiftId: null,
            GatehouseId: null,
            Permissions: "Visits.Read");

        var response = await client.PostAsJsonAsync("/api/v1/security/attendant-profiles", request);
        response.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task CrossTenant_GetAttendantProfile_as_different_tenant_returns_404()
    {
        var clientA = _factory.AsTenantA();
        var clientB = _factory.AsTenantB();
        var userId = Guid.NewGuid();
        using (var scope = _factory.Services.CreateScope())
        {
            var linqFactory = scope.ServiceProvider.GetRequiredService<ControlEasyReborn.Infrastructure.MultiTenancy.ITenantAwareLinqFactory>();
            var db = linqFactory.Create(ControlEasyReborn.SharedKernel.MultiTenancy.NullTenantContext.Instance, bypassTenantFilter: true);
            await db.InsertAsync(
                new[] { "Id", "TenantId", "Email", "PasswordHash", "DisplayName", "Active", "MustChangePassword", "Roles", "CreatedAtUtc", "tenant_id" },
                "Users",
                new object[] { userId, TenantAwareWebApplicationFactory.TenantAId, $"attendant-{userId}@tenanta.test", "hash", "Attendant User", true, false, "Attendant", DateTime.UtcNow, TenantAwareWebApplicationFactory.TenantAId },
                primaryKeyName: "Id",
                autoIncrement: false,
                ct: CancellationToken.None);
        }

        var request = new CreateAttendantProfileRequest(
            UserId: userId,
            DisplayName: "Cross Tenant Test",
            ShiftId: null,
            GatehouseId: null,
            Permissions: "Visits.Read");

        var createResponse = await clientA.PostAsJsonAsync("/api/v1/security/attendant-profiles", request);
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var created = await createResponse.Content.ReadFromJsonAsync<AttendantProfileResponse>();
        created.Should().NotBeNull();

        var getResponse = await clientB.GetAsync($"/api/v1/security/attendant-profiles/{created!.Id}");
        getResponse.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ListShifts_as_tenant_returns_ok()
    {
        var client = _factory.AsTenantA();

        var response = await client.GetAsync("/api/v1/security/shifts");
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<List<ShiftResponse>>();
        body.Should().NotBeNull();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("Main entrance")]
    public async Task CreateGatehouse_persists_exact_response_for_same_tenant_only(string? location)
    {
        var clientA = _factory.AsTenantA();
        var clientB = _factory.AsTenantB();
        var request = new CreateGatehouseRequest($"Gatehouse A {Guid.NewGuid():N}", location);
        var tenantBRequest = new CreateGatehouseRequest($"Gatehouse B {Guid.NewGuid():N}", "Service entrance");

        var createResponse = await clientA.PostAsJsonAsync("/api/v1/security/gatehouses", request);
        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);

        var created = await createResponse.Content.ReadFromJsonAsync<GatehouseResponse>();
        created.Should().NotBeNull();
        var createdGatehouse = created!;
        createdGatehouse.TenantId.Should().Be(TenantAwareWebApplicationFactory.TenantAId);
        createdGatehouse.Name.Should().Be(request.Name);
        createdGatehouse.Location.Should().Be(location);

        var tenantBCreateResponse = await clientB.PostAsJsonAsync("/api/v1/security/gatehouses", tenantBRequest);
        tenantBCreateResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var tenantBCreated = await tenantBCreateResponse.Content.ReadFromJsonAsync<GatehouseResponse>();
        tenantBCreated.Should().NotBeNull();

        var sameTenantResponse = await clientA.GetAsync("/api/v1/security/gatehouses");
        sameTenantResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var sameTenantGatehouses = await sameTenantResponse.Content.ReadFromJsonAsync<List<GatehouseResponse>>();
        sameTenantGatehouses.Should().NotBeNull();
        sameTenantGatehouses!.Should().ContainSingle(gatehouse => gatehouse.Id == createdGatehouse.Id)
            .Which.Should().Be(createdGatehouse);

        var otherTenantResponse = await clientB.GetAsync("/api/v1/security/gatehouses");
        otherTenantResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        var otherTenantGatehouses = await otherTenantResponse.Content.ReadFromJsonAsync<List<GatehouseResponse>>();
        otherTenantGatehouses.Should().NotBeNull();
        otherTenantGatehouses!.Should().ContainSingle(gatehouse => gatehouse.Id == tenantBCreated!.Id)
            .Which.Should().Be(tenantBCreated);
        otherTenantGatehouses!.Should().NotContain(gatehouse => gatehouse.Id == createdGatehouse.Id);
    }
}
