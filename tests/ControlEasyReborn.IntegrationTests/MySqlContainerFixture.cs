using System.Text;
using ControlEasyReborn.Api;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MySqlConnector;
using Xunit;

namespace ControlEasyReborn.IntegrationTests;

[CollectionDefinition("MySql Collection")]
public sealed class MySqlCollectionDefinition : ICollectionFixture<MySqlContainerFixture>;

[Collection("MySql Collection")]
public sealed class MySqlContainerFixture : IAsyncLifetime
{
    private readonly IContainer? _container;
    private string _connectionString = string.Empty;
    private bool _skipContainerLifecycle;

    public string ConnectionString => _connectionString;
    public string Host => _container?.Hostname ?? HostOverride;
    public string HostOverride { get; private set; } = string.Empty;
    public string PortOverride { get; private set; } = string.Empty;

    public MySqlContainerFixture()
    {
        var external = Environment.GetEnvironmentVariable("CE_ITEST_MYSQL");
        if (!string.IsNullOrWhiteSpace(external))
        {
            _skipContainerLifecycle = true;
            return;
        }

        _container = new ContainerBuilder()
            .WithImage("mysql:8.0")
            .WithEnvironment("MYSQL_ROOT_PASSWORD", "testpw")
            .WithEnvironment("MYSQL_DATABASE", "controleasydb")
            .WithPortBinding(3306, true)
            .WithWaitStrategy(Wait.ForUnixContainer().UntilPortIsAvailable(3306))
            .Build();
    }

    public async Task InitializeAsync()
    {
        var external = Environment.GetEnvironmentVariable("CE_ITEST_MYSQL");

        if (!string.IsNullOrWhiteSpace(external))
        {
            // Reuse an already-running MySQL instance instead of Testcontainers
            // (e.g. a dedicated container on a dev machine). Host may be "host:port".
            var host = external.Contains(":") ? external.Split(':')[0] : external;
            var port = external.Contains(":") ? external.Split(':')[1] : "3306";
            _connectionString = $"Server={host};Port={port};Database=controleasydb;Uid=root;Pwd=testpw;AllowUserVariables=True;";
            _skipContainerLifecycle = true;
            HostOverride = host;
            PortOverride = port;

            await WaitForMySqlReady();
            // External MySQL starts empty: apply the same init scripts the
            // Testcontainer-spawn path applies so controleasydb has the full schema.
            await RunInitScripts();
            return;
        }

        await _container!.StartAsync();

        // When the tests themselves run inside a container (devcontainer),
        // the MySQL container is a sibling on the same bridge network: reach
        // it directly via its container IP and internal port. Otherwise use
        // the host-mapped port via the container hostname (localhost).
        if (Environment.GetEnvironmentVariable("DOTNET_RUNNING_IN_CONTAINER") == "true" && _container.Hostname != "host.docker.internal")
        {
            var ip = _container.Hostname;
            _connectionString = $"Server={ip};Port=3306;Database=controleasydb;Uid=root;Pwd=testpw;AllowUserVariables=True;";
        }
        else
        {
            var port = _container.GetMappedPublicPort(3306);
            _connectionString = $"Server={_container.Hostname};Port={port};Database=controleasydb;Uid=root;Pwd=testpw;AllowUserVariables=True;";
        }

        await WaitForMySqlReady();
        await RunInitScripts();
    }

    public async Task DisposeAsync()
    {
        if (!_skipContainerLifecycle && _container is not null)
            await _container.DisposeAsync();
    }

    private async Task WaitForMySqlReady()
    {
        for (var i = 0; i < 30; i++)
        {
            try
            {
                using var conn = new MySqlConnection(_connectionString);
                await conn.OpenAsync();
                return;
            }
            catch
            {
                await Task.Delay(1000);
            }
        }
        throw new InvalidOperationException("MySQL container did not become ready in time.");
    }

    private async Task RunInitScripts()
    {
        var initDir = FindInitScriptsDirectory();
        if (!Directory.Exists(initDir))
            return;

        var scripts = Directory.GetFiles(initDir, "*.sql").OrderBy(f => f, StringComparer.Ordinal);

        foreach (var script in scripts)
        {
            var sql = NormalizeScriptForMySqlConnector(await File.ReadAllTextAsync(script));
            using var conn = new MySqlConnection(_connectionString);
            await conn.OpenAsync();

            // MySqlConnector parses semicolon-delimited batches, including compound
            // stored-program statements. Splitting on semicolons would break BEGIN/END bodies.
            using var cmd = new MySqlCommand(sql, conn);
            await cmd.ExecuteNonQueryAsync();
        }
    }

    private static string NormalizeScriptForMySqlConnector(string sql)
    {
        const string DelimiterDirective = "DELIMITER";
        var delimiter = ";";
        var normalized = new StringBuilder();

        using var reader = new StringReader(sql);
        string? line;
        while ((line = reader.ReadLine()) is not null)
        {
            var trimmed = line.Trim();
            if (trimmed.StartsWith(DelimiterDirective, StringComparison.OrdinalIgnoreCase))
            {
                delimiter = trimmed[DelimiterDirective.Length..].Trim();
                continue;
            }

            if (!string.Equals(delimiter, ";", StringComparison.Ordinal) &&
                trimmed.EndsWith(delimiter, StringComparison.Ordinal))
            {
                var delimiterIndex = line.LastIndexOf(delimiter, StringComparison.Ordinal);
                line = $"{line[..delimiterIndex]};{line[(delimiterIndex + delimiter.Length)..]}";
            }

            normalized.AppendLine(line);
        }

        return normalized.ToString();
    }

    private static string FindInitScriptsDirectory()
    {
        var candidate = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "docker", "mysql", "init"));
        if (Directory.Exists(candidate))
            return candidate;

        candidate = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "docker", "mysql", "init"));
        if (Directory.Exists(candidate))
            return candidate;

        candidate = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", "..", "..", "..", "docker", "mysql", "init"));
        return candidate;
    }
}
