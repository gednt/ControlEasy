using ControlEasyReborn.Modules.Devices.Application.Contracts;
using FluentValidation;

namespace ControlEasyReborn.Modules.Devices.Application.Validators;

// Per-device Configure thresholds (PUT /api/v1/devices/{deviceId}/thresholds).
// Keeps the DeviceHeartbeat entity's InvalidOperationException invariants
// (OfflineAfterSeconds > 0, 0 <= ErrorRateThresholdPercent <= 100)
// unreachable: invalid input surfaces as a module ValidationException (400
// ProblemDetails with an errors dict via the global handler) instead of a 500.
public sealed class UpdateDeviceThresholdsValidator : AbstractValidator<UpdateDeviceThresholdsRequest>
{
    public UpdateDeviceThresholdsValidator()
    {
        RuleFor(r => r.OfflineAfterSeconds)
            .GreaterThanOrEqualTo(1)
            .WithMessage("offlineAfterSeconds must be at least 1 second.")
            .LessThanOrEqualTo(86400)
            .WithMessage("offlineAfterSeconds must be at most 86400 seconds (24 hours).");

        RuleFor(r => r.ErrorRateThresholdPercent)
            .InclusiveBetween(0m, 100m)
            .WithMessage("errorRateThresholdPercent must be between 0 and 100.");
    }
}