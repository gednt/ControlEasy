using ControlEasyReborn.Infrastructure.KeyDerivation;
using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.SharedKernel.Bootstrap;
using ControlEasyReborn.SharedKernel.Demo;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace ControlEasyReborn.Infrastructure.Bootstrap;

public static class BootstrapHostingExtensions
{
    public static IServiceCollection AddControlEasyBootstrap(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<BootstrapOptions>(configuration.GetSection(BootstrapOptions.SectionName));
        services.AddSingleton<IBootstrapCredentialsStore, BootstrapCredentialsStore>();
        services.AddScoped<BootstrapInfoHandler>();

        // Per-tenant key derivation — registers the master-key provider (env-driven)
        // and the HKDF-based deriver. Modules that need per-tenant derived keys
        // resolve IPerTenantKeyDeriver and call DeriveKey(tenantId, purpose).
        services.AddSingleton<ITenantMasterKeyProvider, EnvironmentTenantMasterKeyProvider>();
        services.AddSingleton<IPerTenantKeyDeriver, PerTenantKeyDeriver>();

        return services;
    }

    public static bool ShouldRunPlatformAdminBootstrap(IConfiguration configuration) =>
        configuration.GetValue($"{BootstrapOptions.SectionName}:Enabled", true);

    public static IEndpointRouteBuilder MapBootstrapEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/security")
            .WithTags("Security");

        group.MapGet("/bootstrap", async (BootstrapInfoHandler handler, CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(ct);
            return Results.Ok(response);
        }).AllowAnonymous();

        return app;
    }
}

public sealed record BootstrapInfoResponse(bool Pending, string? Email = null, string? Password = null);

public sealed class BootstrapInfoHandler
{
    private readonly IBootstrapCredentialsStore _credentialsStore;
    private readonly IOptions<BootstrapOptions> _bootstrapOptions;
    private readonly IOptions<DemoOptions> _demoOptions;
    private readonly ITenantAwareLinqFactory _linqFactory;

    public BootstrapInfoHandler(
        IBootstrapCredentialsStore credentialsStore,
        IOptions<BootstrapOptions> bootstrapOptions,
        IOptions<DemoOptions> demoOptions,
        ITenantAwareLinqFactory linqFactory)
    {
        _credentialsStore = credentialsStore;
        _bootstrapOptions = bootstrapOptions;
        _demoOptions = demoOptions;
        _linqFactory = linqFactory;
    }

    public async Task<BootstrapInfoResponse> HandleAsync(CancellationToken ct)
    {
        if (_demoOptions.Value.Enabled)
            return new BootstrapInfoResponse(false);

        if (!_credentialsStore.TryGet(out var email, out var password))
        {
            var configuredEmail = _bootstrapOptions.Value.PlatformAdminEmail;
            var configuredPassword = _bootstrapOptions.Value.PlatformAdminPassword;
            if (string.IsNullOrWhiteSpace(configuredEmail) || string.IsNullOrWhiteSpace(configuredPassword))
                return new BootstrapInfoResponse(false);

            email = configuredEmail;
            password = configuredPassword;
        }

        if (!await PlatformAdminMustChangePasswordAsync(email, ct))
        {
            _credentialsStore.Clear();
            return new BootstrapInfoResponse(false);
        }

        return new BootstrapInfoResponse(true, email, password);
    }

    private async Task<bool> PlatformAdminMustChangePasswordAsync(string email, CancellationToken ct)
    {
        var bypassClient = _linqFactory.Create(NullTenantContext.Instance, bypassTenantFilter: true);
        var result = await bypassClient.SelectAsync(
            fields: "MustChangePassword",
            table: "Users",
            whereClause: "Email = @param0 AND Roles LIKE '%PlatformAdmin%'",
            parameters: new object[] { email },
            ct: ct);

        if (result is null || result.Rows.Count == 0)
            return false;

        return Convert.ToBoolean(result.Rows[0]["MustChangePassword"]);
    }
}
