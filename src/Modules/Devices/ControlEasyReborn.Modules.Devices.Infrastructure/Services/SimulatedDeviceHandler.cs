using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Domain.Enums;

namespace ControlEasyReborn.Modules.Devices.Infrastructure.Services;

// In-process IDeviceHandler implementation for the Phase 25 test
// harness. Real vendor drivers live in v2.5 Phases 32–34.
//
// The simulator bypasses real credential resolution for opaque tokens
// with the "sim-test-" prefix:
//   "sim-test-resident-<guid>"  -> pretend SubjectType=Resident
//   "sim-test-visitor-<guid>"   -> pretend SubjectType=Visitor
//   "sim-test-unknown-<anything>" -> pretend unknown card (resolver returns null)
//
// Production traffic (non-prefixed tokens) flows through the real
// DeviceCredentialResolver + IAccessCredentialRepository.FindByHashAsync
// lookup; in the simulator that's the same code path.
public sealed class SimulatedDeviceHandler : IDeviceHandler
{
    private const string SimulatorPrefix = "sim-test-";

    public DeviceEventPayload Normalize(
        Guid tenantId,
        Guid deviceId,
        string opaqueToken,
        DeviceEventType eventType,
        DateTime occurredAtUtc,
        long sequenceNumber,
        Guid? externalEventId,
        string? payloadJson)
    {
        // Validation is the validator's job, but be defensive: normalize
        // the wire shape to what the rest of the pipeline expects. The
        // opaqueToken is passed through unchanged.
        return new DeviceEventPayload(
            EventType: eventType,
            OccurredAtUtc: DateTime.SpecifyKind(occurredAtUtc, DateTimeKind.Utc),
            SequenceNumber: sequenceNumber,
            ExternalEventId: externalEventId,
            OpaqueToken: opaqueToken,
            PayloadJson: payloadJson ?? "{}");
    }

    // Test-only helper: callers (integration tests via the
    // SimulatorInspectorEndpoints) can check whether the supplied opaque
    // token is one of the synthetic simulator prefixes. Exposed as a
    // public static so the test harness can use it without an instance.
    public static string SimulatorPrefixMarker => SimulatorPrefix;

    public static bool TryClassifySimulatorToken(string? opaqueToken, out SimulatedTokenKind kind)
    {
        kind = SimulatedTokenKind.None;
        if (string.IsNullOrWhiteSpace(opaqueToken)) return false;
        if (!opaqueToken.StartsWith(SimulatorPrefix, StringComparison.Ordinal)) return false;

        if (opaqueToken.StartsWith(SimulatorPrefix + "resident-", StringComparison.Ordinal))
        {
            kind = SimulatedTokenKind.Resident;
            return true;
        }
        if (opaqueToken.StartsWith(SimulatorPrefix + "visitor-", StringComparison.Ordinal))
        {
            kind = SimulatedTokenKind.Visitor;
            return true;
        }
        if (opaqueToken.StartsWith(SimulatorPrefix + "unknown-", StringComparison.Ordinal))
        {
            kind = SimulatedTokenKind.Unknown;
            return true;
        }
        return false;
    }
}

public enum SimulatedTokenKind
{
    None = 0,
    Resident = 1,
    Visitor = 2,
    Unknown = 3
}
