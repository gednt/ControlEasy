namespace ControlEasyReborn.Modules.Devices.Application.Abstractions;

// Replay protection cache. Backing: ConcurrentDictionary<string, DateTimeOffset>
// keyed by tenantId + deviceId + nonce. Singleton. FIFO eviction when count
// exceeds 100k. TTL = REPLAY_WINDOW_SECONDS (default 300s).
public interface IDeviceNonceCache
{
    Task<bool> TryConsumeAsync(Guid tenantId, Guid deviceId, string nonceBase64Url, TimeSpan ttl, CancellationToken ct);
}