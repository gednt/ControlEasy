using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ControlEasyReborn.Modules.Security.Application.Contracts;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using MySqlConnector;
using Xunit;

namespace ControlEasyReborn.IntegrationTests.Security;

[Collection("MySql Collection")]
public sealed class StaffListTests
{
    private readonly TestcontainersWebApplicationFactory _factory;
    private readonly MySqlContainerFixture _mySql;

    public StaffListTests(MySqlContainerFixture mySql)
    {
        _mySql = mySql;
        _factory = new TestcontainersWebApplicationFactory(mySql);
    }

    [Fact]
    public async Task TenantAdmin_GetsOwnTenantStaffWithProfileIdAndIsolatesOtherTenant()
    {
        var tenantA = TenantAwareWebApplicationFactory.TenantAId;
        var tenantB = TenantAwareWebApplicationFactory.TenantBId;
        var adminAId = Guid.NewGuid();
        var porteiroAId = Guid.NewGuid();
        var porteiroBId = Guid.NewGuid();
        var adminAEmail = $"staff-admin-a-{adminAId}@tenanta.test";
        var porteiroAEmail = $"staff-porteiro-a-{porteiroAId}@tenanta.test";
        var porteiroBEmail = $"staff-porteiro-b-{porteiroBId}@tenantb.test";
        var porteiroAProfileId = Guid.NewGuid();

        using (var scope = _factory.Services.CreateScope())
        {
            var hasher = scope.ServiceProvider.GetRequiredService<ControlEasyReborn.Modules.Security.Application.Abstractions.IPasswordHasher>();
            await SeedUserAsync(adminAId, tenantA, adminAEmail, hasher.Hash("AdminPass123!"), "TenantAdmin");
            await SeedUserAsync(porteiroAId, tenantA, porteiroAEmail, hasher.Hash("PorteiroPass123!"), "Porteiro");
            await SeedUserAsync(porteiroBId, tenantB, porteiroBEmail, hasher.Hash("PorteiroBPass123!"), "Porteiro");
            await SeedAttendantProfileAsync(porteiroAProfileId, tenantA, porteiroAId, "Porteiro A One");
        }

        var client = CreateTenantAdminClient(tenantA, adminAEmail);
        var response = await client.GetAsync("/api/v1/security/staff");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var staff = await response.Content.ReadFromJsonAsync<List<StaffMemberResponse>>();
        staff.Should().NotBeNull();
        staff!.Should().Contain(s => s.UserId == adminAId && s.ProfileId == null);
        staff.Should().Contain(s => s.UserId == porteiroAId && s.ProfileId == porteiroAProfileId);
        staff.Should().NotContain(s => s.UserId == porteiroBId);
    }

    [Fact]
    public async Task PlatformAdmin_GetsStaffListForCallerTenant()
    {
        var tenantA = TenantAwareWebApplicationFactory.TenantAId;
        var adminAId = Guid.NewGuid();
        var adminAEmail = $"plat-staff-admin-a-{adminAId}@tenanta.test";

        using (var scope = _factory.Services.CreateScope())
        {
            var hasher = scope.ServiceProvider.GetRequiredService<ControlEasyReborn.Modules.Security.Application.Abstractions.IPasswordHasher>();
            await SeedUserAsync(adminAId, tenantA, adminAEmail, hasher.Hash("AdminPass123!"), "TenantAdmin");
        }

        var client = _factory.AsPlatformAdmin();
        var response = await client.GetAsync("/api/v1/security/staff");

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task UnauthenticatedUser_Receives401Unauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/security/staff");
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task PorteiroRole_Receives403Forbidden()
    {
        var tenantId = TenantAwareWebApplicationFactory.TenantAId;
        var client = CreatePorteiroClient(tenantId);
        var response = await client.GetAsync("/api/v1/security/staff");
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    private HttpClient CreateTenantAdminClient(Guid tenantId, string email)
    {
        var client = _factory.CreateClient();
        var token = JwtTestHelper.GenerateTenantToken(
            Guid.NewGuid(),
            email,
            tenantId,
            roles: new[] { "TenantAdmin" },
            permissions: new[] { "Security.Write", "Users.Write" });

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private HttpClient CreatePorteiroClient(Guid tenantId)
    {
        var client = _factory.CreateClient();
        var token = JwtTestHelper.GenerateTenantToken(
            Guid.NewGuid(),
            $"porteiro-list-{Guid.NewGuid()}@tenanta.test",
            tenantId,
            roles: new[] { "Porteiro" },
            permissions: new[] { "Visits.CheckIn" });

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private async Task SeedUserAsync(Guid id, Guid tenantId, string email, string passwordHash, string roles)
    {
        var connectionString = _mySql.ConnectionString;
        await using var conn = new MySqlConnection(connectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            @"INSERT INTO Users (Id, TenantId, Email, PasswordHash, DisplayName, Active, MustChangePassword, Roles, CreatedAtUtc, tenant_id)
              VALUES (@id, @tid, @email, @hash, @name, 1, 0, @roles, UTC_TIMESTAMP(6), @tid)
              ON DUPLICATE KEY UPDATE PasswordHash = @hash, Roles = @roles;", conn);
        cmd.Parameters.AddWithValue("@id", id.ToString());
        cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
        cmd.Parameters.AddWithValue("@email", email);
        cmd.Parameters.AddWithValue("@hash", passwordHash);
        cmd.Parameters.AddWithValue("@name", "Staff Test");
        cmd.Parameters.AddWithValue("@roles", roles);
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task SeedAttendantProfileAsync(Guid id, Guid tenantId, Guid userId, string displayName)
    {
        var connectionString = _mySql.ConnectionString;
        await using var conn = new MySqlConnection(connectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            @"INSERT INTO AttendantProfiles (Id, TenantId, UserId, DisplayName, ShiftId, GatehouseId, Permissions, Active, CreatedAtUtc, tenant_id)
              VALUES (@id, @tid, @uid, @name, NULL, NULL, 'Visits.CheckIn', 1, UTC_TIMESTAMP(6), @tid);", conn);
        cmd.Parameters.AddWithValue("@id", id.ToString());
        cmd.Parameters.AddWithValue("@tid", tenantId.ToString());
        cmd.Parameters.AddWithValue("@uid", userId.ToString());
        cmd.Parameters.AddWithValue("@name", displayName);
        await cmd.ExecuteNonQueryAsync();
    }
}