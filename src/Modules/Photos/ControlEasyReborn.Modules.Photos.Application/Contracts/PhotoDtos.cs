namespace ControlEasyReborn.Modules.Photos.Application.Contracts;

public sealed record UploadPhotoMetadata(
    string MimeType,
    DateTime? CapturedAtUtc,
    string? FileName,
    string? EntityType = null,
    string? EntityId = null);

public sealed record PhotoResponse(
    Guid Id,
    Guid TenantId,
    string FilePath,
    string? ThumbnailPath,
    string MimeType,
    long SizeBytes,
    DateTime? CapturedAtUtc,
    DateTime CreatedAtUtc,
    DateTime? DeletedAtUtc,
    string? EntityType = null,
    string? EntityId = null);

public sealed record EntryLogResponse(
    Guid Id,
    Guid TenantId,
    string EntryState,
    string? OverrideReason,
    Guid? PhotoId,
    string SubjectType,
    string? SubjectName,
    string? SubjectDocument,
    Guid? PerformedByProfileId,
    DateTime RecordedAt);

public sealed record UpdateConsentPolicyRequest(
    string SubjectCategory,
    bool PhotoRequired,
    int? DwellTimeLimitMinutes);

public sealed record ConsentPolicyResponse(
    Guid Id,
    Guid TenantId,
    string SubjectCategory,
    bool PhotoRequired,
    int? DwellTimeLimitMinutes,
    Guid? UpdatedByProfileId,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc);
