using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Domain.Entities;
using ControlEasyReborn.Modules.Devices.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace ControlEasyReborn.Modules.Devices.Application.Handlers;

// Heart of DOOR-12 + DOOR-13 — the heartbeat ingestion pipeline.
//
// Pseudocode (from CONTEXT.md "Heartbeat ingestion pipeline"):
//   1. if (tenant.DoorIntegrationEnabled == false) return TenantFlagOff
//   2. device = deviceRepo.GetByIdAsync(tenantId, deviceId)
//      if (device == null || device.RemovedAtUtc != null || !device.IsActive)
//          return DeviceInactive
//   3. existing = heartbeatRepo.GetAsync(tenantId, deviceId)
//   4. thresholds = existing?.OfflineAfterSeconds ?? 60
//      errorThresholdPct = existing?.ErrorRateThresholdPercent ?? 10.00m
//   5. gap = now - (existing?.LastHeartbeatAtUtc ?? now)
//   6. errorRate = (decimal)payload.ErrorCount / Math.Max(payload.EventsSinceLastSuccess, 1) * 100m
//   7. newStatus =
//          gap > TimeSpan.FromSeconds(thresholds) ? DeviceStatus.Offline
//        : errorRate > errorThresholdPct         ? DeviceStatus.Degraded
//                                               : DeviceStatus.Online
//   8. heartbeat = existing is null
//      ? new DeviceHeartbeat(DeviceId, TenantId, now, newStatus, ...)
//      : existing.Update(now, newStatus, ...)
//   9. heartbeatRepo.UpsertAsync(heartbeat)
//   10. logger.LogInformation("device.heartbeat.{Status} {TenantId} {DeviceId} {ErrorCount}/{Events} = {ErrorRate}%", ...)
//   11. return IngestHeartbeatResult.Ok(newStatus)
public sealed class IngestHeartbeatHandler
{
    // Default thresholds (per CONTEXT.md "device_heartbeats table"):
    //   offline_after_seconds = 60
    //   error_rate_threshold_percent = 10.00
    public const int DefaultOfflineAfterSeconds = 60;
    public const decimal DefaultErrorRateThresholdPercent = 10.00m;

    private readonly IDeviceRepository _devices;
    private readonly IDeviceHeartbeatRepository _heartbeats;
    private readonly ITenantDoorIntegrationFlagLookup _tenantFlagLookup;
    private readonly ILogger<IngestHeartbeatHandler> _logger;

    public IngestHeartbeatHandler(
        IDeviceRepository devices,
        IDeviceHeartbeatRepository heartbeats,
        ITenantDoorIntegrationFlagLookup tenantFlagLookup,
        ILogger<IngestHeartbeatHandler>? logger = null)
    {
        _devices = devices;
        _heartbeats = heartbeats;
        _tenantFlagLookup = tenantFlagLookup;
        _logger = logger ?? Microsoft.Extensions.Logging.Abstractions.NullLogger<IngestHeartbeatHandler>.Instance;
    }

    public async Task<IngestHeartbeatResult> HandleAsync(
        Guid tenantId,
        Guid deviceId,
        int errorCount,
        int eventsSinceLastSuccess,
        DateTime nowUtc,
        CancellationToken ct)
    {
        // 1. Tenant opt-in flag.
        var flagEnabled = await _tenantFlagLookup.IsEnabledAsync(tenantId, ct);
        if (!flagEnabled)
        {
            return IngestHeartbeatResult.TenantFlagOff();
        }

        // 2. Device lifecycle.
        var device = await _devices.GetByIdAsync(tenantId, deviceId, ct);
        if (device is null || device.IsRemoved || !device.IsActive)
        {
            return IngestHeartbeatResult.DeviceInactive();
        }

        // 3. Existing heartbeat row (one per device — DeviceId UNIQUE).
        var existing = await _heartbeats.GetAsync(tenantId, deviceId, ct);

        // 4. Per-device thresholds (carry-forward + default fallback).
        var offlineAfterSeconds = existing?.OfflineAfterSeconds ?? DefaultOfflineAfterSeconds;
        var errorThresholdPct = existing?.ErrorRateThresholdPercent ?? DefaultErrorRateThresholdPercent;

        // 5. Gap since last heartbeat.
        var gap = nowUtc - (existing?.LastHeartbeatAtUtc ?? nowUtc);

        // 6. Error rate (counts per minute, but the spec measures it as a
        //    percent over EventsSinceLastSuccess — capped denominator at 1
        //    to avoid div-by-zero).
        var errorRate = (decimal)errorCount / Math.Max(eventsSinceLastSuccess, 1) * 100m;

        // 7. Derived status.
        DeviceStatus newStatus;
        if (gap > TimeSpan.FromSeconds(offlineAfterSeconds))
        {
            newStatus = DeviceStatus.Offline;
        }
        else if (errorRate > errorThresholdPct)
        {
            newStatus = DeviceStatus.Degraded;
        }
        else
        {
            newStatus = DeviceStatus.Online;
        }

        // 8. Build or update the heartbeat entity.
        DeviceHeartbeat heartbeat;
        if (existing is null)
        {
            heartbeat = new DeviceHeartbeat(
                id: Guid.NewGuid(),
                deviceId: deviceId,
                tenantId: tenantId,
                lastHeartbeatAtUtc: nowUtc,
                status: newStatus,
                errorCount: errorCount,
                eventsSinceLastSuccess: eventsSinceLastSuccess,
                offlineAfterSeconds: offlineAfterSeconds,
                errorRateThresholdPercent: errorThresholdPct,
                updatedAtUtc: nowUtc);
        }
        else
        {
            heartbeat = existing;
            heartbeat.Update(
                newLastHeartbeatAtUtc: nowUtc,
                newStatus: newStatus,
                newErrorCount: errorCount,
                newEventsSinceLastSuccess: eventsSinceLastSuccess,
                updatedAtUtc: nowUtc);
        }

        // 9. Persist (idempotent ON DUPLICATE KEY UPDATE by DeviceId).
        await _heartbeats.UpsertAsync(heartbeat, ct);

        // 10. Structured Serilog line — supports operational dashboards.
        _logger.LogInformation(
            "device.heartbeat.{Status} {TenantId} {DeviceId} {ErrorCount}/{Events} = {ErrorRate:F2}% gap={GapSeconds}s",
            newStatus,
            tenantId,
            deviceId,
            errorCount,
            eventsSinceLastSuccess,
            errorRate,
            (long)gap.TotalSeconds);

        return IngestHeartbeatResult.Ok(newStatus);
    }
}

// Discriminated outcome of IngestHeartbeatHandler. Mirrors the Phase 25
// DeviceEventResultCode vocabulary where it overlaps; adds the heartbeat-
// specific statuses that don't reach the device_events ledger.
public sealed record IngestHeartbeatResult(
    IngestHeartbeatOutcome Outcome,
    DeviceStatus? Status)
{
    public static IngestHeartbeatResult Ok(DeviceStatus status) =>
        new(IngestHeartbeatOutcome.HeartbeatReceived, status);

    public static IngestHeartbeatResult TenantFlagOff() =>
        new(IngestHeartbeatOutcome.TenantFlagOff, null);

    public static IngestHeartbeatResult DeviceInactive() =>
        new(IngestHeartbeatOutcome.DeviceInactive, null);
}

public enum IngestHeartbeatOutcome
{
    HeartbeatReceived = 0,
    TenantFlagOff = 1,
    DeviceInactive = 2
}