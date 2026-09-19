using ControlEasyReborn.Modules.AccessControl.Application.Commands;
using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;
using FluentValidation;

namespace ControlEasyReborn.Modules.AccessControl.Application.Validators;

public sealed class RecordAccessScanCommandValidator : AbstractValidator<RecordAccessScanCommand>
{
    public RecordAccessScanCommandValidator()
    {
        RuleFor(c => c.TenantId).NotEmpty();
        RuleFor(c => c.QrPayload)
            .NotEmpty()
            .MaximumLength(512);
        RuleFor(c => c.ScanAttemptId).NotEmpty();
        RuleFor(c => c.PerformedByProfileId).NotEmpty();
        RuleFor(c => c.Direction)
            .Must(d => d == CycleDirection.Entrance || d == CycleDirection.Exit)
            .WithMessage("Direction must be 'entrance' or 'exit'.");

        // Threat T-16-01-01: gatehouse-entered visitor profile fields are
        // operational data only (never used for authz); length-constrained to
        // mirror the Visits schema (200 / 20).
        RuleFor(c => c.VisitorName)
            .MaximumLength(200)
            .When(c => !string.IsNullOrEmpty(c.VisitorName));
        RuleFor(c => c.VisitorDocument)
            .MaximumLength(20)
            .When(c => !string.IsNullOrEmpty(c.VisitorDocument));
    }
}

public sealed class LookupSubjectCommandValidator : AbstractValidator<LookupSubjectCommand>
{
    public LookupSubjectCommandValidator()
    {
        RuleFor(c => c.TenantId).NotEmpty();
        RuleFor(c => c.Criterion).IsInEnum();
        RuleFor(c => c.Value)
            .NotEmpty()
            .MaximumLength(256);
        RuleFor(c => c.Unit)
            .MaximumLength(64)
            .When(c => !string.IsNullOrEmpty(c.Unit));
    }
}

public sealed class RecordManualAccessCommandValidator : AbstractValidator<RecordManualAccessCommand>
{
    public RecordManualAccessCommandValidator()
    {
        RuleFor(c => c.TenantId).NotEmpty();
        RuleFor(c => c.LookupAuditId).NotEmpty();
        RuleFor(c => c.SubjectType)
            .Must(t => t == SubjectType.Resident || t == SubjectType.Vehicle || t == SubjectType.Visitor)
            .WithMessage("SubjectType must be 'resident', 'vehicle', or 'visitor'.");
        RuleFor(c => c.SubjectId).NotEmpty();
        RuleFor(c => c.PerformedByProfileId).NotEmpty();
        RuleFor(c => c.Direction)
            .Must(d => d == CycleDirection.Entrance || d == CycleDirection.Exit)
            .WithMessage("Direction must be 'entrance' or 'exit'.");
    }
}

public sealed class IssueCredentialCommandValidator : AbstractValidator<IssueCredentialCommand>
{
    public IssueCredentialCommandValidator()
    {
        RuleFor(c => c.TenantId).NotEmpty();
        RuleFor(c => c.SubjectType)
            .Must(t => t == SubjectType.Resident || t == SubjectType.Vehicle || t == SubjectType.Visitor)
            .WithMessage("SubjectType must be 'resident', 'vehicle', or 'visitor'.");
        RuleFor(c => c.SubjectId).NotEmpty();
        RuleFor(c => c.IssuedByProfileId).NotEmpty();
        RuleFor(c => c.ValidFromUtc).NotEqual(default(DateTime));
    }
}

public sealed class ReplaceCredentialCommandValidator : AbstractValidator<ReplaceCredentialCommand>
{
    public ReplaceCredentialCommandValidator()
    {
        RuleFor(c => c.TenantId).NotEmpty();
        RuleFor(c => c.CredentialId).NotEmpty();
        RuleFor(c => c.IssuedByProfileId).NotEmpty();
        RuleFor(c => c.ValidFromUtc).NotEqual(default(DateTime));
    }
}

public sealed class RevokeCredentialCommandValidator : AbstractValidator<RevokeCredentialCommand>
{
    public RevokeCredentialCommandValidator()
    {
        RuleFor(c => c.TenantId).NotEmpty();
        RuleFor(c => c.CredentialId).NotEmpty();
        RuleFor(c => c.ActorProfileId).NotEmpty();
        RuleFor(c => c.ReasonText)
            .MaximumLength(500)
            .When(c => !string.IsNullOrEmpty(c.ReasonText));
        RuleFor(c => c.ReasonCode)
            .MaximumLength(64)
            .When(c => !string.IsNullOrEmpty(c.ReasonCode));
    }
}