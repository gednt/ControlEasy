using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Application.Handlers;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace ControlEasyReborn.Modules.Devices.Api.Endpoints;

public static class DeviceEndpoints
{
    public static IEndpointRouteBuilder MapDevicesEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/devices")
            .RequireAuthorization()
            .WithTags("Devices");

        // POST /api/v1/devices/{deviceId}/unlock
        // Bearer JWT (porteiro role) — HMAC-signed body over the canonical line.
        // Returns 200 on success, 401 on auth failure, 403 on wrong role,
        // 404 on tenant flag off or unknown device, 429 on rate limit.
        group.MapPost("/{deviceId:guid}/unlock", async (
            Guid deviceId,
            [FromBody] DoorUnlockRequest request,
            ITenantContext tenantContext,
            UnlockDeviceHandler handler,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var profileId = tenantContext.ProfileId
                ?? throw new InvalidOperationException("Actor profile is not resolved.");

            var result = await handler.HandleAsync(tenantId, deviceId, profileId, request, ct);
            return Translate(result, deviceId);
        })
        .RequireAuthorization("Permission_devices.unlock");

        // GET /api/v1/devices/{deviceId} — list with redacted connection params.
        group.MapGet("/{deviceId:guid}", () =>
        {
            return Results.NotFound();
        })
        .RequireAuthorization("Permission_devices.read");

        // GET /api/v1/devices — list (returns empty in Phase 23; Phase 24 adds admin).
        group.MapGet("/", () =>
        {
            return Results.Ok(Array.Empty<object>());
        })
        .RequireAuthorization("Permission_devices.read");

        // POST /api/v1/devices — reserved for Phase 24 device registration. Returns
        // 501 today; the route exists so OpenAPI generates a stable contract.
        group.MapPost("/", () =>
        {
            return Results.Json(
                new
                {
                    error = "not_implemented",
                    message = "Device registration is delivered in Phase 24 (Device Administration)."
                },
                statusCode: StatusCodes.Status501NotImplemented);
        })
        .RequireAuthorization("Permission_devices.read");

        return app;
    }

    private static IResult Translate(DoorUnlockResult result, Guid deviceId)
    {
        return result.Outcome switch
        {
            DoorUnlockResultKind.Success => Results.Ok(new DoorUnlockResponse(
                DeviceId: deviceId,
                Outcome: "success",
                OccurredAtUtc: result.OccurredAtUtc,
                CorrelationId: result.CorrelationId)),

            DoorUnlockResultKind.AuthFailed => ProblemResults.Unauthorized(
                title: "unlock-signature-invalid",
                detail: result.FailureDetail ?? "Signature, timestamp, or nonce validation failed.",
                type: "https://errors.controleasy.app/devices/unlock-signature-invalid",
                failureCode: result.FailureCode ?? "auth_failed"),

            DoorUnlockResultKind.RateLimited => ProblemResults.TooManyRequests(
                title: "unlock-rate-limited",
                detail: result.FailureDetail ?? "Too many unlock attempts for this device.",
                type: "https://errors.controleasy.app/devices/unlock-rate-limited",
                failureCode: result.FailureCode ?? "rate_limited",
                correlationId: result.CorrelationId),

            DoorUnlockResultKind.UnknownDevice => ProblemResults.NotFound(
                title: "device-not-found",
                detail: result.FailureDetail ?? "Device not found.",
                type: "https://errors.controleasy.app/devices/device-not-found",
                failureCode: result.FailureCode ?? "device_not_found"),

            DoorUnlockResultKind.DeviceInactive => ProblemResults.NotFound(
                title: "device-inactive",
                detail: result.FailureDetail ?? "Device is inactive.",
                type: "https://errors.controleasy.app/devices/device-inactive",
                failureCode: result.FailureCode ?? "device_inactive"),

            DoorUnlockResultKind.UnknownTenantFlag => ProblemResults.NotFound(
                title: "tenant-door-integration-disabled",
                detail: result.FailureDetail ?? "Door integration is not enabled for this tenant.",
                type: "https://errors.controleasy.app/devices/tenant-door-integration-disabled",
                failureCode: result.FailureCode ?? "tenant_door_integration_disabled"),

            DoorUnlockResultKind.DeviceOffline => ProblemResults.ServiceUnavailable(
                title: "device-offline",
                detail: result.FailureDetail ?? "Device is offline.",
                type: "https://errors.controleasy.app/devices/device-offline",
                failureCode: result.FailureCode ?? "device_offline",
                correlationId: result.CorrelationId),

            _ => ProblemResults.InternalError("Unexpected unlock outcome.")
        };
    }
}

internal static class ProblemResults
{
    public static IResult Unauthorized(string title, string detail, string type, string failureCode) =>
        Results.Json(
            new
            {
                type,
                title,
                status = StatusCodes.Status401Unauthorized,
                detail,
                failureCode
            },
            statusCode: StatusCodes.Status401Unauthorized);

    public static IResult TooManyRequests(string title, string detail, string type, string failureCode, Guid correlationId) =>
        Results.Json(
            new
            {
                type,
                title,
                status = StatusCodes.Status429TooManyRequests,
                detail,
                failureCode,
                correlationId
            },
            statusCode: StatusCodes.Status429TooManyRequests);

    public static IResult NotFound(string title, string detail, string type, string failureCode) =>
        Results.Json(
            new
            {
                type,
                title,
                status = StatusCodes.Status404NotFound,
                detail,
                failureCode
            },
            statusCode: StatusCodes.Status404NotFound);

    public static IResult ServiceUnavailable(string title, string detail, string type, string failureCode, Guid correlationId) =>
        Results.Json(
            new
            {
                type,
                title,
                status = StatusCodes.Status503ServiceUnavailable,
                detail,
                failureCode,
                correlationId
            },
            statusCode: StatusCodes.Status503ServiceUnavailable);

    public static IResult InternalError(string detail) =>
        Results.Json(
            new
            {
                type = "https://errors.controleasy.app/devices/unexpected",
                title = "internal-error",
                status = StatusCodes.Status500InternalServerError,
                detail
            },
            statusCode: StatusCodes.Status500InternalServerError);
}