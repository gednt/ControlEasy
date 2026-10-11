using FluentValidation;

namespace ControlEasyReborn.Modules.Devices.Application.Validators;

// Phase 26 heartbeat ingestion validator (DOOR-12). Validates the counters
// that come in on the heartbeat payload (ErrorCount + EventsSinceLastSuccess)
// and the freshness window of the OccurredAtUtc.
//
// This validator runs INSIDE the IngestDeviceEventHandler before the event
// is dispatched to IngestHeartbeatHandler — it ensures non-heartbeat events
// don't leak through with an empty HeartbeatPayload shape.
public sealed class HeartbeatValidator : AbstractValidator<HeartbeatValidatorPayload>
{
    // Heartbeats must be fresh (within the last 5 minutes) — anything older
    // is either a clock-skew artifact or a backlog from a long disconnection
    // (the offline queue exists for that, not the live endpoint).
    private static readonly TimeSpan MaxClockSkew = TimeSpan.FromMinutes(5);

    public HeartbeatValidator()
    {
        RuleFor(p => p.ErrorCount)
            .GreaterThanOrEqualTo(0)
            .WithMessage("ErrorCount must be >= 0.");

        RuleFor(p => p.EventsSinceLastSuccess)
            .GreaterThanOrEqualTo(0)
            .WithMessage("EventsSinceLastSuccess must be >= 0.");

        RuleFor(p => p.OccurredAtUtc)
            .Must((p, occurredAtUtc) => Math.Abs((DateTime.UtcNow - occurredAtUtc.ToUniversalTime()).TotalMinutes) <= MaxClockSkew.TotalMinutes)
            .WithMessage("Heartbeat occurredAtUtc is outside the 5-minute freshness window.");
    }
}

// Light-weight view of the heartbeat payload that the validator reasons about.
// The full heartbeat shape lives in DeviceEventPayload + the
// IngestHeartbeatHandler directly — this view exists to keep the validator
// standalone (no cross-module dependency).
public sealed record HeartbeatValidatorPayload(
    int ErrorCount,
    int EventsSinceLastSuccess,
    DateTime OccurredAtUtc);