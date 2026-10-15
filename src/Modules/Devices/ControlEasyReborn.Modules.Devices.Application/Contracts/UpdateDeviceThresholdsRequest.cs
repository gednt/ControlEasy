namespace ControlEasyReborn.Modules.Devices.Application.Contracts;

// Per-device Configure dialog on /devices — persisted heartbeat thresholds
// (PUT /api/v1/devices/{deviceId}/thresholds). Invariants (offlineAfterSeconds
// >= 1, 0 <= errorRateThresholdPercent <= 100) are enforced by
// UpdateDeviceThresholdsValidator BEFORE the entity is constructed —
// DeviceHeartbeat's InvalidOperationException guards must stay unreachable
// (they would surface as a 500).
public sealed record UpdateDeviceThresholdsRequest(
    int OfflineAfterSeconds,
    decimal ErrorRateThresholdPercent);

// Wire-shape response of the thresholds PUT; mirrored in
// src/Web/ControlEasyReborn.Web/src/app/features/devices/door-unlock.types.ts
// (DeviceThresholdsDto).
public sealed record DeviceThresholdsDto(
    Guid DeviceId,
    int OfflineAfterSeconds,
    decimal ErrorRateThresholdPercent);