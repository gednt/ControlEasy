using ControlEasyReborn.Modules.AccessControl.Application.Abstractions;
using ControlEasyReborn.Modules.AccessControl.Application.Commands;
using ControlEasyReborn.Modules.AccessControl.Application.Logging;
using ControlEasyReborn.Modules.AccessControl.Domain.Entities;
using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;
using ControlEasyReborn.Modules.Photos.Application.Abstractions;
using ControlEasyReborn.Modules.Residents.Application.Abstractions;
using ControlEasyReborn.Modules.Vehicles.Application.Abstractions;
using Microsoft.Extensions.Logging;
using System.Diagnostics;

namespace ControlEasyReborn.Modules.AccessControl.Application.Handlers;

public sealed record ManualAccessResult(
    Guid AccessEventId,
    Guid LookupAuditId,
    SubjectType SubjectType,
    Guid SubjectId,
    AccessMethod AccessMethod,
    CycleDirection Direction,
    PolicyOutcome PolicyOutcome,
    Guid DestinationApartmentId,
    string DestinationBlock,
    string DestinationUnit);

public sealed class RecordManualAccessHandler
{
    private readonly IAccessLookupAuditRepository _audits;
    private readonly IAccessEventRepository _events;
    private readonly IAccessControlClock _clock;
    private readonly IConsentPolicyEvaluator _policy;
    private readonly AccessEventDestinationResolver _resolver;
    private readonly ControlEasyReborn.Modules.Visits.Application.Abstractions.IVisitDirectory? _visits;
    private readonly ILogger<RecordManualAccessHandler> _logger;

    public RecordManualAccessHandler(
        IAccessLookupAuditRepository audits,
        IAccessEventRepository events,
        IAccessControlClock clock,
        IConsentPolicyEvaluator policy,
        AccessEventDestinationResolver resolver,
        ControlEasyReborn.Modules.Visits.Application.Abstractions.IVisitDirectory? visits = null,
        ILogger<RecordManualAccessHandler>? logger = null)
    {
        _audits = audits;
        _events = events;
        _clock = clock;
        _policy = policy;
        _resolver = resolver;
        _visits = visits;
        _logger = logger ?? Microsoft.Extensions.Logging.Abstractions.NullLogger<RecordManualAccessHandler>.Instance;
    }

    public async Task<ManualAccessResult> HandleAsync(RecordManualAccessCommand command, CancellationToken ct)
    {
        var stopwatch = Stopwatch.StartNew();
        using var scope = AccessControlLogContext.BeginScope(
            tenantId: command.TenantId,
            profileId: command.PerformedByProfileId,
            gatehouseId: command.GatehouseId,
            lookupAuditId: command.LookupAuditId,
            decision: "manual_access",
            subjectType: SubjectTypeCodes.ToWire(command.SubjectType));

        var nowUtc = _clock.UtcNow;

        var audit = await _audits.FindAsync(command.TenantId, command.LookupAuditId, ct);
        if (audit is null || audit.PerformedByProfileId != command.PerformedByProfileId)
        {
            throw new Application.Errors.ValidationException(new Dictionary<string, string[]>
            {
                ["LookupAuditId"] = new[] { RefusalCodes.ManualEventOrphanLookupId }
            });
        }

        var destination = await _resolver.ResolveAsync(command.TenantId, command.SubjectType, command.SubjectId, ct);
        if (!destination.Resolved)
        {
            throw new Application.Errors.ValidationException(new Dictionary<string, string[]>
            {
                ["SubjectId"] = new[] { destination.FailureCode ?? RefusalCodes.NotAuthorized }
            });
        }

        var policyOutcome = await _policy.EvaluateAsync(SubjectTypeCodes.ToWire(command.SubjectType), command.SubjectId, "manual", ct);
        var policyFinal = policyOutcome switch
        {
            ConsentOutcome.Permitted => PolicyOutcome.Permit,
            ConsentOutcome.RequiresAction => PolicyOutcome.RequiresAction,
            ConsentOutcome.Refused => PolicyOutcome.Refused,
            _ => PolicyOutcome.Refused
        };

        if (policyFinal != PolicyOutcome.Permit)
        {
            throw new Application.Errors.ValidationException(new Dictionary<string, string[]>
            {
                ["SubjectId"] = new[] { RefusalCodes.NotAuthorized }
            });
        }

        var accessEvent = AccessEvent.Record(
            tenantId: command.TenantId,
            subjectType: command.SubjectType,
            subjectId: command.SubjectId,
            direction: command.Direction,
            accessMethod: AccessMethod.ManualLookup,
            credentialId: null,
            lookupAuditId: command.LookupAuditId,
            scanAttemptId: Guid.NewGuid(),
            performedByProfileId: command.PerformedByProfileId,
            gatehouseId: command.GatehouseId,
            occurredAtUtc: nowUtc,
            correlationId: Guid.NewGuid(),
            duplicateOfAccessEventId: null,
            duplicateConfirmed: false,
            policyOutcome: policyFinal,
            destinationApartmentId: destination.ApartmentId!.Value,
            destinationBlock: destination.Block,
            destinationUnit: destination.Unit);

        await _events.AddAsync(accessEvent, ct);

        if (command.SubjectType == SubjectType.Visitor && command.Direction == CycleDirection.Entrance && _visits is not null)
        {
            // Single check-in path (D-01/D-02): route the manual-lookup arrival
            // through the shared VisitorArrivalHandler so QR and manual paths
            // produce identical Visit rows. The visitor profile comes from the
            // looked-up visit the audit points at.
            var visitorProfile = await _resolver.ResolveVisitorProfileAsync(command.TenantId, command.SubjectId, ct);
            var arrival = new ControlEasyReborn.Modules.Visits.Application.Handlers.VisitorArrivalCommand(
                TenantId: command.TenantId,
                VisitorName: visitorProfile?.Name ?? "Visitor",
                VisitorDocument: visitorProfile?.Document ?? string.Empty,
                VisitorPhone: visitorProfile?.Phone,
                DestinationApartmentId: destination.ApartmentId!.Value,
                DestinationBlock: destination.Block,
                DestinationUnit: destination.Unit,
                Purpose: visitorProfile?.Purpose,
                AttendantProfileId: command.PerformedByProfileId,
                GatehouseId: command.GatehouseId,
                OccurredAtUtc: nowUtc);
            await _visits.RegisterArrivalAsync(arrival, ct);
        }

        stopwatch.Stop();
        using (AccessControlLogContext.PushDuration(stopwatch.ElapsedMilliseconds))
        {
            _logger.LogInformation(
                "AccessControl manual access recorded eventId={AccessEventId} subjectId={SubjectId} elapsedMs={ElapsedMs}",
                accessEvent.Id,
                accessEvent.SubjectId,
                stopwatch.ElapsedMilliseconds);
        }

        return new ManualAccessResult(
            AccessEventId: accessEvent.Id,
            LookupAuditId: command.LookupAuditId,
            SubjectType: command.SubjectType,
            SubjectId: command.SubjectId,
            AccessMethod: AccessMethod.ManualLookup,
            Direction: command.Direction,
            PolicyOutcome: policyFinal,
            DestinationApartmentId: accessEvent.DestinationApartmentId,
            DestinationBlock: accessEvent.DestinationBlock,
            DestinationUnit: accessEvent.DestinationUnit);
    }
}