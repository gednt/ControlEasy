using ControlEasyReborn.Modules.AccessControl.Application.Abstractions;
using ControlEasyReborn.Modules.AccessControl.Application.Commands;
using ControlEasyReborn.Modules.AccessControl.Application.Handlers;
using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using FluentValidation;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace ControlEasyReborn.Modules.AccessControl.Api.Endpoints;

public static class AccessCredentialsEndpoints
{
    public static IEndpointRouteBuilder MapAccessCredentialsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/access-credentials")
            .RequireAuthorization()
            .WithTags("Access Credentials");

        group.MapGet("/{id:guid}", async (
            Guid id,
            ITenantContext tenantContext,
            IAccessCredentialRepository credentials,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var credential = await credentials.FindByIdAsync(tenantId, id, ct);
            if (credential is null) return Results.NotFound();
            return Results.Ok(MapCredentialSummary(credential));
        })
        .RequireAuthorization("Permission_Access.Read");

        group.MapGet("/", async (
            [FromQuery] string? subjectType,
            [FromQuery] Guid? subjectId,
            [FromQuery] string? status,
            [FromQuery] int? skip,
            [FromQuery] int? take,
            ITenantContext tenantContext,
            IAccessCredentialRepository credentials,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");

            SubjectType? subjectTypeFilter = subjectType?.ToLowerInvariant() switch
            {
                "resident" => SubjectType.Resident,
                "vehicle" => SubjectType.Vehicle,
                "visitor" => SubjectType.Visitor,
                _ => null
            };

            CredentialStatus? statusFilter = null;
            if (!string.IsNullOrWhiteSpace(status))
            {
                CredentialStatusCodes.TryParse(status, out var parsed);
                statusFilter = parsed;
            }

            var list = await credentials.ListAsync(
                tenantId,
                skip ?? 0,
                Math.Min(take ?? 50, 200),
                ct,
                subjectId: subjectId,
                subjectType: subjectTypeFilter,
                status: statusFilter);

            return Results.Ok(list.Select(MapCredentialSummary));
        })
        .RequireAuthorization("Permission_Access.Read");

        group.MapPost("/", async (
            [FromBody] IssueCredentialRequest request,
            ITenantContext tenantContext,
            IssueCredentialHandler handler,
            IValidator<IssueCredentialCommand> validator,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var profileId = tenantContext.ProfileId ?? Guid.Empty;

            if (!SubjectTypeCodes.TryParse(request.SubjectType, out var subjectType))
            {
                throw new Application.Errors.ValidationException(new Dictionary<string, string[]>
                {
                    ["SubjectType"] = new[] { "Unknown subject type." }
                });
            }

            var cmd = new IssueCredentialCommand(
                TenantId: tenantId,
                SubjectType: subjectType,
                SubjectId: request.SubjectId,
                ValidFromUtc: request.ValidFromUtc ?? DateTime.UtcNow,
                ExpiresAtUtc: request.ExpiresAtUtc,
                IssuedByProfileId: profileId);

            var validation = await validator.ValidateAsync(cmd, ct);
            if (!validation.IsValid)
            {
                throw new Application.Errors.ValidationException(validation.Errors
                    .GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()));
            }

            var result = await handler.HandleAsync(cmd, ct);
            return Results.Created(
                $"/api/v1/access-credentials/{result.CredentialId}",
                new
                {
                    id = result.CredentialId,
                    qrPayload = result.QrPayload,
                    oneTimeDisplay = true
                });
        })
        .RequireAuthorization("Permission_Access.Control.Issue");

        group.MapPost("/{id:guid}/replace", async (
            Guid id,
            [FromBody] ReplaceCredentialRequest request,
            ITenantContext tenantContext,
            ReplaceCredentialHandler handler,
            IValidator<ReplaceCredentialCommand> validator,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var profileId = tenantContext.ProfileId ?? Guid.Empty;

            var cmd = new ReplaceCredentialCommand(
                TenantId: tenantId,
                CredentialId: id,
                ValidFromUtc: request.ValidFromUtc ?? DateTime.UtcNow,
                ExpiresAtUtc: request.ExpiresAtUtc,
                IssuedByProfileId: profileId);

            var validation = await validator.ValidateAsync(cmd, ct);
            if (!validation.IsValid)
            {
                throw new Application.Errors.ValidationException(validation.Errors
                    .GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()));
            }

            var result = await handler.HandleAsync(cmd, ct);
            return Results.Ok(new
            {
                newCredentialId = result.NewCredentialId,
                qrPayload = result.NewQrPayload,
                oneTimeDisplay = true
            });
        })
        .RequireAuthorization("Permission_Access.Control.Replace");

        group.MapPost("/{id:guid}/revoke", async (
            Guid id,
            [FromBody] RevokeCredentialRequest request,
            ITenantContext tenantContext,
            RevokeCredentialHandler handler,
            IValidator<RevokeCredentialCommand> validator,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var profileId = tenantContext.ProfileId ?? Guid.Empty;

            var cmd = new RevokeCredentialCommand(
                TenantId: tenantId,
                CredentialId: id,
                ReasonCode: request.ReasonCode,
                ReasonText: request.ReasonText,
                ActorProfileId: profileId);

            var validation = await validator.ValidateAsync(cmd, ct);
            if (!validation.IsValid)
            {
                throw new Application.Errors.ValidationException(validation.Errors
                    .GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()));
            }

            var result = await handler.HandleAsync(cmd, ct);
            return Results.Ok(new
            {
                credentialId = result.CredentialId,
                action = LifecycleActionCodes.ToWire(result.Action),
                resultingStatus = CredentialStatusCodes.ToWire(result.ResultingStatus)
            });
        })
        .RequireAuthorization("Permission_Access.Control.Revoke");

        return app;
    }

    private static object MapCredentialSummary(Domain.Entities.AccessCredential c) => new
    {
        id = c.Id,
        tenantId = c.TenantId,
        subjectType = SubjectTypeCodes.ToWire(c.SubjectType),
        subjectId = c.SubjectId,
        method = CredentialMethodCodes.ToWire(c.Method),
        status = CredentialStatusCodes.ToWire(c.Status),
        validFromUtc = c.ValidFromUtc,
        expiresAtUtc = c.ExpiresAtUtc,
        replacedByCredentialId = c.ReplacedByCredentialId,
        issuedByProfileId = c.IssuedByProfileId,
        createdAtUtc = c.CreatedAtUtc,
        updatedAtUtc = c.UpdatedAtUtc
    };
}

public sealed record IssueCredentialRequest(string SubjectType, Guid SubjectId, DateTime? ValidFromUtc, DateTime? ExpiresAtUtc);

public sealed record ReplaceCredentialRequest(DateTime? ValidFromUtc, DateTime? ExpiresAtUtc);

public sealed record RevokeCredentialRequest(string? ReasonCode, string? ReasonText);