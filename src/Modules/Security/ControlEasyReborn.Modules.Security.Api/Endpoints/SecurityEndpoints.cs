using ControlEasyReborn.Modules.Security.Api.Auth;
using ControlEasyReborn.Modules.Security.Application.Contracts;
using ControlEasyReborn.Modules.Security.Application.Errors;
using ControlEasyReborn.Modules.Security.Application.Handlers;
using ControlEasyReborn.Modules.Tenants.Api.Auth;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace ControlEasyReborn.Modules.Security.Api.Endpoints;

public static class SecurityEndpoints
{
    public static IEndpointRouteBuilder MapSecurityEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/security")
            .WithTags("Security");

        group.MapPost("/auth/login", async (
            [FromBody] LoginRequest request,
            LoginHandler handler,
            CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(request, ct);
            return Results.Ok(response);
        }).AllowAnonymous();

        group.MapPost("/auth/forgot-password", async (
            [FromBody] ForgotPasswordRequest request,
            ForgotPasswordHandler handler,
            CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(request, ct);
            return Results.Ok(response);
        }).AllowAnonymous()
          .RequireRateLimiting("forgot-password");

        group.MapPost("/auth/refresh", async (
            [FromBody] RefreshRequest request,
            RefreshHandler handler,
            CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(request, ct);
            return Results.Ok(response);
        }).AllowAnonymous();

        group.MapPost("/auth/change-password", async (
            [FromBody] ChangePasswordRequest request,
            ChangePasswordHandler handler,
            CancellationToken ct) =>
        {
            await handler.HandleAsync(request, ct);
            return Results.NoContent();
        }).RequireAuthorization();

        group.MapGet("/tenants", async (
            string email,
            TenantLookupHandler handler,
            CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(email, ct);
            return Results.Ok(response);
        }).AllowAnonymous();

        group.MapPost("/users", async (
            [FromBody] CreateUserRequest request,
            CreateUserHandler handler,
            CancellationToken ct) =>
        {
            var user = await handler.HandleAsync(request, ct);
            return Results.Created($"/api/v1/security/users/{user.Id}", new { user.Id, user.Email, user.DisplayName, user.Roles });
        }).RequireAuthorization(PlatformAdminRequirement.PolicyName);

        group.MapPost("/users/{userId:guid}/reset-password", async (
            Guid userId,
            ResetUserPasswordHandler handler,
            CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(userId, ct);
            return Results.Ok(response);
        }).RequireAuthorization();

        group.MapGet("/staff", async (
            ITenantContext tenantContext,
            ListStaffHandler handler,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var response = await handler.HandleAsync(tenantId, ct);
            return Results.Ok(response);
        }).RequireAuthorization();

        var attendantGroup = group.MapGroup("/attendant-profiles")
            .RequireAuthorization();

        attendantGroup.MapGet("/", async (
            ITenantContext tenantContext,
            ListAttendantProfilesHandler handler,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var response = await handler.HandleAsync(tenantId, ct);
            return Results.Ok(response);
        });

        attendantGroup.MapGet("/me", async (
            GetMyProfileHandler handler,
            CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(ct);
            return Results.Ok(response);
        });

        attendantGroup.MapPost("/", async (
            [FromBody] CreateAttendantProfileRequest request,
            ITenantContext tenantContext,
            CreateAttendantProfileHandler handler,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var response = await handler.HandleAsync(request, tenantId, ct);
            return Results.Created($"/api/v1/security/attendant-profiles/{response.Id}", response);
        });

        attendantGroup.MapGet("/{id:guid}", async (
            Guid id,
            GetAttendantProfileHandler handler,
            CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(id, ct);
            return Results.Ok(response);
        });

        attendantGroup.MapPut("/{id:guid}", async (
            Guid id,
            [FromBody] UpdateAttendantProfileRequest request,
            UpdateAttendantProfileHandler handler,
            CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(id, request, ct);
            return Results.Ok(response);
        });

