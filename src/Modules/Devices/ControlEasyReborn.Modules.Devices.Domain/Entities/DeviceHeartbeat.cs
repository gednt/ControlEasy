using ControlEasyReborn.Modules.Devices.Domain.Enums;

namespace ControlEasyReborn.Modules.Devices.Domain.Entities;

// One row per device in device_heartbeats. The row carries:
//   - The rolling "last heartbeat at" timestamp (LastHeartbeatAtUtc).
//   - The derived status (Online / Offline / Degraded) computed at ingestion time.
//   - The per-device threshold values (OfflineAfterSeconds + ErrorRateThresholdPercent).
//
// NOT append-only: the row is upserted by IDeviceHeartbeatRepository.UpsertAsync
// (INSERT ... ON DUPLICATE KEY UPDATE). The repository surface deliberately
// does NOT expose Update or Delete methods (DOOR-12 design rule).
public sealed class DeviceHeartbeat
{
    // Sentinel convention (per-device Configure flow): a device_heartbeats
    // row stamped 2000-01-01 UTC means "thresholds were configured but no
    // real heartbeat has ever been seen". The repository writes it on the
    // absent-row branch (SetThresholdsAsync) so the health dashboard can
    // surface the configured thresholds truthfully with a "never" heartbeat
    // display instead of a 25-year-old timestamp; ListDeviceHealthHandler
    // maps it to LastHeartbeatAtUtc=null on the DTO.
    public static readonly DateTime SentinelLastHeartbeatAtUtc = new(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    // Anything stamped before this boundary reads as the sentinel ("never").
    // The comparison is deliberately loose so sub-second / timezone drift in
    // MySQL DATETIME(6) round-trips cannot flip a sentinel row into a real
    // timestamp.
    public static readonly DateTime SentinelBoundaryUtc = new(2001, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    public Guid Id { get; private set; }
    public Guid DeviceId { get; private set; }
    public Guid TenantId { get; private set; }
    public DateTime LastHeartbeatAtUtc { get; private set; }
    public DeviceStatus Status { get; private set; }
    public int ErrorCount { get; private set; }
    public int EventsSinceLastSuccess { get; private set; }
    public int OfflineAfterSeconds { get; private set; }
    public decimal ErrorRateThresholdPercent { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    private DeviceHeartbeat() { }

    public DeviceHeartbeat(
        Guid id,
        Guid deviceId,
        Guid tenantId,
        DateTime lastHeartbeatAtUtc,
        DeviceStatus status,
        int errorCount,
        int eventsSinceLastSuccess,
        int offlineAfterSeconds,
        decimal errorRateThresholdPercent,
        DateTime updatedAtUtc)
    {
        if (id == Guid.Empty) throw new InvalidOperationException("DeviceHeartbeat id is required.");
        if (deviceId == Guid.Empty) throw new InvalidOperationException("DeviceId is required.");
        if (tenantId == Guid.Empty) throw new InvalidOperationException("TenantId is required.");
        if (offlineAfterSeconds <= 0) throw new InvalidOperationException("OfflineAfterSeconds must be > 0.");
        if (errorRateThresholdPercent < 0m || errorRateThresholdPercent > 100m)
            throw new InvalidOperationException("ErrorRateThresholdPercent must be between 0 and 100.");
        if (errorCount < 0) throw new InvalidOperationException("ErrorCount must be >= 0.");
        if (eventsSinceLastSuccess < 0) throw new InvalidOperationException("EventsSinceLastSuccess must be >= 0.");

        Id = id;
        DeviceId = deviceId;
        TenantId = tenantId;
        LastHeartbeatAtUtc = lastHeartbeatAtUtc;
        Status = status;
        ErrorCount = errorCount;
        EventsSinceLastSuccess = eventsSinceLastSuccess;
        OfflineAfterSeconds = offlineAfterSeconds;
        ErrorRateThresholdPercent = errorRateThresholdPercent;
        UpdatedAtUtc = updatedAtUtc;
    }

    // Update(...) applies a fresh ingestion: the row keeps its id (one row per device,
    // idempotent upsert) and reflects the new payload-derived status + counters.
    public void Update(
        DateTime newLastHeartbeatAtUtc,
        DeviceStatus newStatus,
        int newErrorCount,
        int newEventsSinceLastSuccess,
        DateTime updatedAtUtc)
    {
        if (newErrorCount < 0) throw new InvalidOperationException("ErrorCount must be >= 0.");
        if (newEventsSinceLastSuccess < 0) throw new InvalidOperationException("EventsSinceLastSuccess must be >= 0.");

        LastHeartbeatAtUtc = newLastHeartbeatAtUtc;
        Status = newStatus;
        ErrorCount = newErrorCount;
        EventsSinceLastSuccess = newEventsSinceLastSuccess;
        UpdatedAtUtc = updatedAtUtc;
    }

    // IsOfflineExceeded returns true when the gap since LastHeartbeatAtUtc exceeds
    // the per-device OfflineAfterSeconds threshold at the supplied reference time.
    public bool IsOfflineExceeded(DateTime nowUtc)
    {
        return nowUtc - LastHeartbeatAtUtc > TimeSpan.FromSeconds(OfflineAfterSeconds);
    }

    // True when the row is the "configured but never heartbeaten" sentinel
    // (thresholds set via the Configure flow, no real ingest yet). The ingest
    // pipeline's ON DUPLICATE branch overwrites the sentinel timestamp on the
    // first real heartbeat, so this flag can never stick to a live device.
    public bool IsSentinelNeverHeartbeaten => LastHeartbeatAtUtc < SentinelBoundaryUtc;

    public static DeviceHeartbeat Hydrate(
        Guid id,
        Guid deviceId,
        Guid tenantId,
        DateTime lastHeartbeatAtUtc,
        DeviceStatus status,
        int errorCount,
        int eventsSinceLastSuccess,
        int offlineAfterSeconds,
        decimal errorRateThresholdPercent,
        DateTime updatedAtUtc)
    {
        return new DeviceHeartbeat(
            id, deviceId, tenantId, lastHeartbeatAtUtc, status, errorCount,
            eventsSinceLastSuccess, offlineAfterSeconds, errorRateThresholdPercent,
            updatedAtUtc);
    }
}