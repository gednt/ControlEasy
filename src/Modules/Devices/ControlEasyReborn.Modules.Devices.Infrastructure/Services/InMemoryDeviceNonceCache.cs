using System.Collections.Concurrent;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;

namespace ControlEasyReborn.Modules.Devices.Infrastructure.Services;

// Bounded LRU. Backing ConcurrentDictionary<string, DateTimeOffset> keyed by
// "{tenantId}:{deviceId}:{nonce}". When count exceeds 100k, evict the oldest
// 10% of entries (FIFO order via insertion snapshot).
public sealed class InMemoryDeviceNonceCache : IDeviceNonceCache
{
    private const int MaxEntries = 100_000;
    private const int EvictionBatch = 10_000;

    private readonly ConcurrentDictionary<string, DateTimeOffset> _entries = new();
    private readonly object _evictLock = new();

    public Task<bool> TryConsumeAsync(Guid tenantId, Guid deviceId, string nonceBase64Url, TimeSpan ttl, CancellationToken ct)
    {
        EvictIfNeeded();

        var key = BuildKey(tenantId, deviceId, nonceBase64Url);
        var now = DateTimeOffset.UtcNow;
        var expiry = now.Add(ttl);

        // Atomic insert-if-absent. If a different nonce already occupies the
        // slot (or this exact nonce has been seen), we reject.
        var added = _entries.TryAdd(key, expiry);
        if (!added)
            return Task.FromResult(false);

        // Reject if a key was just added but its expiry is in the past — entry
        // has been registered for a stale window. This should never happen
        // because eviction runs before TryAdd, but guard anyway.
        if (_entries.TryGetValue(key, out var existing) && existing < now)
        {
            _entries.TryRemove(key, out _);
            return Task.FromResult(false);
        }

        return Task.FromResult(true);
    }

    private static string BuildKey(Guid tenantId, Guid deviceId, string nonce)
        => $"{tenantId:N}:{deviceId:N}:{nonce}";

    private void EvictIfNeeded()
    {
        if (_entries.Count < MaxEntries) return;
        lock (_evictLock)
        {
            if (_entries.Count < MaxEntries) return;

            // Evict entries whose expiry is in the past first.
            var now = DateTimeOffset.UtcNow;
            var staleCount = 0;
            foreach (var kv in _entries)
            {
                if (kv.Value < now)
                {
                    if (_entries.TryRemove(kv.Key, out _)) staleCount++;
                }
            }
            if (staleCount >= EvictionBatch) return;

            // Otherwise evict the oldest inserted entries.
            var snapshot = _entries.ToArray();
            Array.Sort(snapshot, (a, b) => a.Value.CompareTo(b.Value));
            for (var i = 0; i < EvictionBatch && i < snapshot.Length; i++)
                _entries.TryRemove(snapshot[i].Key, out _);
        }
    }
}