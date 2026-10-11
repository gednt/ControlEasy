// Per-device derived status, computed by IngestHeartbeatHandler on each
// ingestion event. Phase 26 surfaces this through the GET /api/v1/devices/health
// endpoint and the new /devices dashboard page (DOOR-12 + DOOR-13).
//
// Online = 0: heartbeat is fresh (< OfflineAfterSeconds since last seen) AND
//            error rate <= ErrorRateThresholdPercent.
// Offline = 1: gap since LastHeartbeatAtUtc exceeds OfflineAfterSeconds.
// Degraded = 2: heartbeat is fresh BUT error rate exceeds ErrorRateThresholdPercent.
//
// Default Online because the TINYINT column DEFAULT 0 means a fresh row that
// has not yet seen any heartbeat ingestion reads as "online" — the dashboard
// treats a missing heartbeat row as Offline (see ListDeviceHealthHandler).
namespace ControlEasyReborn.Modules.Devices.Domain.Enums;

public enum DeviceStatus
{
    Online = 0,
    Offline = 1,
    Degraded = 2
}