namespace ControlEasyReborn.Modules.Devices.Application.Abstractions;

public enum SimulatorFailureMode
{
    None = 0,
    AlwaysAuthFailed = 1,
    AlwaysDeviceOffline = 2,
    FailsThenRecovers = 3
}

public sealed record SimulatedAttempt(
    Guid TenantId,
    Guid DeviceId,
    Guid ActorProfileId,
    Guid Nonce,
    DateTime TimestampUtc,
    string Outcome,
    Guid CorrelationId,
    DateTime OccurredAtUtc);

// In-process door simulator harness state. Singleton, thread-safe via
// ConcurrentDictionary. Production never calls Set methods — the dev-only
// inspector endpoint guards them with IWebHostEnvironment.IsDevelopment().
public interface IDoorSimulatorState
{
    void RecordAttempt(Guid tenantId, Guid deviceId, Guid actorProfileId, Guid nonce, DateTime timestampUtc, string outcome, Guid correlationId, DateTime occurredAtUtc);
    IReadOnlyList<SimulatedAttempt> GetAttempts(Guid tenantId, Guid deviceId);
    void Reset(Guid tenantId, Guid deviceId);
    void SetFailureMode(Guid deviceId, SimulatorFailureMode mode);
    void SetOffline(Guid deviceId, DateTime untilUtc);
    SimulatorFailureMode GetFailureMode(Guid deviceId);
    DateTime? GetOfflineUntil(Guid deviceId);

    // Effective configured outcome for the device at nowUtc ("DeviceOffline",
    // "AuthFailed", ...) or null when the simulator is in the default
    // "always succeeds" mode. Development-only consumers (the simulated door
    // controller and the virtual-door presentation endpoints).
    string? ResolveOutcome(Guid deviceId, DateTime nowUtc);

    // Safe monotonic per-device SequenceNumber source for simulated reader
    // events — process-recycle safe (seeded from the wall clock) and
    // concurrency safe (monotonic increments within the process).
    long NextSequenceNumber(Guid deviceId);
}