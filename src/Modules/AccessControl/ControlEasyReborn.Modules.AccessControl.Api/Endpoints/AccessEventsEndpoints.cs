using ControlEasyReborn.Modules.AccessControl.Application.Abstractions;
using ControlEasyReborn.Modules.AccessControl.Application.Commands;
using ControlEasyReborn.Modules.AccessControl.Application.Contracts;
using ControlEasyReborn.Modules.AccessControl.Application.Handlers;
using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using FluentValidation;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace ControlEasyReborn.Modules.AccessControl.Api.Endpoints;

public static class AccessEventsEndpoints
{
    public static IEndpointRouteBuilder MapAccessEventsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/access-events")
            .RequireAuthorization()
            .WithTags("Access Events");

        group.MapPost("/scans", async (
            [FromBody] RecordAccessScanRequest request,
            ITenantContext tenantContext,
            RecordAccessScanHandler handler,
            IValidator<RecordAccessScanCommand> validator,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var profileId = tenantContext.ProfileId ?? Guid.Empty;

            var validation = await validator.ValidateAsync(new RecordAccessScanCommand(
                TenantId: tenantId,
                QrPayload: request.QrPayload,
                Direction: ParseDirection(request.Direction),
                ScanAttemptId: request.ScanAttemptId,
                PerformedByProfileId: profileId,
                GatehouseId: request.GatehouseId,
                ConfirmDuplicate: request.ConfirmDuplicate,
                VisitorName: request.VisitorName,
                VisitorDocument: request.VisitorDocument), ct);

            if (!validation.IsValid)
            {
                throw new Application.Errors.ValidationException(validation.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()));
            }

            var cmd = new RecordAccessScanCommand(
                TenantId: tenantId,
                QrPayload: request.QrPayload,
                Direction: ParseDirection(request.Direction),
                ScanAttemptId: request.ScanAttemptId,
                PerformedByProfileId: profileId,
                GatehouseId: request.GatehouseId,
                ConfirmDuplicate: request.ConfirmDuplicate,
                VisitorName: request.VisitorName,
                VisitorDocument: request.VisitorDocument);

            var result = await handler.HandleAsync(cmd, ct);

            if (result.Decision == ScanDecisionKind.Recorded)
            {
                return Results.Ok(new ScanResponse(
                    Decision: ScanDecisionKindCodes.ToWire(result.Decision),
                    AccessEventId: result.AccessEventId!.Value,
                    SubjectType: SubjectTypeCodes.ToWire(result.SubjectType),
                    SubjectId: result.SubjectId,
                    CredentialId: result.CredentialId,
                    LookupAuditId: null,
                    AccessMethod: AccessMethodCodes.ToWire(result.AccessMethod),
                    Direction: CycleDirectionCodes.ToWire(result.Direction),
                    PolicyOutcome: PolicyOutcomeCodes.ToWire(result.PolicyOutcome),
                    DestinationApartmentId: result.DestinationApartmentId!.Value,
                    DestinationBlock: result.DestinationBlock,
                    DestinationUnit: result.DestinationUnit));
            }

            var problem = new Microsoft.AspNetCore.Mvc.ProblemDetails
            {
                Status = StatusCodes.Status422UnprocessableEntity,
                Title = "Access scan rejected",
                Type = "https://httpstatuses.io/422",
                Detail = result.FailureCode ?? result.Decision.ToString()
            };
            problem.Extensions["failureCode"] = result.FailureCode;
            problem.Extensions["decision"] = ScanDecisionKindCodes.ToWire(result.Decision);
            return Results.Json(problem, statusCode: StatusCodes.Status422UnprocessableEntity);
        })
        .RequireAuthorization("Permission_Access.Access.Operate");

        group.MapGet("/", async (
            [FromQuery] DateTime? fromUtc,
            [FromQuery] DateTime? toUtc,
            [FromQuery] string? direction,
            [FromQuery] string? subjectType,
            [FromQuery] Guid? subjectId,
            [FromQuery] string? credentialStatus,
            [FromQuery] Guid? gatehouseId,
            [FromQuery] Guid? attendantProfileId,
            [FromQuery] int? skip,
            [FromQuery] int? take,
            ITenantContext tenantContext,
            IAccessEventRepository events,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");

            CycleDirection? directionFilter = direction?.ToLowerInvariant() switch
            {
                "entrance" => CycleDirection.Entrance,
                "exit" => CycleDirection.Exit,
                _ => null
            };

            SubjectType? subjectTypeFilter = subjectType?.ToLowerInvariant() switch
            {
                "resident" => SubjectType.Resident,
                "vehicle" => SubjectType.Vehicle,
                _ => null
            };

            CredentialStatus? statusFilter = null;
            if (!string.IsNullOrWhiteSpace(credentialStatus))
            {
                CredentialStatusCodes.TryParse(credentialStatus, out var parsed);
                statusFilter = parsed;
            }

            var list = await events.ListAsync(
                tenantId,
                fromUtc,
                toUtc,
                directionFilter,
                subjectTypeFilter,
                subjectId,
                accessMethod: null,
                credentialStatus: statusFilter,
                gatehouseId,
                attendantProfileId,
                skip ?? 0,
                Math.Min(take ?? 50, 200),
                ct);

            return Results.Ok(list.Select(MapEventSummary));
        })
        .RequireAuthorization("Permission_Access.Read");

        group.MapGet("/refused-attempts", async (
            [FromQuery] DateTime? fromUtc,
            [FromQuery] DateTime? toUtc,
            [FromQuery] string? direction,
            [FromQuery] string? failureCode,
            [FromQuery] Guid? attendantProfileId,
            [FromQuery] int? skip,
            [FromQuery] int? take,
            ITenantContext tenantContext,
            IRefusedScanAttemptRepository refusals,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");

            CycleDirection? directionFilter = direction?.ToLowerInvariant() switch
            {
                "entrance" => CycleDirection.Entrance,
                "exit" => CycleDirection.Exit,
                _ => null
            };

            var list = await refusals.ListAsync(
                tenantId,
                fromUtc,
                toUtc,
                directionFilter,
                failureCode,
                attendantProfileId,
                skip ?? 0,
                Math.Min(take ?? 50, 200),
                ct);

            return Results.Ok(list.Select(MapRefusalSummary));
        })
        .RequireAuthorization("Permission_Access.Read");

        var subjectsGroup = app.MapGroup("/api/v1/access-subjects")
            .RequireAuthorization()
            .WithTags("Access Subjects");

        subjectsGroup.MapPost("/search", async (
            [FromBody] LookupSubjectRequest request,
            ITenantContext tenantContext,
            LookupSubjectHandler handler,
            IValidator<LookupSubjectCommand> validator,
            CancellationToken ct) =>
        {
            var tenantId = tenantContext.TenantId
                ?? throw new InvalidOperationException("Tenant context is not resolved.");
            var profileId = tenantContext.ProfileId ?? Guid.Empty;

            if (!LookupCriterionTypeCodes.TryParse(request.Criterion, out var criterion))
            {
                throw new Application.Errors.ValidationException(new Dictionary<string, string[]>
                {
                    ["Criterion"] = new[] { "Unknown criterion." }
                });
            }

            var cmd = new LookupSubjectCommand(
                TenantId: tenantId,
                Criterion: criterion,
                Value: request.Value,
                Unit: request.Unit);

            var validation = await validator.ValidateAsync(cmd, ct);
            if (!validation.IsValid)
            {
                throw new Application.Errors.ValidationException(validation.Errors
                    .GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()));
            }

            var result = await handler.HandleAsync(cmd, profileId, ct);
            return Results.Ok(new LookupResponse(
                LookupAuditId: result.LookupAuditId,
                Criterion: LookupCriterionTypeCodes.ToWire(result.CriterionType),
                ResultCountBand: ResultCountBandRules.ToWire(result.ResultCountBand),
                Items: result.Items.Select(i => new LookupResponseItem(
                    i.SubjectType,
                    i.SubjectId,
                    i.ApartmentId,
                    i.ApartmentBlock,
                    i.ApartmentUnit,
                    i.DisplayName,
                    i.DocumentMasked,
                    i.Plate)).ToArray()));
        })
        .RequireAuthorization("Permission_Access.Access.Operate");

        group.MapPost("/manual", async (
            [FromBody] RecordManualAccessRequest request,
            ITenantContext tenantContext,
            RecordManualAccessHandler handler,
            IValidator<RecordManualAccessCommand> validator,
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

            var cmd = new RecordManualAccessCommand(
                TenantId: tenantId,
                LookupAuditId: request.LookupAuditId,
                SubjectType: subjectType,
                SubjectId: request.SubjectId,
                Direction: ParseDirection(request.Direction),
                PerformedByProfileId: profileId,
                GatehouseId: request.GatehouseId);

            var validation = await validator.ValidateAsync(cmd, ct);
            if (!validation.IsValid)
            {
                throw new Application.Errors.ValidationException(validation.Errors
                    .GroupBy(e => e.PropertyName)
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()));
            }

            var result = await handler.HandleAsync(cmd, ct);
            return Results.Ok(new ManualAccessResponse(
                AccessEventId: result.AccessEventId,
                LookupAuditId: result.LookupAuditId,
                SubjectType: SubjectTypeCodes.ToWire(result.SubjectType),
                SubjectId: result.SubjectId,
                AccessMethod: AccessMethodCodes.ToWire(result.AccessMethod),
                Direction: CycleDirectionCodes.ToWire(result.Direction),
                PolicyOutcome: PolicyOutcomeCodes.ToWire(result.PolicyOutcome),
                DestinationApartmentId: result.DestinationApartmentId,
                DestinationBlock: result.DestinationBlock,
                DestinationUnit: result.DestinationUnit));
        })
        .RequireAuthorization("Permission_Access.Access.Operate");

        return app;
    }

    private static object MapEventSummary(Domain.Entities.AccessEvent e) => new
    {
        id = e.Id,
        tenantId = e.TenantId,
        subjectType = SubjectTypeCodes.ToWire(e.SubjectType),
        subjectId = e.SubjectId,
        direction = CycleDirectionCodes.ToWire(e.Direction),
        accessMethod = AccessMethodCodes.ToWire(e.AccessMethod),
        credentialId = e.CredentialId,
        lookupAuditId = e.LookupAuditId,
        occurredAtUtc = e.OccurredAtUtc,
        performedByProfileId = e.PerformedByProfileId,
        gatehouseId = e.GatehouseId,
        policyOutcome = PolicyOutcomeCodes.ToWire(e.PolicyOutcome),
        destinationApartmentId = e.DestinationApartmentId,
        destinationBlock = e.DestinationBlock,
        destinationUnit = e.DestinationUnit
    };

    private static object MapRefusalSummary(Domain.Entities.RefusedScanAttempt r) => new
    {
        id = r.Id,
        tenantId = r.TenantId,
        scanAttemptId = r.ScanAttemptId,
        failureCode = r.FailureCode,
        occurredAtUtc = r.OccurredAtUtc,
        performedByProfileId = r.PerformedByProfileId,
        gatehouseId = r.GatehouseId,
        direction = r.Direction.HasValue ? CycleDirectionCodes.ToWire(r.Direction.Value) : null,
        relatedCredentialId = r.RelatedCredentialId,
        relatedSubjectId = r.RelatedSubjectId
    };

    private static CycleDirection ParseDirection(string? value) => value?.ToLowerInvariant() switch
    {
        "exit" => CycleDirection.Exit,
        _ => CycleDirection.Entrance
    };
}