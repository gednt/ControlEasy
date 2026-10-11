using ControlEasyReborn.Modules.Devices.Application.Handlers;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace ControlEasyReborn.Modules.Devices.Api.Endpoints;

public static class DeviceHealthEndpoints
{
    public static IEndpointRouteBuilder MapDeviceHealthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/devices/health")
            .RequireAuthorization()
            .WithTags("Device Health");

        // GET /api/v1/devices/health
        // TenantAdmin + Porteiro role (devices.read). Returns the per-device
        // health list (DOOR-13) consumed by the /devices dashboard page.
        group.MapGet("/", async (
            ITenantContext tenantContext,
            ListDeviceHealthHandler handler,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");

            var items = await handler.HandleAsync(tenantId, ct);
            return Results.Ok(items);
        })
        .RequireAuthorization("Permission_devices.read");

        return app;
    }
}