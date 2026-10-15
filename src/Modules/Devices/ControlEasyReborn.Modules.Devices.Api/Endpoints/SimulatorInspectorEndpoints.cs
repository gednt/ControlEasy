using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Application.Handlers;
using ControlEasyReborn.Modules.Devices.Application.Permissions;
using ControlEasyReborn.Modules.Devices.Domain.Enums;
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

        // Phase 25: pre-load a per-device event queue so the integration test
        // can simulate "events queued during disconnection" (DOOR-11).
        // The queued payloads carry a strict direction inside payload_json so
        // replays pass the card_read direction validation.
        group.MapPost("/{deviceId:guid}/simulator/enqueue-offline", (
            Guid deviceId,
            [FromBody] EnqueueOfflineEventsRequest body,
            IHostEnvironment env,
            IConfiguration config,
            IDeviceEventQueue queue,
            ITenantContextSafe tenantContext) =>
        {
            if (!IsInspectorEnabled(env, config)) return Results.NotFound();
            if (!tenantContext.TryGetTenantId(out var tenantId)) return Results.Unauthorized();

            var payloads = new List<DeviceEventPayload>(body.Count);
            var now = DateTime.UtcNow;
            for (var i = 0; i < body.Count; i++)
            {
                var seq = body.FromSequence + i;
                payloads.Add(new DeviceEventPayload(
                    EventType: DeviceEventType.CardRead,
                    OccurredAtUtc: now.AddMilliseconds(-body.Count * 100 + i * 100),
                    SequenceNumber: seq,
                    ExternalEventId: Guid.NewGuid(),
                    OpaqueToken: $"sim-test-resident-{Guid.NewGuid():N}",
                    PayloadJson: DeviceEventPayloadDirection.BuildPayloadJson(CycleDirection.Entrance)));
            }
            queue.EnqueueOffline(tenantId, deviceId, payloads);
            return Results.Ok(new { Queued = payloads.Count });
        }).AllowAnonymous();

        // Phase 25: peek the current in-memory event queue (test-only).
        group.MapGet("/{deviceId:guid}/simulator/queue", (
            Guid deviceId,
            IHostEnvironment env,
            IConfiguration config,
            IDeviceEventQueue queue,
            ITenantContextSafe tenantContext) =>
        {
            if (!IsInspectorEnabled(env, config)) return Results.NotFound();
            if (!tenantContext.TryGetTenantId(out var tenantId)) return Results.Unauthorized();

            var items = queue.Drain(tenantId, deviceId);
            return Results.Ok(items);
        }).AllowAnonymous();

        // Operational-gatehouse-simulator spec: the AUTHENTICATED execution
        // surface of the virtual physical reader. Both endpoints are
        // dev-flag gated AND require Bearer + Permission_devices.read
        // (porteiro+admin) — simulator execution is never anonymous.
        //
        // GET /{deviceId}/simulator/readiness — can this simulator present a
        // credential right now? Returns a always-200 readiness verdict
        // (ready=false carries the actionable reason).
        group.MapGet("/{deviceId:guid}/simulator/readiness", async (
            Guid deviceId,
            IHostEnvironment env,
            IConfiguration config,
            ITenantContextSafe tenantContext,
            VirtualDoorReadinessHandler handler,
            CancellationToken ct) =>
        {
            if (!IsInspectorEnabled(env, config)) return Results.NotFound();
            if (!tenantContext.TryGetTenantId(out var tenantId)) return Results.Unauthorized();

            var readiness = await handler.HandleAsync(tenantId, deviceId, ct);
            return Results.Ok(readiness);
        })
        .RequireAuthorization("Permission_" + DevicePermissions.Read);

        // POST /{deviceId}/simulator/present-credential — present one issued
        // credential token at the virtual reader in a strict direction. A
        // configured offline / auth-failure mode returns its failure without
        // touching ingestion; a successful read delegates exactly once to
        // the canonical events ingestion path.
        group.MapPost("/{deviceId:guid}/simulator/present-credential", async (
            Guid deviceId,
            [FromBody] PresentCredentialRequest body,
            IHostEnvironment env,
            IConfiguration config,
            ITenantContextSafe tenantContextSafe,
            ControlEasyReborn.SharedKernel.MultiTenancy.ITenantContext tenantContext,
            PresentSimulatedCredentialHandler handler,
            CancellationToken ct) =>
        {
            if (!IsInspectorEnabled(env, config)) return Results.NotFound();
            if (!tenantContextSafe.TryGetTenantId(out var tenantId)) return Results.Unauthorized();

            var result = await handler.HandleAsync(
                tenantId,
                deviceId,
                body.Token ?? string.Empty,
                body.Direction ?? string.Empty,
                tenantContext.ProfileId,
                ct);
            return Results.Ok(result);
        })
        .RequireAuthorization("Permission_" + DevicePermissions.Read);

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
public sealed record EnqueueOfflineEventsRequest(int Count, long FromSequence);

// Authenticated virtual-reader execution contract. The token is an issued
// (or synthetic test) credential token presented AT the reader — never a
// credential secret viewer.
public sealed record PresentCredentialRequest(string? Token, string? Direction);

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