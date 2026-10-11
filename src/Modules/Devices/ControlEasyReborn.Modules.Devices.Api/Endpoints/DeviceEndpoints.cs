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

        // GET /api/v1/devices — list (returns admin-managed devices).
        group.MapGet("/", async (
            ITenantContext tenantContext,
            IDeviceRepository devices,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var rows = await devices.ListAsync(tenantId, ct);
            var items = rows.Select(d => new DeviceListItemDto(
                d.Id,
                d.DeviceType,
                d.Vendor,
                d.GatehouseId,
                d.IsActive,
                d.CreatedAtUtc,
                d.UpdatedAtUtc)).ToArray();
            return Results.Ok(items);
        })
        .RequireAuthorization("Permission_devices.read");

        // GET /api/v1/devices/{deviceId} — full detail (connection params always redacted).
        group.MapGet("/{deviceId:guid}", async (
            Guid deviceId,
            ITenantContext tenantContext,
            IDeviceRepository devices,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var device = await devices.GetByIdAsync(tenantId, deviceId, ct);
            if (device is null || device.IsRemoved)
            {
                return ProblemResults.NotFound(
                    title: DeviceErrorTitles.DeviceNotFound,
                    detail: $"Device {deviceId} not found.",
                    type: DeviceErrorTypes.DeviceNotFound,
                    failureCode: DeviceErrorCodes.DeviceNotFound);
            }
            return Results.Ok(RegisterDeviceHandler.ToDetail(device));
        })
        .RequireAuthorization("Permission_devices.read");

        // POST /api/v1/devices — register a new device (DOOR-06).
        group.MapPost("/", async (
            [FromBody] RegisterDeviceRequest request,
            ITenantContext tenantContext,
            RegisterDeviceHandler handler,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var profileId = tenantContext.ProfileId
                ?? throw new InvalidOperationException("Actor profile is not resolved.");

            var detail = await handler.HandleAsync(tenantId, request, profileId, ct);
            return Results.Created($"/api/v1/devices/{detail.Id}", detail);
        })
        .RequireAuthorization("Permission_devices.write");

        // PATCH /api/v1/devices/{deviceId} — partial update (DOOR-06).
        group.MapPatch("/{deviceId:guid}", async (
            Guid deviceId,
            [FromBody] EditDeviceRequest request,
            ITenantContext tenantContext,
            EditDeviceHandler handler,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var profileId = tenantContext.ProfileId
                ?? throw new InvalidOperationException("Actor profile is not resolved.");

            var detail = await handler.HandleAsync(tenantId, deviceId, request, profileId, ct);
            return Results.Ok(detail);
        })
        .RequireAuthorization("Permission_devices.write");

        // PUT /api/v1/devices/{deviceId}/activation — toggle IsActive (DOOR-06).
        group.MapPut("/{deviceId:guid}/activation", async (
            Guid deviceId,
            [FromBody] SetDeviceActivationRequest request,
            ITenantContext tenantContext,
            ActivateDeactivateDeviceHandler handler,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var profileId = tenantContext.ProfileId
                ?? throw new InvalidOperationException("Actor profile is not resolved.");

            var detail = await handler.HandleAsync(tenantId, deviceId, request.IsActive, profileId, ct);
            return Results.Ok(detail);
        })
        .RequireAuthorization("Permission_devices.write");

        // DELETE /api/v1/devices/{deviceId} — soft-delete (DOOR-06).
        group.MapDelete("/{deviceId:guid}", async (
            Guid deviceId,
            ITenantContext tenantContext,
            RemoveDeviceHandler handler,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var profileId = tenantContext.ProfileId
                ?? throw new InvalidOperationException("Actor profile is not resolved.");

            await handler.HandleAsync(tenantId, deviceId, profileId, ct);
            return Results.NoContent();
        })
        .RequireAuthorization("Permission_devices.write");

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
                title: DeviceErrorTitles.DeviceNotFound,
                detail: result.FailureDetail ?? "Device not found.",
                type: DeviceErrorTypes.DeviceNotFound,
                failureCode: result.FailureCode ?? DeviceErrorCodes.DeviceNotFound),

            DoorUnlockResultKind.DeviceInactive => ProblemResults.NotFound(
                title: DeviceErrorTitles.DeviceInactive,
                detail: result.FailureDetail ?? "Device is inactive.",
                type: DeviceErrorTypes.DeviceInactive,
                failureCode: result.FailureCode ?? DeviceErrorCodes.DeviceInactive),

            DoorUnlockResultKind.UnknownTenantFlag => ProblemResults.NotFound(
                title: DeviceErrorTitles.TenantDoorIntegrationDisabled,
                detail: result.FailureDetail ?? "Door integration is not enabled for this tenant.",
                type: DeviceErrorTypes.TenantDoorIntegrationDisabled,
                failureCode: result.FailureCode ?? DeviceErrorCodes.TenantDoorIntegrationDisabled),

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

internal static class DeviceErrorTitles
{
    public const string DeviceNotFound = "device-not-found";
    public const string DeviceInactive = "device-inactive";
    public const string TenantDoorIntegrationDisabled = "tenant-door-integration-disabled";
    public const string GatehouseNotFound = "device-gatehouse-not-found";
    public const string RemoveBlockedByRecentActivity = "device-remove-recent-activity";
}

internal static class DeviceErrorTypes
{
    public const string DeviceNotFound = "https://errors.controleasy.app/devices/device-not-found";
    public const string DeviceInactive = "https://errors.controleasy.app/devices/device-inactive";
    public const string TenantDoorIntegrationDisabled = "https://errors.controleasy.app/devices/tenant-door-integration-disabled";
    public const string GatehouseNotFound = "https://errors.controleasy.app/devices/device-gatehouse-not-found";
    public const string RemoveBlockedByRecentActivity = "https://errors.controleasy.app/devices/device-remove-recent-activity";
}

internal static class DeviceErrorCodes
{
    public const string DeviceNotFound = "device_not_found";
    public const string DeviceInactive = "device_inactive";
    public const string TenantDoorIntegrationDisabled = "tenant_door_integration_disabled";
    public const string GatehouseNotFound = "gatehouse_not_found";
    public const string RemoveBlockedByRecentActivity = "device_remove_recent_activity";
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