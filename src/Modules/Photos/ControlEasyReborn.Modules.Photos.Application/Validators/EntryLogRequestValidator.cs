using ControlEasyReborn.Modules.Photos.Application.Contracts;
using FluentValidation;

namespace ControlEasyReborn.Modules.Photos.Application.Validators;

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
