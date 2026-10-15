using System.Collections.Concurrent;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;

namespace ControlEasyReborn.Modules.Devices.Infrastructure.Services;

// Thread-safe singleton state for the in-process door simulator. Tracks every
// UnlockAsync call, exposes success-or-failure outcome, and supports
// always-succeed / always-fail / fails-then-recovers test modes via
// SetFailureMode (development only). Offline windows are time-limited so the
// simulator self-heals without an explicit reset.
public sealed class DoorSimulatorState : IDoorSimulatorState
{
    private readonly ConcurrentDictionary<string, List<SimulatedAttempt>> _attempts = new();
    private readonly ConcurrentDictionary<Guid, SimulatorFailureMode> _failureModes = new();
    private readonly ConcurrentDictionary<Guid, DateTime> _offlineUntil = new();
    private readonly ConcurrentDictionary<Guid, int> _failureCounters = new();
    private readonly ConcurrentDictionary<Guid, long> _sequenceCounters = new();

    public void RecordAttempt(
        Guid tenantId,
        Guid deviceId,
        Guid actorProfileId,
        Guid nonce,
        DateTime timestampUtc,
        string outcome,
        Guid correlationId,
        DateTime occurredAtUtc)
    {
        var attempt = new SimulatedAttempt(
            tenantId, deviceId, actorProfileId, nonce,
            timestampUtc, outcome, correlationId, occurredAtUtc);

        var key = BuildAttemptsKey(tenantId, deviceId);
        var list = _attempts.GetOrAdd(key, _ => new List<SimulatedAttempt>());
        lock (list)
        {
            list.Add(attempt);
        }
    }

    public IReadOnlyList<SimulatedAttempt> GetAttempts(Guid tenantId, Guid deviceId)
    {
        var key = BuildAttemptsKey(tenantId, deviceId);
        if (!_attempts.TryGetValue(key, out var list)) return Array.Empty<SimulatedAttempt>();
        lock (list)
        {
            return list.ToArray();
        }
    }

    public void Reset(Guid tenantId, Guid deviceId)
    {
        var key = BuildAttemptsKey(tenantId, deviceId);
        if (_attempts.TryGetValue(key, out var list))
        {
            lock (list) list.Clear();
        }
        _failureModes.TryRemove(deviceId, out _);
        _offlineUntil.TryRemove(deviceId, out _);
        _failureCounters.TryRemove(deviceId, out _);
    }

    public void SetFailureMode(Guid deviceId, SimulatorFailureMode mode)
    {
        if (mode == SimulatorFailureMode.None)
            _failureModes.TryRemove(deviceId, out _);
        else
            _failureModes[deviceId] = mode;

        if (mode != SimulatorFailureMode.FailsThenRecovers)
            _failureCounters.TryRemove(deviceId, out _);
    }

    public void SetOffline(Guid deviceId, DateTime untilUtc)
    {
        _offlineUntil[deviceId] = untilUtc;
    }

    public SimulatorFailureMode GetFailureMode(Guid deviceId)
        => _failureModes.TryGetValue(deviceId, out var mode) ? mode : SimulatorFailureMode.None;

    public DateTime? GetOfflineUntil(Guid deviceId)
        => _offlineUntil.TryGetValue(deviceId, out var until) ? until : null;

    internal bool IsOfflineNow(Guid deviceId, DateTime nowUtc)
        => _offlineUntil.TryGetValue(deviceId, out var until) && until > nowUtc;

    // Resolve the effective outcome for a given device, honouring the
    // configured failure mode and offline window. Returns null when the
    // simulator is in the default "always succeeds" mode (caller emits Success).
    public string? ResolveOutcome(Guid deviceId, DateTime nowUtc)
    {
        if (IsOfflineNow(deviceId, nowUtc)) return nameof(DoorUnlockResultKind.DeviceOffline);

        if (!_failureModes.TryGetValue(deviceId, out var mode)) return null;

        return mode switch
        {
            SimulatorFailureMode.None => null,
            SimulatorFailureMode.AlwaysAuthFailed => nameof(DoorUnlockResultKind.AuthFailed),
            SimulatorFailureMode.AlwaysDeviceOffline => nameof(DoorUnlockResultKind.DeviceOffline),
            SimulatorFailureMode.FailsThenRecovers => ResolveFailsThenRecover(deviceId, nowUtc),
            _ => null
        };
    }

    // Safe per-device SequenceNumber source for simulated reader events:
    //   - process-recycle safe: a fresh counter seeds from the current wall
    //     clock ticks, which is orders of magnitude beyond any previously
    //     persisted manual sequence number;
    //   - concurrency safe: monotonic CAS-style increments within the
    //     process. Distinct rows still pair the sequence with a fresh
    //     ExternalEventId, so even a rare tied seed cannot suppress a row.
    public long NextSequenceNumber(Guid deviceId) =>
        _sequenceCounters.AddOrUpdate(
            deviceId,
            DateTime.UtcNow.Ticks,
            (_, current) => Math.Max(current + 1, DateTime.UtcNow.Ticks));

    private string ResolveFailsThenRecover(Guid deviceId, DateTime nowUtc)
    {
        // 2 AuthFailed attempts then Success on attempt #3.
        var counter = _failureCounters.AddOrUpdate(deviceId, 1, (_, current) => current + 1);
        return counter <= 2
            ? nameof(DoorUnlockResultKind.AuthFailed)
            : nameof(DoorUnlockResultKind.Success);
    }

    private static string BuildAttemptsKey(Guid tenantId, Guid deviceId)
        => $"{tenantId:N}:{deviceId:N}";
}