        attendantGroup.MapPost("/{id:guid}/deactivate", async (
            Guid id,
            DeactivateAttendantProfileHandler handler,
            CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(id, ct);
            return Results.Ok(response);
        });

        var shiftsGroup = group.MapGroup("/shifts")
            .RequireAuthorization();

        shiftsGroup.MapPost("/", async (
            [FromBody] CreateShiftRequest request,
            ITenantContext tenantContext,
            CreateShiftHandler handler,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var response = await handler.HandleAsync(request, tenantId, ct);
            return Results.Created($"/api/v1/security/shifts/{response.Id}", response);
        });

        shiftsGroup.MapGet("/", async (
            ITenantContext tenantContext,
            ListShiftsHandler handler,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var response = await handler.HandleAsync(tenantId, ct);
            return Results.Ok(response);
        });

        var gatehousesGroup = group.MapGroup("/gatehouses")
            .RequireAuthorization();

        gatehousesGroup.MapPost("/", async (
            [FromBody] CreateGatehouseRequest request,
            ITenantContext tenantContext,
            CreateGatehouseHandler handler,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var response = await handler.HandleAsync(request, tenantId, ct);
            return Results.Created($"/api/v1/security/gatehouses/{response.Id}", response);
        })
        .Produces<GatehouseResponse>(StatusCodes.Status201Created)
        .ProducesValidationProblem(StatusCodes.Status400BadRequest);

        gatehousesGroup.MapGet("/", async (
            [FromQuery] bool? includeInactive,
            HttpContext httpContext,
            IAuthorizationService authorizationService,
            ITenantContext tenantContext,
            ListGatehousesHandler handler,
            CancellationToken ct) =>
        {
            if (includeInactive == true)
            {
                var authorized = await authorizationService.AuthorizeAsync(
                    httpContext.User,
                    resource: null,
                    policyName: "Permission_devices.write");
                if (!authorized.Succeeded)
                {
                    return Results.Forbid();
                }
            }

            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var response = await handler.HandleAsync(tenantId, includeInactive == true, ct);
            return Results.Ok(response);
        })
        .Produces<IReadOnlyList<GatehouseResponse>>(StatusCodes.Status200OK);

        gatehousesGroup.MapPut("/{id:guid}", async (
            Guid id,
            [FromBody] UpdateGatehouseRequest request,
            UpdateGatehouseHandler handler,
            CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(id, request, ct);
            return Results.Ok(response);
        })
        .Produces<GatehouseResponse>(StatusCodes.Status200OK)
        .ProducesValidationProblem(StatusCodes.Status400BadRequest)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .RequireAuthorization("Permission_devices.write");

        gatehousesGroup.MapPut("/{id:guid}/activation", async (
            Guid id,
            [FromBody] SetGatehouseActivationRequest request,
            SetGatehouseActivationHandler handler,
            CancellationToken ct) =>
        {
            if (request.Active is not bool active)
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    [nameof(request.Active)] = ["Active is required."],
                });
            }

            var response = await handler.HandleAsync(id, active, ct);
            return Results.Ok(response);
        })
        .Produces<GatehouseResponse>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status404NotFound)
        .RequireAuthorization("Permission_devices.write");

        group.MapPost("/tenant-switch", async (
            [FromBody] TenantSwitchRequest request,
            TenantSwitchHandler handler,
            CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(request, ct);
            return Results.Ok(response);
        }).RequireAuthorization();

        group.MapGet("/session", async (
            GetSessionHandler handler,
            CancellationToken ct) =>
        {
            var response = await handler.HandleAsync(ct);
            return Results.Ok(response);
        }).RequireAuthorization();

        return app;
    }
}

public static class SecurityProblemDetailsWriter
{
    public static IApplicationBuilder UseSecurityExceptionHandler(this IApplicationBuilder app)
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
            catch (UnauthorizedException ex)
            {
                await Write(context, StatusCodes.Status401Unauthorized, "Unauthorized", ex.Message);
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
