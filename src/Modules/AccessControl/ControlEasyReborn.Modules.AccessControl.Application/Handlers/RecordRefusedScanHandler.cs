using ControlEasyReborn.Modules.AccessControl.Application.Abstractions;
using ControlEasyReborn.Modules.AccessControl.Domain.Entities;
using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;
using ControlEasyReborn.SharedKernel.Auditing;

namespace ControlEasyReborn.Modules.AccessControl.Application.Handlers;

// Phase 25 — Public refused-scan handler used by the Devices
// IngestDeviceEventHandler (single-write-path doctrine: the Devices
// module NEVER writes to the RefusedScanAttempts table directly; it
// always goes through this handler, which mirrors the existing
// RecordAccessScanHandler.RecordRefusalAsync internal helper).
//
// Allowed failure codes are validated against the existing
// RefusalCodes.All whitelist (CredentialStatus.cs) so the same
// RefusedScanAttempt validation runs regardless of caller.
public sealed record RecordRefusedScanCommand(
    Guid TenantId,
    Guid ScanAttemptId,
    byte[]? CredentialFingerprint,
    CycleDirection? Direction,
    string FailureCode,
    Guid PerformedByProfileId,
    Guid? GatehouseId,
    DateTime OccurredAtUtc,
    Guid? RelatedCredentialId,
    Guid? RelatedSubjectId);

public sealed class RecordRefusedScanHandler
{
    private readonly IRefusedScanAttemptRepository _refusals;
    private readonly IAccessControlClock _clock;
    private readonly IAuditLogWriter? _auditWriter;

    public RecordRefusedScanHandler(
        IRefusedScanAttemptRepository refusals,
        IAccessControlClock clock,
        IAuditLogWriter? auditWriter = null)
    {
        _refusals = refusals;
        _clock = clock;
        _auditWriter = auditWriter;
    }

    public async Task<Guid> HandleAsync(RecordRefusedScanCommand command, CancellationToken ct)
    {
        var correlationId = Guid.NewGuid();
        var occurredAtUtc = command.OccurredAtUtc == default ? _clock.UtcNow : command.OccurredAtUtc;

        var attempt = RefusedScanAttempt.Record(
            tenantId: command.TenantId,
            scanAttemptId: command.ScanAttemptId,
            credentialFingerprint: command.CredentialFingerprint,
            direction: command.Direction,
            failureCode: command.FailureCode,
            performedByProfileId: command.PerformedByProfileId,
            gatehouseId: command.GatehouseId,
            occurredAtUtc: occurredAtUtc,
            correlationId: correlationId,
            relatedCredentialId: command.RelatedCredentialId,
            relatedSubjectId: command.RelatedSubjectId);

        await _refusals.AddAsync(attempt, ct);

        if (_auditWriter is not null)
        {
            await _auditWriter.WriteAsync(
                tenantId: command.TenantId,
                category: AuditCategory.Security,
                action: "ReaderRefusedScan",
                entityType: "RefusedScanAttempt",
                entityId: attempt.Id,
                severity: AuditSeverity.Warning,
                details: $"Reader access refused: {command.FailureCode}.",
                metadata: new
                {
                    origin = "device_event",
                    failureCode = command.FailureCode,
                    direction = command.Direction.HasValue ? CycleDirectionCodes.ToWire(command.Direction.Value) : null
                },
                ct: ct);
        }

        return attempt.Id;
    }
}
