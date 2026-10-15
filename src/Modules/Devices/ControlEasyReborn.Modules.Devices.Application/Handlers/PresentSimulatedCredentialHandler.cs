using ControlEasyReborn.Modules.AccessControl.Application.Commands;
using ControlEasyReborn.Modules.AccessControl.Application.Handlers;
using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Application.Errors;
using ControlEasyReborn.Modules.Devices.Domain.Enums;

namespace ControlEasyReborn.Modules.Devices.Application.Handlers;

// Development-only "virtual physical reader" presentation. An authorized
// operator (Bearer + Permission_devices.read, dev inspector flag on)
// presents an issued credential token at a configured simulator reader.
//
// The physical-reader model is preserved: the simulator emits one reader
// event and ControlEasy records the result.
//   1. The device must pass SimulatorDeviceGuard (reader / active / bound
//      to an active gatehouse of the current tenant).
//   2. The configured failure short-circuit: only when the door-simulator
//      state resolves DeviceOffline or AuthFailed for the device does the
//      presentation return that configured failure WITHOUT touching the
//      ingestion pipeline — no accepted access, no refusal, no
//      device_events row. Success (and the FailsThenRecovers recovery
//      attempt) passes through to ingestion.
//   3. A successful read builds one CardRead payload with a strict
//      direction inside payload_json, a safe monotonic SequenceNumber and a
//      fresh ExternalEventId, then delegates EXACTLY ONCE to
//      IngestDeviceEventHandler — whose only credential decision lives in
//      RecordAccessScanHandler.
public sealed record SimulatedPresentationResult(
    // Either DeviceEventResultCode.* (ingestion recorded) or
    // "device_offline" / "auth_failed" (configured simulator failure, no
    // ledger write at all).
    string Outcome,
    string? FailureCode,
    string Direction,
    Guid? ExistingEventId,
    Guid? VisitId,
    Guid? AccessEventId,
    Guid? RefusalId,
    DateTime OccurredAtUtc,
    DateTime ProcessedAtUtc);

public sealed class PresentSimulatedCredentialHandler
{
    private readonly IDeviceRepository _devices;
    private readonly IGatehouseLookup _gatehouses;
    private readonly IDoorSimulatorState _simulatorState;
    private readonly IngestDeviceEventHandler _ingest;

    public PresentSimulatedCredentialHandler(
        IDeviceRepository devices,
        IGatehouseLookup gatehouses,
        IDoorSimulatorState simulatorState,
        IngestDeviceEventHandler ingest)
    {
        _devices = devices;
        _gatehouses = gatehouses;
        _simulatorState = simulatorState;
        _ingest = ingest;
    }

    public async Task<SimulatedPresentationResult> HandleAsync(
        Guid tenantId,
        Guid deviceId,
        string token,
        string directionWire,
        Guid? actorProfileId,
        CancellationToken ct)
    {
        if (!CycleDirectionCodes.TryParse(directionWire, out var direction))
        {
            throw new Errors.ValidationException(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                ["direction"] = new[] { "direction must be \"entrance\" or \"exit\"." }
            });
        }

        if (string.IsNullOrWhiteSpace(token))
        {
            throw new Errors.ValidationException(new Dictionary<string, string[]>(StringComparer.Ordinal)
            {
                ["token"] = new[] { "A credential token is required." }
            });
        }

        var (device, reason) = await SimulatorDeviceGuard.ValidateAsync(_devices, _gatehouses, tenantId, deviceId, ct);
        if (device is null || reason is not null)
        {
            throw new NotFoundException($"Simulator device {deviceId} is not presentable for this tenant ({reason}).");
        }

        var nowUtc = DateTime.UtcNow;

        // Configured failure short-circuit. Only the two failure kinds block
        // the read: a DeviceOffline / AuthFailed presentation returns its
        // configured failure WITHOUT touching the ingestion pipeline — no
        // accepted access, no refusal, no device_events row. In the
        // FailsThenRecovers mode the third attempt resolves "Success": that
        // must pass through to ingestion, or the reader would never
        // self-recover. Success (null) and Success are both "go" signals;
        // FailsThenRecovers mutates its counter here, which is the configured
        // contract: the first two reads fail auth, the third succeeds and
        // reaches ingestion.
        var configuredOutcome = _simulatorState.ResolveOutcome(deviceId, nowUtc);
        if (configuredOutcome == nameof(DoorUnlockResultKind.DeviceOffline) ||
            configuredOutcome == nameof(DoorUnlockResultKind.AuthFailed))
        {
            return new SimulatedPresentationResult(
                Outcome: configuredOutcome == nameof(DoorUnlockResultKind.DeviceOffline)
                    ? "device_offline"
                    : "auth_failed",
                FailureCode: null,
                Direction: CycleDirectionCodes.ToWire(direction),
                ExistingEventId: null,
                VisitId: null,
                AccessEventId: null,
                RefusalId: null,
                OccurredAtUtc: nowUtc,
                ProcessedAtUtc: nowUtc);
        }

        var payload = new DeviceEventPayload(
            EventType: DeviceEventType.CardRead,
            OccurredAtUtc: nowUtc,
            SequenceNumber: _simulatorState.NextSequenceNumber(deviceId),
            ExternalEventId: Guid.NewGuid(),
            OpaqueToken: token.Trim(),
            PayloadJson: DeviceEventPayloadDirection.BuildPayloadJson(direction));

        var ingestion = await _ingest.HandleAsync(tenantId, deviceId, payload, actorProfileId, ct);

        return new SimulatedPresentationResult(
            Outcome: ingestion.Outcome,
            FailureCode: ingestion.FailureCode,
            Direction: CycleDirectionCodes.ToWire(direction),
            ExistingEventId: ingestion.ExistingEventId,
            VisitId: ingestion.VisitId,
            AccessEventId: ingestion.AccessEventId,
            RefusalId: ingestion.RefusedScanAttemptId,
            OccurredAtUtc: ingestion.OccurredAtUtc,
            ProcessedAtUtc: ingestion.ProcessedAtUtc);
    }
}