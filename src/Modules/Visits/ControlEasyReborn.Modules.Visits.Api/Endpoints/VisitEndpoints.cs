using ControlEasyReborn.Modules.Visits.Application.Contracts;
using ControlEasyReborn.Modules.Visits.Application.Handlers;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace ControlEasyReborn.Modules.Visits.Api.Endpoints;

public static class VisitEndpoints
{
    public static IEndpointRouteBuilder MapVisitEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/visits")
            .RequireAuthorization()
            .WithTags("Visits");

        group.MapGet("/", async (
            string? status,
            int? skip,
            int? take,
            ITenantContext tenantContext,
            ListVisitsHandler handler,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var response = await handler.HandleAsync(tenantId, status, skip ?? 0, take ?? 50, ct);
            return Results.Ok(response);
        });

        group.MapGet("/{id:guid}", async (
            Guid id,
            GetVisitHandler handler,
            CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(id, ct);
            return Results.Ok(response);
        });

        group.MapPost("/", async (
            [FromBody] CreateVisitRequest request,
            ITenantContext tenantContext,
            CreateVisitHandler handler,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var profileId = tenantContext.ProfileId;
            // GatehouseId is not resolvable from the JWT tenant context (same as
            // the /checkin endpoint's established null pattern).
            var response = await handler.HandleAsync(request, tenantId, profileId, null, ct);
            return Results.Created($"/api/v1/visits/{response.Id}", response);
        });

        group.MapPost("/{id:guid}/checkin", async (
            Guid id,
            ITenantContext tenantContext,
            CheckInVisitHandler handler,
            CancellationToken ct) =>
        {
            var attendantProfileId = tenantContext.ProfileId
                ?? throw new InvalidOperationException("Attendant profile is not resolved.");
            var response = await handler.HandleAsync(id, attendantProfileId, null, ct);
            return Results.Ok(response);
        });

        group.MapPost("/{id:guid}/checkout", async (
            Guid id,
            CheckOutVisitHandler handler,
            CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(id, ct);
            return Results.Ok(response);
        });

        return app;
    }
}