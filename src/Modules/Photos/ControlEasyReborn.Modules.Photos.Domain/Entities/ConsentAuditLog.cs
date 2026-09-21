namespace ControlEasyReborn.Modules.Photos.Domain.Entities;

/// <summary>Entry states as string constants (stored as VARCHAR in ConsentAuditLog).</summary>
public static class EntryStates
{
    public const string EnteredWithConsent = "entered_with_consent";
    public const string EnteredWithoutConsent = "entered_without_consent";
    public const string EnteredOverride = "entered_override";
    public const string Exited = "exited";
}

/// <summary>Hardcoded override reasons (no custom reason codes this phase).</summary>
public static class OverrideReasons
{
    public const string Emergency = "emergency";
    public const string Vouched = "vouched";
}

/// <summary>Subject categories for entry-log and consent policy.</summary>
public static class SubjectCategories
{
    public const string Dweller = "dweller";
    public const string Visitor = "visitor";
    public const string ServiceProvider = "service_provider";
    public const string Vehicle = "vehicle";
}

public static class EntryStatesConstants
{
    public static readonly string[] All =
    [
        EntryStates.EnteredWithConsent,
        EntryStates.EnteredWithoutConsent,
        EntryStates.EnteredOverride,
        EntryStates.Exited
    ];

    public static bool Contains(string value) => All.Contains(value);
}

public static class OverrideReasonsConstants
{
    public static readonly string[] All =
    [
        OverrideReasons.Emergency,
        OverrideReasons.Vouched
    ];

    public static bool Contains(string value) => All.Contains(value);
}

public static class SubjectCategoriesConstants
{
    public static readonly string[] All =
    [
        SubjectCategories.Dweller,
        SubjectCategories.Visitor,
        SubjectCategories.ServiceProvider,
        SubjectCategories.Vehicle
    ];

    public static bool Contains(string value) => All.Contains(value);
}

public sealed class ConsentAuditLogEntry
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string EntryState { get; private set; } = string.Empty;
    public string? OverrideReason { get; private set; }
    public Guid? PhotoId { get; private set; }
    public string SubjectType { get; private set; } = string.Empty;
    public string? SubjectName { get; private set; }
    public string? SubjectDocument { get; private set; }
    public Guid? PerformedByProfileId { get; private set; }
    public DateTime RecordedAt { get; private set; }

    private ConsentAuditLogEntry() { }

    public ConsentAuditLogEntry(Guid id, Guid tenantId, string entryState, string? overrideReason, Guid? photoId, string subjectType, string? subjectName, string? subjectDocument, Guid? performedByProfileId, DateTime recordedAt)
    {
        if (entryState == EntryStates.EnteredWithConsent && photoId is null)
            throw new InvalidOperationException("entered_with_consent entries require a photo.");

        Id = id;
        TenantId = tenantId;
        EntryState = entryState;
        OverrideReason = overrideReason;
        PhotoId = photoId;
        SubjectType = subjectType;
        SubjectName = subjectName;
        SubjectDocument = subjectDocument;
        PerformedByProfileId = performedByProfileId;
        RecordedAt = recordedAt;
    }
}

public sealed class TenantConsentPolicy
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string SubjectCategory { get; private set; } = string.Empty;
    public bool PhotoRequired { get; private set; }
    public int? DwellTimeLimitMinutes { get; private set; }
    public Guid? UpdatedByProfileId { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? UpdatedAtUtc { get; private set; }

    private TenantConsentPolicy() { }

    public TenantConsentPolicy(Guid id, Guid tenantId, string subjectCategory, bool photoRequired, int? dwellTimeLimitMinutes, Guid? updatedByProfileId, DateTime createdAtUtc, DateTime? updatedAtUtc = null)
    {
        Id = id;
        TenantId = tenantId;
        SubjectCategory = subjectCategory;
        PhotoRequired = photoRequired;
        DwellTimeLimitMinutes = dwellTimeLimitMinutes;
        UpdatedByProfileId = updatedByProfileId;
        CreatedAtUtc = createdAtUtc;
        UpdatedAtUtc = updatedAtUtc;
    }

    public void Update(bool photoRequired, int? dwellTimeLimitMinutes, Guid? updatedByProfileId)
    {
        PhotoRequired = photoRequired;
        DwellTimeLimitMinutes = dwellTimeLimitMinutes;
        UpdatedByProfileId = updatedByProfileId;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}
