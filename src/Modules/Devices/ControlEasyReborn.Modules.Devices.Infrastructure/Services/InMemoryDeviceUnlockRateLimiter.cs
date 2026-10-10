using System.Collections.Concurrent;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;

namespace ControlEasyReborn.Modules.Devices.Infrastructure.Services;

// Last-timestamp-stamp per (tenantId, deviceId). A subsequent attempt within
// `window` returns false.
public sealed class InMemoryDeviceUnlockRateLimiter : IDeviceUnlockRateLimiter
{
    private readonly ConcurrentDictionary<string, DateTimeOffset> _lastAllowed = new();

    public Task<bool> TryAcquireAsync(Guid tenantId, Guid deviceId, TimeSpan window, CancellationToken ct)
    {
        var key = BuildKey(tenantId, deviceId);
        var now = DateTimeOffset.UtcNow;
        var cutoff = now - window;

        while (true)
        {
            if (_lastAllowed.TryGetValue(key, out var last))
            {
                if (last > cutoff)
                    return Task.FromResult(false);

                // Try to advance the timestamp atomically.
                if (_lastAllowed.TryUpdate(key, now, last))
                    return Task.FromResult(true);
                // Lost the race; loop and re-evaluate.
            }
            else
            {
                if (_lastAllowed.TryAdd(key, now))
                    return Task.FromResult(true);
                // Lost the race; loop and re-evaluate.
            }
        }
    }

    private static string BuildKey(Guid tenantId, Guid deviceId)
        => $"{tenantId:N}:{deviceId:N}";
}