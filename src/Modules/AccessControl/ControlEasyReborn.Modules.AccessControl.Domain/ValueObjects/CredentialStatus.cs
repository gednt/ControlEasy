namespace ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;

public enum CredentialStatus
{
    Active = 0,
    Replaced = 1,
    Revoked = 2,
    Expired = 3,
    Inactive = 4
}

public static class CredentialStatusCodes
{
    public static readonly IReadOnlyDictionary<string, CredentialStatus> ParseTable = new Dictionary<string, CredentialStatus>(StringComparer.OrdinalIgnoreCase)
    {
        ["active"] = CredentialStatus.Active,
        ["replaced"] = CredentialStatus.Replaced,
        ["revoked"] = CredentialStatus.Revoked,
        ["expired"] = CredentialStatus.Expired,
        ["inactive"] = CredentialStatus.Inactive
    };

    public static bool TryParse(string? value, out CredentialStatus status)
    {
        if (!string.IsNullOrWhiteSpace(value) && ParseTable.TryGetValue(value, out status))
        {
            return true;
        }
        status = CredentialStatus.Inactive;
        return false;
    }

    public static string ToWire(CredentialStatus status) => status switch
    {
        CredentialStatus.Active => "active",
        CredentialStatus.Replaced => "replaced",
        CredentialStatus.Revoked => "revoked",
        CredentialStatus.Expired => "expired",
        CredentialStatus.Inactive => "inactive",
        _ => "unknown"
    };
}

public enum LifecycleAction
{
    Issued = 0,
    Replaced = 1,
    Revoked = 2,
    Expired = 3,
    Deactivated = 4
}

public static class LifecycleActionCodes
{
    public static readonly IReadOnlyDictionary<string, LifecycleAction> ParseTable = new Dictionary<string, LifecycleAction>(StringComparer.OrdinalIgnoreCase)
    {
        ["issued"] = LifecycleAction.Issued,
        ["replaced"] = LifecycleAction.Replaced,
        ["revoked"] = LifecycleAction.Revoked,
        ["expired"] = LifecycleAction.Expired,
        ["deactivated"] = LifecycleAction.Deactivated
    };

    public static bool TryParse(string? value, out LifecycleAction action)
    {
        if (!string.IsNullOrWhiteSpace(value) && ParseTable.TryGetValue(value, out action))
        {
            return true;
        }
        action = LifecycleAction.Issued;
        return false;
    }

    public static string ToWire(LifecycleAction action) => action switch
    {
        LifecycleAction.Issued => "issued",
        LifecycleAction.Replaced => "replaced",
        LifecycleAction.Revoked => "revoked",
        LifecycleAction.Expired => "expired",
        LifecycleAction.Deactivated => "deactivated",
        _ => "unknown"
    };
}

public enum PolicyOutcome
{
    Permit = 0,
    RequiresAction = 1,
    Refused = 2
}

public static class PolicyOutcomeCodes
{
    public static string ToWire(PolicyOutcome outcome) => outcome switch
    {
        PolicyOutcome.Permit => "permit",
        PolicyOutcome.RequiresAction => "requires_action",
        PolicyOutcome.Refused => "refused",
        _ => "unknown"
    };
}

public enum ScanDecisionKind
{
    Recorded = 0,
    DuplicateConfirmationRequired = 1,
    PolicyActionRequired = 2,
    Refused = 3,
    Unavailable = 4
}

public static class ScanDecisionKindCodes
{
    public static string ToWire(ScanDecisionKind kind) => kind switch
    {
        ScanDecisionKind.Recorded => "recorded",
        ScanDecisionKind.DuplicateConfirmationRequired => "duplicate_confirmation_required",
        ScanDecisionKind.PolicyActionRequired => "policy_action_required",
        ScanDecisionKind.Refused => "refused",
        ScanDecisionKind.Unavailable => "unavailable",
        _ => "unknown"
    };
}

public static class RefusalCodes
{
    public const string InvalidCredential = "invalid_credential";
    public const string CredentialInactive = "credential_inactive";
    public const string SubjectInactive = "subject_inactive";
    public const string DestinationRequired = "destination_required";
    public const string DestinationInactive = "destination_inactive";
    public const string NotAuthorized = "not_authorized";
    public const string PolicyActionRequired = "policy_action_required";
    public const string DuplicateConfirmationRequired = "duplicate_confirmation_required";
    public const string VehicleInactive = "vehicle_inactive";
    public const string SearchTooBroad = "search_too_broad";
    public const string ManualEventOrphanLookupId = "manual_event_orphan_lookup_id";

    // Phase 25 — Devices module reader-event ingestion (DOOR-10).
    public const string UnknownCard = "unknown_card";
    public const string CredentialExpired = "credential_expired";
    public const string TamperDetected = "tamper_detected";
    public const string CredentialMissingDestination = "credential_missing_destination";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        InvalidCredential,
        CredentialInactive,
        SubjectInactive,
        DestinationRequired,
        DestinationInactive,
        NotAuthorized,
        PolicyActionRequired,
        DuplicateConfirmationRequired,
        VehicleInactive,
        SearchTooBroad,
        ManualEventOrphanLookupId,
        UnknownCard,
        CredentialExpired,
        TamperDetected,
        CredentialMissingDestination
    };
}
