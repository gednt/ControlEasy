using ControlEasyReborn.Modules.ServiceProviders.Application.Contracts;
using ControlEasyReborn.Modules.ServiceProviders.Application.Errors;
using ControlEasyReborn.Modules.ServiceProviders.Application.Handlers;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace ControlEasyReborn.Modules.ServiceProviders.Api.Endpoints;

public static class ServiceProviderEndpoints
{
    public static IEndpointRouteBuilder MapServiceProviderEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/service-providers")
            .RequireAuthorization()
            .WithTags("Service Providers");

        group.MapGet("/", async (
            string? search,
            int? skip,
            int? take,
            ListServiceProvidersHandler handler,
            CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(search, skip ?? 0, take ?? 50, ct);
            return Results.Ok(response);
        });

        group.MapGet("/{id:guid}", async (
            Guid id,
            GetServiceProviderHandler handler,
            CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(id, ct);
            return Results.Ok(response);
        });

        group.MapPost("/", async (
            [FromBody] CreateServiceProviderRequest request,
            ITenantContext tenantContext,
            CreateServiceProviderHandler handler,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var response = await handler.HandleAsync(request, tenantId, ct);
            return Results.Created($"/api/v1/service-providers/{response.Id}", response);
        }).RequireAuthorization("Permission_ServiceProviders.Write");

        group.MapPut("/{id:guid}", async (
            Guid id,
            [FromBody] UpdateServiceProviderRequest request,
            UpdateServiceProviderHandler handler,
            CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(id, request, ct);
            return Results.Ok(response);
        }).RequireAuthorization("Permission_ServiceProviders.Write");

        group.MapPost("/{id:guid}/deactivate", async (
            Guid id,
            DeactivateServiceProviderHandler handler,
            CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(id, ct);
            return Results.Ok(response);
        }).RequireAuthorization("Permission_ServiceProviders.Write");

        return app;
    }
}

public static class ServiceProviderProblemDetailsWriter
{
    public static IApplicationBuilder UseServiceProviderExceptionHandler(this IApplicationBuilder app)
    {
        return app.Use(async (context, next) =>
        {
            try
            {
                await next();
            }
            catch (NotFoundException ex)
            {
                await Write(context, StatusCodes.Status404NotFound, "Not found", ex.Message);
            }
            catch (ConflictException ex)
            {
                await Write(context, StatusCodes.Status409Conflict, "Conflict", ex.Message);
            }
            catch (ValidationException ex)
            {
                var pd = new
                {
                    type = "https://httpstatuses.io/400",
                    title = "Validation failed",
                    status = 400,
                    detail = ex.Message,
                    errors = ex.Errors
                };
                context.Response.StatusCode = 400;
                context.Response.ContentType = "application/problem+json";
                await context.Response.WriteAsJsonAsync(pd);
            }
        });
    }

    private static async Task Write(HttpContext context, int status, string title, string detail)
    {
        context.Response.StatusCode = status;
        context.Response.ContentType = "application/problem+json";
        await context.Response.WriteAsJsonAsync(new
        {
            type = "https://httpstatuses.io/" + status,
            title,
            status,
            detail
        });
    }
}
