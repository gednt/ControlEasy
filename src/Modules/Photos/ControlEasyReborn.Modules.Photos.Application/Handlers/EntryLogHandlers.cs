using ControlEasyReborn.Modules.Photos.Application.Abstractions;
using ControlEasyReborn.Modules.Photos.Application.Contracts;
using ControlEasyReborn.Modules.Photos.Domain.Entities;

namespace ControlEasyReborn.Modules.Photos.Application.Handlers;

/// <summary>
/// Maps ConsentAuditLog rows (the append-only privacy-consent audit trail) to
/// EntryLogResponse contracts for the read-only /api/v1/entry-log endpoints.
/// The operational entry record is the Visits module; walk-in registration is
/// POST /api/v1/visits (checkInNow), package drops are
/// POST /api/v1/access-events/manual, and QR/manual entry events are recorded
/// by the AccessControl module. ConsentAuditLog is not a write path anymore.
/// </summary>
internal static class EntryLogMapping
{
    internal static EntryLogResponse ToResponse(ConsentAuditLogEntry e) =>
        new(e.Id, e.TenantId, e.EntryState, e.OverrideReason, e.PhotoId, e.SubjectType, e.SubjectName, e.SubjectDocument, e.PerformedByProfileId, e.RecordedAt);
}

public sealed class ListEntryLogsHandler
{
    private readonly IConsentAuditLogRepository _auditLog;

    public ListEntryLogsHandler(IConsentAuditLogRepository auditLog)
    {
        _auditLog = auditLog;
    }

    public async Task<IReadOnlyList<EntryLogResponse>> HandleAsync(string? entryState, string? subjectType, DateTime? fromUtc, DateTime? toUtc, Guid? porteiro, int skip, int take, CancellationToken ct)
    {
        var entries = await _auditLog.ListAsync(entryState, subjectType, fromUtc, toUtc, porteiro, skip, take, ct);
        return entries.Select(EntryLogMapping.ToResponse).ToList();
    }
}