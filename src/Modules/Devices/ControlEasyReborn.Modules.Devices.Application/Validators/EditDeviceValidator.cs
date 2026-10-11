using ControlEasyReborn.Modules.Devices.Application.Contracts;
using FluentValidation;

namespace ControlEasyReborn.Modules.Devices.Application.Validators;

public sealed class EditDeviceValidator : AbstractValidator<EditDeviceRequest>
{
    public EditDeviceValidator()
    {
        // All fields optional. Vendor, when present, must be non-empty and
        // within length. GatehouseId, when present, must be a valid GUID.
        // ConnectionParams, when present, must be a non-null dictionary.
        RuleFor(r => r.Vendor)
            .NotEmpty().WithMessage("vendor cannot be empty when provided.")
            .MaximumLength(64).WithMessage("vendor must be 64 characters or fewer.")
            .When(r => r.Vendor is not null);

        RuleFor(r => r.GatehouseId)
            .Must(g => g.HasValue && g.Value != Guid.Empty)
            .WithMessage("gatehouseId must be a valid non-empty GUID when provided.")
            .When(r => r.GatehouseId.HasValue);

        RuleFor(r => r.ConnectionParams)
            .NotNull().WithMessage("connectionParams cannot be null when provided.")
            .When(r => r.ConnectionParams is not null);
    }
}