using ControlEasyReborn.Modules.Devices.Application.Contracts;

namespace ControlEasyReborn.Modules.Devices.Application.Abstractions;

// Test-only event queue used by the integration tests to simulate
// "events queued during a disconnection" (DOOR-11). EnqueueOffline
// pre-loads a per-device queue of events with monotonically increasing
// sequenceNumber; Drain is called by the integration test (via the
// simulator inspector endpoint) to feed those payloads back into the
// ingest pipeline for the reconnection test.
//
// In v2.5 with a real vendor driver this abstraction dies — events
// arrive over a persistent connection and there is nothing to queue.
public interface IDeviceEventQueue
{
    void EnqueueOffline(Guid tenantId, Guid deviceId, IReadOnlyList<DeviceEventPayload> payloads);
    IReadOnlyList<DeviceEventPayload> Drain(Guid tenantId, Guid deviceId);
    void Reset(Guid tenantId, Guid deviceId);
}
