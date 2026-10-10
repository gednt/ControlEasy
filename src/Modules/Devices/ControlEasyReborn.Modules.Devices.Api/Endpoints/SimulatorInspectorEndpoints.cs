using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace ControlEasyReborn.Modules.Devices.Api.Endpoints;

// Internal-only simulator inspector endpoints. Guarded by:
//   1. IWebHostEnvironment.IsDevelopment() (compile-time constant — never runs in Prod)
//   2. Configuration["Devices:Simulator:EnableInspectorEndpoint"] == "true"
// In Production, every route here returns 404 even if accidentally registered.
public static class SimulatorInspectorEndpoints
{
    public static IEndpointRouteBuilder MapSimulatorInspectorEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/_internal/devices")
            .WithTags("Devices (Internal)");

        group.MapGet("/{deviceId:guid}/simulator", (
            Guid deviceId,
            IHostEnvironment env,
            IConfiguration config,
            IDoorSimulatorState state,
            ITenantContextSafe tenantContext) =>
        {
            if (!IsInspectorEnabled(env, config)) return Results.NotFound();
            if (!tenantContext.TryGetTenantId(out var tenantId)) return Results.Unauthorized();

            return Results.Ok(state.GetAttempts(tenantId, deviceId));
        }).AllowAnonymous();

        group.MapPost("/{deviceId:guid}/simulator/failure-mode", (
            Guid deviceId,
            [FromBody] SetSimulatorFailureModeRequest body,
            IHostEnvironment env,
            IConfiguration config,
            IDoorSimulatorState state,
            ITenantContextSafe tenantContext) =>
        {
            if (!IsInspectorEnabled(env, config)) return Results.NotFound();
            if (!tenantContext.TryGetTenantId(out var tenantId)) return Results.Unauthorized();

            state.SetFailureMode(deviceId, body.Mode);
            return Results.NoContent();
        }).AllowAnonymous();

        group.MapPost("/{deviceId:guid}/simulator/offline", (
            Guid deviceId,
            [FromBody] SetSimulatorOfflineRequest body,
            IHostEnvironment env,
            IConfiguration config,
            IDoorSimulatorState state,
            ITenantContextSafe tenantContext) =>
        {
            if (!IsInspectorEnabled(env, config)) return Results.NotFound();
            if (!tenantContext.TryGetTenantId(out var tenantId)) return Results.Unauthorized();

            state.SetOffline(deviceId, body.UntilUtc.ToUniversalTime());
            return Results.NoContent();
        }).AllowAnonymous();

        group.MapPost("/{deviceId:guid}/simulator/reset", (
            Guid deviceId,
            IHostEnvironment env,
            IConfiguration config,
            IDoorSimulatorState state,
            ITenantContextSafe tenantContext) =>
        {
            if (!IsInspectorEnabled(env, config)) return Results.NotFound();
            if (!tenantContext.TryGetTenantId(out var tenantId)) return Results.Unauthorized();

            state.Reset(tenantId, deviceId);
            return Results.NoContent();
        }).AllowAnonymous();

        return app;
    }

    private static bool IsInspectorEnabled(IHostEnvironment env, IConfiguration config)
    {
        if (!env.IsDevelopment()) return false;
        var flag = config["Devices:Simulator:EnableInspectorEndpoint"];
        return string.Equals(flag, "true", StringComparison.OrdinalIgnoreCase);
    }
}

public sealed record SetSimulatorFailureModeRequest(SimulatorFailureMode Mode);
public sealed record SetSimulatorOfflineRequest(DateTime UntilUtc);

// Lazy fallback: when the inspector endpoint is invoked without the
// ITenantContext being resolved (e.g. from an integration test that bypassed
// authentication), return 401 instead of throwing.
public interface ITenantContextSafe
{
    bool TryGetTenantId(out Guid tenantId);
}

public sealed class TenantContextSafeAdapter : ITenantContextSafe
{
    private readonly ControlEasyReborn.SharedKernel.MultiTenancy.ITenantContext _ctx;
    public TenantContextSafeAdapter(ControlEasyReborn.SharedKernel.MultiTenancy.ITenantContext ctx) => _ctx = ctx;
    public bool TryGetTenantId(out Guid tenantId)
    {
        tenantId = _ctx.TenantId ?? Guid.Empty;
        return tenantId != Guid.Empty;
    }
}

public static class SimulatorInspectorServiceCollectionExtensions
{
    public static IServiceCollection AddDevicesSimulatorInspector(this IServiceCollection services)
    {
        services.AddScoped<ITenantContextSafe, TenantContextSafeAdapter>();
        return services;
    }
}