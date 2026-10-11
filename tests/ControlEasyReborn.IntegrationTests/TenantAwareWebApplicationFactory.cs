using ControlEasyReborn.Api;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using MySqlConnector;

namespace ControlEasyReborn.IntegrationTests;

public abstract class TenantAwareWebApplicationFactory : WebApplicationFactory<Program>
{
    static TenantAwareWebApplicationFactory()
    {
        System.Environment.SetEnvironmentVariable("DOTNET_USE_POLLING_FILE_WATCHER", "1");
    }

    public static readonly Guid TenantAId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    public static readonly Guid TenantBId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    public static readonly Guid PlatformAdminId = Guid.Parse("99999999-9999-9999-9999-999999999999");

    private static readonly string PlatformAdminEmail = "platform-admin-test@controleasy.local";

    private HttpClient? _tenantAClient;
    private HttpClient? _tenantBClient;
    private HttpClient? _platformAdminClient;

    private static readonly string[] TenantAdminPermissions =
    [
        "Visits.CheckIn",
        "Visits.CheckOut",
        "Visits.Read",
        "Apartments.Read",
        "Apartments.Write",
        "Residents.Read",
        "Residents.Write",
        "Vehicles.Read",
        "Vehicles.Write",
        "ServiceProviders.Read",
        "ServiceProviders.Write",
        "Reports.Read",
        "Photos.Read",
        "Photos.Write",
        "Photos.Delete",
        "devices.read",
        "devices.write",
    ];

    public HttpClient AsTenantA()
    {
        if (_tenantAClient is not null)
            return _tenantAClient;

        _tenantAClient = CreateClient();
        var token = JwtTestHelper.GenerateTenantToken(
            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01"),
            "admin@tenanta.test",
            TenantAId,
            roles: new[] { "Admin" },
            permissions: TenantAdminPermissions);

        _tenantAClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        return _tenantAClient;
    }

    public HttpClient AsTenantB()
    {
        if (_tenantBClient is not null)
            return _tenantBClient;

        _tenantBClient = CreateClient();
        var token = JwtTestHelper.GenerateTenantToken(
            Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01"),
            "admin@tenantb.test",
            TenantBId,
            roles: new[] { "Admin" },
            permissions: TenantAdminPermissions);

        _tenantBClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        return _tenantBClient;
    }

    public HttpClient AsPlatformAdmin()
    {
        if (_platformAdminClient is not null)
            return _platformAdminClient;

        _platformAdminClient = CreateClient();
        var token = JwtTestHelper.GeneratePlatformAdminToken(PlatformAdminId, PlatformAdminEmail);

        _platformAdminClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        return _platformAdminClient;
    }

    public async Task<Guid> SeedApartmentForTenantAAsync(string? blockSuffix = null, string? unitSuffix = null)
    {
        var id = Guid.NewGuid();
        var block = "B-" + (blockSuffix ?? Guid.NewGuid().ToString("N")[..6]);
        var unit = unitSuffix ?? Guid.NewGuid().ToString("N")[..6];

        var connectionString = GetConnectionString();

        await using var conn = new MySqlConnection(connectionString);
        await conn.OpenAsync();
        await using var cmd = new MySqlCommand(
            "INSERT INTO Apartments (Id, TenantId, Block, Unit, Active, CreatedAtUtc, tenant_id) " +
            "VALUES (@id, @tid, @block, @unit, 1, UTC_TIMESTAMP(6), @tid)", conn);
        cmd.Parameters.AddWithValue("@id", id.ToString());
        cmd.Parameters.AddWithValue("@tid", TenantAId.ToString());
        cmd.Parameters.AddWithValue("@block", block);
        cmd.Parameters.AddWithValue("@unit", unit);
        await cmd.ExecuteNonQueryAsync();
        return id;
    }

    protected virtual string GetConnectionString()
    {
        if (Environment.GetEnvironmentVariable("CE_ITEST_MYSQL") is { Length: > 0 })
        {
            return ResolveConnectionStringFromEnv();
        }
        return "Server=localhost;Port=3306;Database=controleasydb;Uid=root;Pwd=testpw;AllowUserVariables=True;";
    }

    private static string ResolveConnectionStringFromEnv()
    {
        var external = Environment.GetEnvironmentVariable("CE_ITEST_MYSQL")!;
        var host = external.Contains(':') ? external.Split(':')[0] : external;
        var port = external.Contains(':') ? external.Split(':')[1] : "3306";
        return $"Server={host};Port={port};Database=controleasydb;Uid=root;Pwd=testpw;AllowUserVariables=True;";
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            _tenantAClient?.Dispose();
            _tenantBClient?.Dispose();
            _platformAdminClient?.Dispose();
        }

        base.Dispose(disposing);
    }
}
