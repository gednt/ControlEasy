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

    [Fact]
    public async Task Gatehouse_activation_is_reversible_tenant_scoped_and_hidden_from_operational_list()
    {
        var clientA = _factory.AsTenantA();
        var clientB = _factory.AsTenantB();
        var create = await clientA.PostAsJsonAsync(
            "/api/v1/security/gatehouses",
            new CreateGatehouseRequest($"Lifecycle {Guid.NewGuid():N}", "Synthetic entrance"));
        create.EnsureSuccessStatusCode();
        var gatehouse = (await create.Content.ReadFromJsonAsync<GatehouseResponse>())!;
        gatehouse.Active.Should().BeTrue();

        var omittedActivation = await clientA.PutAsJsonAsync(
            $"/api/v1/security/gatehouses/{gatehouse.Id}/activation",
            new { });
        omittedActivation.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var foreignMutation = await clientB.PutAsJsonAsync(
            $"/api/v1/security/gatehouses/{gatehouse.Id}/activation",
            new SetGatehouseActivationRequest(false));
        foreignMutation.StatusCode.Should().Be(HttpStatusCode.NotFound);

        var disable = await clientA.PutAsJsonAsync(
            $"/api/v1/security/gatehouses/{gatehouse.Id}/activation",
            new SetGatehouseActivationRequest(false));
        disable.StatusCode.Should().Be(HttpStatusCode.OK);
        (await disable.Content.ReadFromJsonAsync<GatehouseResponse>())!.Active.Should().BeFalse();

        var operational = await clientA.GetFromJsonAsync<List<GatehouseResponse>>("/api/v1/security/gatehouses");
        operational.Should().NotContain(item => item.Id == gatehouse.Id);
        var management = await clientA.GetFromJsonAsync<List<GatehouseResponse>>(
            "/api/v1/security/gatehouses?includeInactive=true");
        management.Should().ContainSingle(item => item.Id == gatehouse.Id).Which.Active.Should().BeFalse();

        var enable = await clientA.PutAsJsonAsync(
            $"/api/v1/security/gatehouses/{gatehouse.Id}/activation",
            new SetGatehouseActivationRequest(true));
        enable.StatusCode.Should().Be(HttpStatusCode.OK);
        (await enable.Content.ReadFromJsonAsync<GatehouseResponse>())!.Active.Should().BeTrue();

        operational = await clientA.GetFromJsonAsync<List<GatehouseResponse>>("/api/v1/security/gatehouses");
        operational.Should().Contain(item => item.Id == gatehouse.Id);
    }

    [Fact]
    public async Task Gatehouse_operator_can_list_locations_but_cannot_change_lifecycle()
    {
        var client = _factory.CreateClient();
        var token = JwtTestHelper.GenerateTenantToken(
            Guid.NewGuid(),
            "gatehouse-operator@tenanta.test",
            TenantAwareWebApplicationFactory.TenantAId,
            roles: new[] { "GatehouseOperator" },
            permissions: new[] { "Access.Read", "Access.Access.Operate" });
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        var list = await client.GetAsync("/api/v1/security/gatehouses");
        list.StatusCode.Should().Be(HttpStatusCode.OK);

        var managementList = await client.GetAsync("/api/v1/security/gatehouses?includeInactive=true");
        managementList.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var activation = await client.PutAsJsonAsync(
            $"/api/v1/security/gatehouses/{Guid.NewGuid()}/activation",
            new SetGatehouseActivationRequest(false));
        activation.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task UpdateGatehouse_normalizes_details_preserves_lifecycle_and_is_tenant_scoped()
    {
        var clientA = _factory.AsTenantA();
        var clientB = _factory.AsTenantB();
        var create = await clientA.PostAsJsonAsync(
            "/api/v1/security/gatehouses",
            new CreateGatehouseRequest($"Editable {Guid.NewGuid():N}", "Original location"));
        create.EnsureSuccessStatusCode();
        var gatehouse = (await create.Content.ReadFromJsonAsync<GatehouseResponse>())!;

        var disable = await clientA.PutAsJsonAsync(
            $"/api/v1/security/gatehouses/{gatehouse.Id}/activation",
            new SetGatehouseActivationRequest(false));
        disable.EnsureSuccessStatusCode();

        var foreignUpdate = await clientB.PutAsJsonAsync(
            $"/api/v1/security/gatehouses/{gatehouse.Id}",
            new UpdateGatehouseRequest("Foreign rename", "Foreign location"));
        foreignUpdate.StatusCode.Should().Be(HttpStatusCode.NotFound);

        var update = await clientA.PutAsJsonAsync(
            $"/api/v1/security/gatehouses/{gatehouse.Id}",
            new UpdateGatehouseRequest("  Renamed gatehouse  ", "   "));
        update.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = (await update.Content.ReadFromJsonAsync<GatehouseResponse>())!;
        updated.Id.Should().Be(gatehouse.Id);
        updated.TenantId.Should().Be(gatehouse.TenantId);
        updated.Name.Should().Be("Renamed gatehouse");
        updated.Location.Should().BeNull();
        updated.Active.Should().BeFalse();

        var management = await clientA.GetFromJsonAsync<List<GatehouseResponse>>(
            "/api/v1/security/gatehouses?includeInactive=true");
        management.Should().ContainSingle(item => item.Id == gatehouse.Id).Which.Should().Be(updated);
    }

    [Fact]
    public async Task UpdateGatehouse_rejects_invalid_details_and_missing_permission_without_persisting()
    {
        var client = _factory.AsTenantA();
        var create = await client.PostAsJsonAsync(
            "/api/v1/security/gatehouses",
            new CreateGatehouseRequest($"Protected {Guid.NewGuid():N}", "Original location"));
        create.EnsureSuccessStatusCode();
        var gatehouse = (await create.Content.ReadFromJsonAsync<GatehouseResponse>())!;

        var invalid = await client.PutAsJsonAsync(
            $"/api/v1/security/gatehouses/{gatehouse.Id}",
            new UpdateGatehouseRequest("   ", new string('L', 501)));
        invalid.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var overlongName = await client.PutAsJsonAsync(
            $"/api/v1/security/gatehouses/{gatehouse.Id}",
            new UpdateGatehouseRequest(new string('N', 121), null));
        overlongName.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var operatorClient = _factory.CreateClient();
        var token = JwtTestHelper.GenerateTenantToken(
            Guid.NewGuid(),
            "restricted-operator@tenanta.test",
            TenantAwareWebApplicationFactory.TenantAId,
            roles: new[] { "GatehouseOperator" },
            permissions: new[] { "devices.read" });
        operatorClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        var forbidden = await operatorClient.PutAsJsonAsync(
            $"/api/v1/security/gatehouses/{gatehouse.Id}",
            new UpdateGatehouseRequest("Unauthorized rename", null));
        forbidden.StatusCode.Should().Be(HttpStatusCode.Forbidden);

        var management = await client.GetFromJsonAsync<List<GatehouseResponse>>(
            "/api/v1/security/gatehouses?includeInactive=true");
        management.Should().ContainSingle(item => item.Id == gatehouse.Id).Which.Should().Be(gatehouse);
    }
}
