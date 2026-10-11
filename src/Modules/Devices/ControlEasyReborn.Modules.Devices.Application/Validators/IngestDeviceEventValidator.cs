using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Domain.Enums;
using FluentValidation;

namespace ControlEasyReborn.Modules.Devices.Application.Validators;

public sealed class IngestDeviceEventValidator : AbstractValidator<DeviceEventPayload>
{
    // Reject very stale events (> 24h ago). Live events arrive within seconds;
    // anything older is either a clock-skew artifact or a backlog from a long
    // disconnection (the offline queue exists for that, not the live
    // endpoint). Past events are accepted only via the simulator inspector.
    private static readonly TimeSpan MaxClockSkew = TimeSpan.FromHours(24);

    public IngestDeviceEventValidator()
    {
        RuleFor(p => p.EventType)
            .Must(t => Enum.IsDefined(typeof(DeviceEventType), t))
            .WithMessage("Unknown event type.");

        // Heartbeat is reserved for Phase 26 — Phase 25 explicitly rejects it.
        RuleFor(p => p.EventType)
            .Must(t => t != DeviceEventType.Heartbeat)
            .WithMessage("Heartbeat events are not accepted in Phase 25.");

        RuleFor(p => p.OccurredAtUtc)
            .Must((p, occurredAtUtc) => Math.Abs((DateTime.UtcNow - occurredAtUtc.ToUniversalTime()).TotalHours) <= MaxClockSkew.TotalHours)
            .WithMessage("occurredAtUtc is outside the 24h freshness window.");

        RuleFor(p => p.SequenceNumber)
            .GreaterThanOrEqualTo(0);

        RuleFor(p => p.ExternalEventId)
            .Must(id => !id.HasValue || id.Value != Guid.Empty)
            .WithMessage("ExternalEventId, if present, must not be empty.");

        RuleFor(p => p.OpaqueToken)
            .Must((p, t) => p.EventType != DeviceEventType.CardRead || !string.IsNullOrWhiteSpace(t))
            .WithMessage("OpaqueToken is required for card_read events.");

        RuleFor(p => p.PayloadJson)
            .Must((p, j) => p.EventType == DeviceEventType.Heartbeat || !string.IsNullOrWhiteSpace(j))
            .WithMessage("PayloadJson is required for non-heartbeat events.");
    }
}
