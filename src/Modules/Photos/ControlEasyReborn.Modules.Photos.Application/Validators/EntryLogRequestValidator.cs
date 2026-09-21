using ControlEasyReborn.Modules.Photos.Application.Contracts;
using FluentValidation;

namespace ControlEasyReborn.Modules.Photos.Application.Validators;

public sealed class CreateEntryLogRequestValidator : AbstractValidator<CreateEntryLogRequest>
{
    public CreateEntryLogRequestValidator()
    {
        RuleFor(r => r.EntryState)
            .NotEmpty()
            .Must(s => Domain.Entities.EntryStatesConstants.Contains(s))
            .WithMessage("EntryState must be one of: entered_with_consent, entered_without_consent, entered_override, exited. Walk-in registration moved to POST /api/v1/visits (CheckInNow); package drops moved to POST /api/v1/access-events/manual (kind=package-drop).");

        RuleFor(r => r.SubjectType)
            .NotEmpty()
            .Must(s => Domain.Entities.SubjectCategoriesConstants.Contains(s))
            .WithMessage("SubjectType must be one of: dweller, visitor, service_provider, vehicle.");

        RuleFor(r => r.SubjectName)
            .MaximumLength(200)
            .When(r => !string.IsNullOrEmpty(r.SubjectName));

        RuleFor(r => r.SubjectDocument)
            .MaximumLength(20)
            .When(r => !string.IsNullOrEmpty(r.SubjectDocument));

        RuleFor(r => r.OverrideReason)
            .Must(s => s is null || Domain.Entities.OverrideReasonsConstants.Contains(s))
            .WithMessage("OverrideReason must be 'emergency' or 'vouched'.");
    }
}

public sealed class UploadPhotoMetadataValidator : AbstractValidator<UploadPhotoMetadata>
{
    private static readonly string[] AllowedMimeTypes =
    [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];
    private static readonly string[] AllowedEntityTypes = ["resident", "visitor", "vehicle", "service-provider"];

    public UploadPhotoMetadataValidator()
    {
        RuleFor(r => r.MimeType)
            .NotEmpty()
            .Must(m => AllowedMimeTypes.Contains(m))
            .WithMessage("Unsupported image mime type. Allowed: image/jpeg, image/png, image/webp.");

        RuleFor(r => r)
            .Must(r => string.IsNullOrWhiteSpace(r.EntityType) == string.IsNullOrWhiteSpace(r.EntityId))
            .WithMessage("Entity type and entity id must be supplied together.");

        RuleFor(r => r.EntityType)
            .Must(type => type is not null && AllowedEntityTypes.Contains(type))
            .When(r => !string.IsNullOrWhiteSpace(r.EntityType))
            .WithMessage("Entity type must be resident, visitor, vehicle, or service-provider.");

        RuleFor(r => r.EntityId)
            .MaximumLength(100)
            .When(r => !string.IsNullOrWhiteSpace(r.EntityId));
    }
}

public sealed class UpdateConsentPolicyRequestValidator : AbstractValidator<UpdateConsentPolicyRequest>
{
    public UpdateConsentPolicyRequestValidator()
    {
        RuleFor(r => r.SubjectCategory)
            .NotEmpty()
            .Must(s => Domain.Entities.SubjectCategoriesConstants.Contains(s))
            .WithMessage("SubjectCategory must be one of: dweller, visitor, service_provider, vehicle.");

        RuleFor(r => r.DwellTimeLimitMinutes)
            .GreaterThan(0)
            .When(r => r.DwellTimeLimitMinutes.HasValue);
    }
}
