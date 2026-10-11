using System.Collections.Concurrent;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;

namespace ControlEasyReborn.Modules.Devices.Infrastructure.Services;

// Test-only in-memory device-event queue (DOOR-11). Holds payloads that
// would have been delivered by an offline reader. Integration tests
// pre-load events via EnqueueOffline and then call Drain (via the
// simulator inspector endpoint) when the device is supposed to be
// back online.
//
// In v2.5 with a real vendor driver this abstraction disappears — the
// driver connects via a persistent TCP / MQTT / vendor-cloud channel and
// there is nothing to queue.
public sealed class InMemoryDeviceEventQueue : IDeviceEventQueue
{
    private readonly ConcurrentDictionary<string, ConcurrentQueue<DeviceEventPayload>> _queues = new();

    public void EnqueueOffline(Guid tenantId, Guid deviceId, IReadOnlyList<DeviceEventPayload> payloads)
    {
        var key = BuildKey(tenantId, deviceId);
        var queue = _queues.GetOrAdd(key, _ => new ConcurrentQueue<DeviceEventPayload>());
        foreach (var payload in payloads)
        {
            queue.Enqueue(payload);
        }
    }

    public IReadOnlyList<DeviceEventPayload> Drain(Guid tenantId, Guid deviceId)
    {
        var key = BuildKey(tenantId, deviceId);
        if (!_queues.TryGetValue(key, out var queue)) return Array.Empty<DeviceEventPayload>();

        var drained = new List<DeviceEventPayload>();
        while (queue.TryDequeue(out var item))
        {
            drained.Add(item);
        }
        return drained;
    }

    public void Reset(Guid tenantId, Guid deviceId)
    {
        var key = BuildKey(tenantId, deviceId);
        _queues.TryRemove(key, out _);
    }

    private static string BuildKey(Guid tenantId, Guid deviceId)
        => $"{tenantId:N}:{deviceId:N}";
}
