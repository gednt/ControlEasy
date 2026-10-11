// Codes that explain WHY a scan was refused. Lives in the Devices module so
// the Phase 25 reader-event ingestion surface can share the canonical
// refusal vocabulary with the existing AccessControl gatehouse scan flow.
// Aliases the static RefusalCodes table (which is the authoritative
// validation source for RefusedScanAttempt entity construction).
namespace ControlEasyReborn.Modules.AccessControl.Domain.Enums;

public static class RefusedScanFailureCode
{
    // Existing AccessControl codes (kept as aliases so Devices code can
    // share the string constants without a full migration).
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

    // New codes for Phase 25 reader-event ingestion (DOOR-10).
    public const string UnknownCard = "unknown_card";
    public const string CredentialExpired = "credential_expired";
    public const string TamperDetected = "tamper_detected";
    public const string CredentialMissingDestination = "credential_missing_destination";
}
