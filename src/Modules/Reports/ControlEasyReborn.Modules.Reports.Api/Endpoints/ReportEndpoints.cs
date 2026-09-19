using ControlEasyReborn.Modules.Reports.Application.Handlers;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace ControlEasyReborn.Modules.Reports.Api.Endpoints;

public static class ReportEndpoints
{
    public static IEndpointRouteBuilder MapReportEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/reports")
            .RequireAuthorization()
            .WithTags("Reports");

        group.MapGet("/visit-counts-by-day", async (
            DateOnly? from,
            DateOnly? to,
            GetVisitCountsByDayHandler handler,
            CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(from, to, ct);
            return Results.Ok(response);
        });

        group.MapGet("/history", async (
            [FromQuery] int? page,
            [FromQuery] int? pageSize,
            [FromQuery] DateOnly? from,
            [FromQuery] DateOnly? to,
            [FromQuery] string? status,
            [FromQuery] string? carrierCode,
            [FromQuery] string? q,
            [FromQuery] Guid? apartmentId,
            SharedKernel.MultiTenancy.ITenantContext tenantContext,
            GetHistoryHandler handler,
            HttpContext httpContext,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var (rows, total) = await handler.HandleAsync(
                tenantId, from, to,
                page ?? 1, pageSize ?? 50,
                status, carrierCode, q, apartmentId, ct);
            httpContext.Response.Headers["X-Total-Count"] = total.ToString();
            return Results.Ok(rows);
        });

        group.MapGet("/residents-per-apartment", async (
            GetResidentsPerApartmentHandler handler,
            CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(ct);
            return Results.Ok(response);
        });

        return app;
    }

    public static IEndpointRouteBuilder MapDashboardEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/dashboard")
            .RequireAuthorization()
            .WithTags("Dashboard");

        group.MapGet("/stats", async (
            GetDashboardStatsHandler handler,
            CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(ct);
            return Results.Ok(response);
        });

        return app;
    }
}
