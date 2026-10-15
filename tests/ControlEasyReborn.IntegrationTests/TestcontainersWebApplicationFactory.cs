using ControlEasyReborn.Api;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace ControlEasyReborn.IntegrationTests;

[Collection("MySql Collection")]
public sealed class TestcontainersWebApplicationFactory : TenantAwareWebApplicationFactory
{
    public const string TestHmacKey = "CE-INT-TEST-ACCESS-CONTROL-HMAC-KEY-v1-DETERMINISTIC-32BYTES";

    private readonly MySqlContainerFixture _mySql;

    static TestcontainersWebApplicationFactory()
    {
        Environment.SetEnvironmentVariable("ACCESS_CONTROL_HMAC_KEY", TestHmacKey);
    }

    public TestcontainersWebApplicationFactory(MySqlContainerFixture mySql)
    {
        _mySql = mySql;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.ConfigureAppConfiguration((ctx, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Db:Host"] = _mySql.HostOverride is { Length: > 0 } ? _mySql.HostOverride : _mySql.Host,
                ["Db:Port"] = _mySql.PortOverride is { Length: > 0 }
                    ? _mySql.PortOverride
                    : new MySqlConnector.MySqlConnectionStringBuilder(_mySql.ConnectionString).Port.ToString(),
                ["Db:Database"] = "controleasydb",
                ["Db:Username"] = "root",
                ["Db:Password"] = "testpw",
                ["Jwt:SigningKey"] = JwtTestHelper.Secret,
                ["Jwt:Issuer"] = JwtTestHelper.Issuer,
                ["Jwt:Audience"] = JwtTestHelper.Audience,
                ["Storage:Provider"] = "Local",
                ["Storage:Local:Path"] = Path.Combine(Path.GetTempPath(), "ce-photos-integration-tests"),
                // Dev-only simulator inspector surface (virtual door execution
                // endpoints). The real dev stack sets the same flag via
                // docker/docker-compose.yml (Devices__Simulator__EnableInspectorEndpoint).
                ["Devices:Simulator:EnableInspectorEndpoint"] = "true",
            });
        });

        builder.ConfigureServices(services =>
        {
        });
    }

    protected override string GetConnectionString() => _mySql.ConnectionString;
}