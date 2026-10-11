using ControlEasyReborn.Modules.Devices.Application.Contracts;
using FluentValidation;

namespace ControlEasyReborn.Modules.Devices.Application.Validators;

public sealed class RegisterDeviceValidator : AbstractValidator<RegisterDeviceRequest>
{
    public RegisterDeviceValidator()
    {
        RuleFor(r => r.DeviceType)
            .NotEmpty().WithMessage("deviceType is required.")
            .Must(t => t == "reader" || t == "controller")
            .WithMessage("deviceType must be 'reader' or 'controller'.");

        RuleFor(r => r.Vendor)
            .NotEmpty().WithMessage("vendor is required.")
            .MaximumLength(64).WithMessage("vendor must be 64 characters or fewer.");

        RuleFor(r => r.GatehouseId)
            .Must(g => !g.HasValue || g.Value != Guid.Empty)
            .WithMessage("gatehouseId must be a valid non-empty GUID when provided.");

        RuleFor(r => r.ConnectionParams)
            .NotNull().WithMessage("connectionParams is required.");
    }
}