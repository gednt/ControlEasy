namespace ControlEasyReborn.Modules.Devices.Application.Abstractions;

// Per-device rate limiter. Backing: ConcurrentDictionary<(tenantId, deviceId),
// DateTimeOffset> storing the last allowed unlock timestamp. A subsequent
// attempt within RATE_LIMIT_WINDOW_SECONDS (default 3s) returns false.
// Singleton. Multi-instance deployment is Phase 31's problem (Redis-backed).
public interface IDeviceUnlockRateLimiter
{
    Task<bool> TryAcquireAsync(Guid tenantId, Guid deviceId, TimeSpan window, CancellationToken ct);
}