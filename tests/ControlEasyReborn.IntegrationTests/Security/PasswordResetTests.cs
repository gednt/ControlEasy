using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using ControlEasyReborn.Modules.Security.Application.Abstractions;
using ControlEasyReborn.Modules.Security.Application.Contracts;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using MySqlConnector;
using Xunit;

namespace ControlEasyReborn.IntegrationTests.Security;

[Collection("MySql Collection")]
public sealed class PasswordResetTests
{
    private readonly TestcontainersWebApplicationFactory _factory;
    private readonly MySqlContainerFixture _mySql;

    public PasswordResetTests(MySqlContainerFixture mySql)
    {
        _mySql = mySql;
        _factory = new TestcontainersWebApplicationFactory(mySql);
    }

    [Fact]
    public async Task PlatformAdmin_CanResetAnyUserPassword_AcrossTenants_RevokingTokens()
    {
        var targetUserId = Guid.NewGuid();
        var targetTenantId = TenantAwareWebApplicationFactory.TenantAId;
        var email = $"user-{targetUserId}@tenanta.test";

        using (var scope = _factory.Services.CreateScope())
        {
            var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
            var initialHash = passwordHasher.Hash("InitialPassword123!");
            await SeedUserAsync(targetUserId, targetTenantId, email, initialHash, "TenantAdmin");
            await SeedRefreshTokenAsync(Guid.NewGuid(), targetUserId, "active-refresh-token-1");
        }

        var client = _factory.AsPlatformAdmin();

        var response = await client.PostAsync($"/api/v1/security/users/{targetUserId}/reset-password", null);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<ResetUserPasswordResponse>();
        result.Should().NotBeNull();
        result!.UserId.Should().Be(targetUserId);
        result.TempPassword.Should().NotBeNullOrWhiteSpace();
        result.TempPassword.Length.Should().BeGreaterThanOrEqualTo(12);
        result.MustChangePassword.Should().BeTrue();

        // Verify old refresh token was revoked
        var isRevoked = await CheckRefreshTokenRevokedAsync(targetUserId, "active-refresh-token-1");
        isRevoked.Should().BeTrue();

        // Verify login with temp password succeeds and reports MustChangePassword == true
        var anonClient = _factory.CreateClient();
        var loginResponse = await anonClient.PostAsJsonAsync("/api/v1/security/auth/login", new LoginRequest(email, result.TempPassword));
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var loginResult = await loginResponse.Content.ReadFromJsonAsync<LoginResponse>();
        loginResult.Should().NotBeNull();
        loginResult!.MustChangePassword.Should().BeTrue();
    }

