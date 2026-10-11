// Discriminator for the outcome of a single device-event ingestion. Phase 25
// returns one of these strings from the Devices module's ingest pipeline;
// downstream API surfaces (admin list endpoint, simulator inspector) read
// the same vocabulary.
namespace ControlEasyReborn.Modules.Devices.Domain.Enums;

public static class DeviceEventResultCode
{
    // Successful card-match outcomes.
    public const string CreatedVisit = "created_visit";       // visitor: new CheckedIn Visit created
    public const string AdvancedVisit = "advanced_visit";     // visitor: existing Pending Visit advanced to CheckedIn
    public const string MatchedDweller = "matched_dweller";   // resident: AccessEvent recorded, no Visit

    // Denied / failed outcomes.
    public const string DeniedAttempt = "denied_attempt";     // refused scan written

    // Idempotency + lifecycle outcomes (no side effect).
    public const string ReplayDuplicate = "replay_duplicate"; // idempotency-key match
    public const string DeviceInactive = "device_inactive";   // device removed or !IsActive
    public const string TenantFlagOff = "tenant_flag_off";    // DoorIntegrationEnabled = 0
    public const string SequenceConflict = "sequence_conflict"; // same sequence, different external event id
    public const string ReaderReconnected = "reader_reconnected"; // device came back online; ledger marker only

    // Phase 26 - heartbeat ingestion outcome. The device_heartbeats row IS
    // the durability marker; no device_events row is written for heartbeats.
    public const string HeartbeatReceived = "heartbeat_received";

    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        CreatedVisit, AdvancedVisit, MatchedDweller,
        DeniedAttempt, ReplayDuplicate, DeviceInactive, TenantFlagOff,
        SequenceConflict, ReaderReconnected, HeartbeatReceived
    };
}
