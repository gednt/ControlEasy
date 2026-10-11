using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Application.Handlers;
using ControlEasyReborn.Modules.Devices.Application.Permissions;
using ControlEasyReborn.Modules.Devices.Domain.Enums;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace ControlEasyReborn.Modules.Devices.Api.Endpoints;

public static class DeviceEventEndpoints
{
    public static IEndpointRouteBuilder MapDeviceEventEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/devices/{deviceId:guid}/events")
            .RequireAuthorization()
            .WithTags("Device Events");

        // POST /api/v1/devices/{deviceId}/events
        // Ingests one reader event. Returns the discriminated DeviceEventIngestionDto
        // (Outcome, VisitId, AccessEventId, RefusedScanAttemptId, OccurredAtUtc,
        // ProcessedAtUtc). Bearer JWT (any authenticated caller — the panel uses
        // a service account, the simulator uses the dev-only inspector flow).
        group.MapPost("/", async (
            Guid deviceId,
            [FromBody] DeviceEventPayload payload,
            ITenantContext tenantContext,
            IngestDeviceEventHandler handler,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var profileId = tenantContext.ProfileId;

            var result = await handler.HandleAsync(tenantId, deviceId, payload, profileId, ct);
            return Results.Ok(result);
        })
        .RequireAuthorization("Permission_devices.read");

        // GET /api/v1/devices/{deviceId}/events?since=<iso>&limit=<n>
        // TenantAdmin-only list (metadata projection, no payload_json).
        group.MapGet("/", async (
            Guid deviceId,
            [FromQuery] DateTime? since,
            [FromQuery] int? limit,
            ITenantContext tenantContext,
            ListDeviceEventsHandler handler,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");

            var items = await handler.HandleAsync(tenantId, deviceId, since, limit ?? 100, ct);
            if (items is null)
            {
                return ProblemResults.NotFound(
                    title: DeviceErrorTitles.DeviceNotFound,
                    detail: $"Device {deviceId} not found.",
                    type: DeviceErrorTypes.DeviceNotFound,
                    failureCode: DeviceErrorCodes.DeviceNotFound);
            }
            return Results.Ok(items);
        })
        .RequireAuthorization("Permission_devices.read");

        return app;
    }
}
