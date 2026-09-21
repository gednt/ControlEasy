using ControlEasyReborn.Modules.Photos.Application.Abstractions;
using ControlEasyReborn.Modules.Photos.Application.Contracts;
using ControlEasyReborn.Modules.Photos.Application.Errors;
using ControlEasyReborn.Modules.Photos.Domain.Entities;
using ControlEasyReborn.SharedKernel.Auditing;
using FluentValidation;

namespace ControlEasyReborn.Modules.Photos.Application.Handlers;

public sealed class CreateEntryLogHandler
{
    private readonly IConsentAuditLogRepository _auditLog;
    private readonly IPhotoRepository _photos;
    private readonly ITenantConsentPolicyRepository _policies;
    private readonly IValidator<CreateEntryLogRequest> _validator;
    private readonly IAuditLogWriter? _auditWriter;

    public CreateEntryLogHandler(
        IConsentAuditLogRepository auditLog,
        IPhotoRepository photos,
        ITenantConsentPolicyRepository policies,
        IValidator<CreateEntryLogRequest> validator,
        IAuditLogWriter? auditWriter = null)
    {
        _auditLog = auditLog;
        _photos = photos;
        _policies = policies;
        _validator = validator;
        _auditWriter = auditWriter;
    }

    public async Task<EntryLogResponse> HandleAsync(CreateEntryLogRequest request, Guid tenantId, Guid? profileId, CancellationToken ct)
    {
        var result = await _validator.ValidateAsync(request, ct);
        if (!result.IsValid)
        {
            throw new Errors.ValidationException(result.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()));
        }

        ValidateStateTransitions(request);

        var photoRequired = request.EntryState == EntryStates.EnteredWithConsent;
        if (photoRequired && request.PhotoId is null)
        {
            throw new Errors.ValidationException(new Dictionary<string, string[]>
            {
                ["PhotoId"] = new[] { $"A photo is required for this {request.EntryState} entry." }
            });
        }

        if (request.PhotoId.HasValue)
        {
            var photo = await _photos.FindAsync(request.PhotoId.Value, ct);
            if (photo is null || photo.IsDeleted || photo.TenantId != tenantId)
                throw new NotFoundException($"Photo {request.PhotoId} was not found.");
        }

        var entry = new ConsentAuditLogEntry(
            id: Guid.NewGuid(),
            tenantId: tenantId,
            entryState: request.EntryState,
            overrideReason: request.OverrideReason,
            photoId: request.PhotoId,
            subjectType: request.SubjectType,
            subjectName: request.SubjectName,
            subjectDocument: request.SubjectDocument,
            performedByProfileId: profileId,
            recordedAt: DateTime.UtcNow);

        await _auditLog.AddAsync(entry, ct);

        if (_auditWriter is not null)
        {
            var (action, severity) = request.EntryState switch
            {
                EntryStates.EnteredWithoutConsent => ("EntryDeniedConsentRefused", AuditSeverity.Warning),
                EntryStates.EnteredOverride => ("OverrideAuthorized", AuditSeverity.SecurityAlert),
                _ => ("EntryRegistered", AuditSeverity.Info)
            };

            await _auditWriter.WriteAsync(
                tenantId: tenantId,
                category: AuditCategory.Gatehouse,
                action: action,
                entityType: "GatehouseEntry",
                entityId: entry.Id,
                severity: severity,
                details: request.EntryState == EntryStates.EnteredOverride
                    ? $"Gatehouse entry override authorized for {request.SubjectName ?? request.SubjectType}: {request.OverrideReason}"
                    : $"Gatehouse entry recorded ({request.EntryState}) for {request.SubjectName ?? request.SubjectType}.",
                metadata: new
                {
                    request.SubjectType,
                    request.SubjectName,
                    request.EntryState,
                    request.OverrideReason,
                    request.PhotoId
                },
                ct: ct);
        }

        return ToResponse(entry);
    }

    private static void ValidateStateTransitions(CreateEntryLogRequest request)
    {
        if (request.EntryState == EntryStates.EnteredOverride)
        {
            if (request.SubjectType is SubjectCategories.ServiceProvider or SubjectCategories.Vehicle)
                throw new Errors.ValidationException(new Dictionary<string, string[]>
                {
                    ["SubjectType"] = new[] { "entered_override is only allowed for dwellers or visitors." }
                });

            if (string.IsNullOrWhiteSpace(request.OverrideReason))
                throw new Errors.ValidationException(new Dictionary<string, string[]>
                {
                    ["OverrideReason"] = new[] { "entered_override requires a reason (emergency or vouched)." }
                });
        }
        else if (request.OverrideReason is not null && request.EntryState != EntryStates.EnteredOverride)
        {
            throw new Errors.ValidationException(new Dictionary<string, string[]>
            {
                ["OverrideReason"] = new[] { "OverrideReason is only valid for entered_override entries." }
            });
        }

        if (request.EntryState == EntryStates.Exited
            && request.SubjectType is not (SubjectCategories.Dweller or SubjectCategories.Vehicle))
            throw new Errors.ValidationException(new Dictionary<string, string[]>
            {
                ["SubjectType"] = new[] { "exited is only allowed for dwellers or vehicles." }
            });
    }

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

    public async Task<IReadOnlyList<EntryLogResponse>> HandleAsync(string? entryState, string? subjectType, DateTime? fromUtc, DateTime? toUtc, int skip, int take, CancellationToken ct)
    {
        var entries = await _auditLog.ListAsync(entryState, subjectType, fromUtc, toUtc, skip, take, ct);
        return entries.Select(CreateEntryLogHandler.ToResponse).ToList();
    }
}