    [Fact]
    public async Task TenantAdmin_CanResetOwnPorteiro_Successfully()
    {
        var targetUserId = Guid.NewGuid();
        var tenantId = TenantAwareWebApplicationFactory.TenantAId;
        var email = $"porteiro-{targetUserId}@tenanta.test";

        using (var scope = _factory.Services.CreateScope())
        {
            var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
            var initialHash = passwordHasher.Hash("PorteiroInitial123!");
            await SeedUserAsync(targetUserId, tenantId, email, initialHash, "Porteiro");
            await SeedAttendantProfileAsync(Guid.NewGuid(), tenantId, targetUserId, "Porteiro One");
        }

        var client = CreateTenantAdminClient(tenantId, "admin@tenanta.test");

        var response = await client.PostAsync($"/api/v1/security/users/{targetUserId}/reset-password", null);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content.ReadFromJsonAsync<ResetUserPasswordResponse>();
        result.Should().NotBeNull();
        result!.UserId.Should().Be(targetUserId);
        result.MustChangePassword.Should().BeTrue();

        // Verify login with temp password
        var anonClient = _factory.CreateClient();
        var loginResponse = await anonClient.PostAsJsonAsync("/api/v1/security/auth/login", new LoginRequest(email, result.TempPassword));
        loginResponse.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task TenantAdmin_AttemptingToResetUserInDifferentTenant_Receives403Forbidden()
    {
        var targetUserId = Guid.NewGuid();
        var otherTenantId = TenantAwareWebApplicationFactory.TenantBId;
        var callerTenantId = TenantAwareWebApplicationFactory.TenantAId;
        var email = $"porteiro-other-{targetUserId}@tenantb.test";

        using (var scope = _factory.Services.CreateScope())
        {
            var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
            var initialHash = passwordHasher.Hash("PorteiroB123!");
            await SeedUserAsync(targetUserId, otherTenantId, email, initialHash, "Porteiro");
        }

        var client = CreateTenantAdminClient(callerTenantId, "admin@tenanta.test");

        var response = await client.PostAsync($"/api/v1/security/users/{targetUserId}/reset-password", null);

        // PASS-02 explicitly requires 403 Forbidden (not 404) for cross-tenant attempts
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task TenantAdmin_AttemptingToResetNonPorteiroInSameTenant_Receives403Forbidden()
    {
        var targetUserId = Guid.NewGuid();
        var tenantId = TenantAwareWebApplicationFactory.TenantAId;
        var email = $"coadmin-{targetUserId}@tenanta.test";

        using (var scope = _factory.Services.CreateScope())
        {
            var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
            var initialHash = passwordHasher.Hash("AdminPass123!");
            await SeedUserAsync(targetUserId, tenantId, email, initialHash, "TenantAdmin");
        }

        var client = CreateTenantAdminClient(tenantId, "admin@tenanta.test");

        var response = await client.PostAsync($"/api/v1/security/users/{targetUserId}/reset-password", null);

        // PASS-03: Tenant admin can reset only their own gatekeepers' passwords
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task UnauthenticatedUser_Receives401Unauthorized()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsync($"/api/v1/security/users/{Guid.NewGuid()}/reset-password", null);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
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
        cmd.Parameters.AddWithValue("@name", "Test User");
        cmd.Parameters.AddWithValue("@roles", roles);
        await cmd.ExecuteNonQueryAsync();
    }

    private async Task SeedRefreshTokenAsync(Guid id, Guid userId, string token)
    {
        var connectionString = _mySql.ConnectionString;
        await using var conn = new MySqlConnection(connectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            @"INSERT INTO RefreshTokens (Id, UserId, Token, ExpiresAtUtc, RevokedAtUtc, CreatedAtUtc)
              VALUES (@id, @uid, @token, DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 7 DAY), NULL, UTC_TIMESTAMP(6));", conn);
        cmd.Parameters.AddWithValue("@id", id.ToString());
        cmd.Parameters.AddWithValue("@uid", userId.ToString());
        cmd.Parameters.AddWithValue("@token", token);
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

    private async Task<bool> CheckRefreshTokenRevokedAsync(Guid userId, string token)
    {
        var connectionString = _mySql.ConnectionString;
        await using var conn = new MySqlConnection(connectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "SELECT RevokedAtUtc FROM RefreshTokens WHERE UserId = @uid AND Token = @token;", conn);
        cmd.Parameters.AddWithValue("@uid", userId.ToString());
        cmd.Parameters.AddWithValue("@token", token);
        var result = await cmd.ExecuteScalarAsync();
        return result is not null && result != DBNull.Value;
    }

    [Fact]
    public async Task ForgotPassword_WhenAdminUser_ReturnsUniformOkAndPersistsResetRequest()
    {
        var adminUserId = Guid.NewGuid();
        var tenantId = TenantAwareWebApplicationFactory.TenantAId;
        var email = $"forgot-admin-{adminUserId}@tenanta.test";

        using (var scope = _factory.Services.CreateScope())
        {
            var passwordHasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
            var initialHash = passwordHasher.Hash("InitialAdminPass123!");
            await SeedUserAsync(adminUserId, tenantId, email, initialHash, "TenantAdmin");
            await SeedAttendantProfileAsync(Guid.NewGuid(), tenantId, adminUserId, "Forgot Admin");
        }

        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/v1/security/auth/forgot-password", new ForgotPasswordRequest(email));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ForgotPasswordResponse>();
        result.Should().NotBeNull();
        result!.Message.Should().Be("If an account matches that email, instructions have been sent.");

        // Verify PasswordResetRequests record exists
        var connectionString = _mySql.ConnectionString;
        await using var conn = new MySqlConnection(connectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "SELECT COUNT(*) FROM PasswordResetRequests WHERE NormalizedEmail = @email;", conn);
        cmd.Parameters.AddWithValue("@email", email.ToUpperInvariant());
        var count = Convert.ToInt32(await cmd.ExecuteScalarAsync());
        count.Should().BeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public async Task ForgotPassword_WhenUserNotFound_ReturnsIdenticalUniformOk()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/v1/security/auth/forgot-password", new ForgotPasswordRequest("doesnotexist@unknown.test"));

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var result = await response.Content.ReadFromJsonAsync<ForgotPasswordResponse>();
        result.Should().NotBeNull();
        result!.Message.Should().Be("If an account matches that email, instructions have been sent.");
    }

    [Fact]
    public async Task ForgotPassword_WhenExceedingRateLimit_Returns429TooManyRequests()
    {
        var client = _factory.CreateClient();
        var email = $"ratelimit-{Guid.NewGuid()}@flood.test";

        // First 3 requests should pass (200 OK)
        for (var i = 0; i < 3; i++)
        {
            var res = await client.PostAsJsonAsync("/api/v1/security/auth/forgot-password", new ForgotPasswordRequest(email));
            res.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        // 4th request exceeds the 3 requests per 15-minute window limit
        var throttledRes = await client.PostAsJsonAsync("/api/v1/security/auth/forgot-password", new ForgotPasswordRequest(email));
        throttledRes.StatusCode.Should().Be(HttpStatusCode.TooManyRequests);
    }
}
