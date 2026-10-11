using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Application.Handlers;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace ControlEasyReborn.Modules.Devices.Api.Endpoints;

public static class TenantEndpoints
{
    public static IEndpointRouteBuilder MapTenantDoorIntegrationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/tenants/current")
            .RequireAuthorization()
            .WithTags("Tenants");

        // GET /api/v1/tenants/current/door-integration
        // DOOR-05: read the current flag state (with audit columns).
        group.MapGet("/door-integration", async (
            ITenantContext tenantContext,
            ITenantDoorIntegrationRepository repo,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var state = await repo.GetAsync(tenantId, ct);
            return Results.Ok(new TenantDoorIntegrationDto(
                TenantId: tenantId,
                DoorIntegrationEnabled: state?.IsEnabled ?? false,
                DoorIntegrationChangedAtUtc: state?.ChangedAtUtc,
                DoorIntegrationChangedByProfileId: state?.ChangedByProfileId));
        })
        .RequireAuthorization("Permission_devices.read");

        // PUT /api/v1/tenants/current/door-integration
        // DOOR-05: flip the per-tenant door-integration flag. Idempotent.
        // Audit columns (DoorIntegrationChangedAtUtc, DoorIntegrationChangedByProfileId)
        // are written on every call.
        group.MapPut("/door-integration", async (
            [FromBody] ToggleDoorIntegrationRequest request,
            ITenantContext tenantContext,
            ToggleDoorIntegrationHandler handler,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var profileId = tenantContext.ProfileId
                ?? throw new InvalidOperationException("Actor profile is not resolved.");

            var dto = await handler.HandleAsync(tenantId, request.DoorIntegrationEnabled, profileId, ct);
            return Results.Ok(dto);
        })
        .RequireAuthorization("Permission_tenants.toggle_door_integration");

        return app;
    }
}