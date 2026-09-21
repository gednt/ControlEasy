using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;

namespace ControlEasyReborn.Modules.AccessControl.Application.Commands;

public sealed record RecordAccessScanCommand(
    Guid TenantId,
    string QrPayload,
    CycleDirection Direction,
    Guid ScanAttemptId,
    Guid PerformedByProfileId,
    Guid? GatehouseId,
    bool ConfirmDuplicate,
    string? VisitorName = null,
    string? VisitorDocument = null);

public sealed record LookupSubjectCommand(
    Guid TenantId,
    LookupCriterionType Criterion,
    string Value,
    string? Unit);

public sealed record RecordManualAccessCommand(
    Guid TenantId,
    Guid LookupAuditId,
    SubjectType SubjectType,
    Guid SubjectId,
    CycleDirection Direction,
    Guid PerformedByProfileId,
    Guid? GatehouseId,
    AccessEventKind Kind = AccessEventKind.Access,
    string? PackageDescription = null,
    string? PackageCarrierCode = null);

public sealed record IssueCredentialCommand(
    Guid TenantId,
    SubjectType SubjectType,
    Guid SubjectId,
    DateTime ValidFromUtc,
    DateTime? ExpiresAtUtc,
    Guid IssuedByProfileId);

public sealed record ReplaceCredentialCommand(
    Guid TenantId,
    Guid CredentialId,
    DateTime ValidFromUtc,
    DateTime? ExpiresAtUtc,
    Guid IssuedByProfileId);

public sealed record RevokeCredentialCommand(
    Guid TenantId,
    Guid CredentialId,
    string? ReasonCode,
    string? ReasonText,
    Guid ActorProfileId);