namespace ControlEasyReborn.Modules.AccessControl.Application.Contracts;

public sealed record RecordAccessScanRequest(
    string QrPayload,
    string Direction,
    Guid ScanAttemptId,
    Guid? GatehouseId,
    bool ConfirmDuplicate,
    string? VisitorName = null,
    string? VisitorDocument = null);

public sealed record ScanResponse(
    string Decision,
    Guid AccessEventId,
    string SubjectType,
    Guid SubjectId,
    Guid? CredentialId,
    Guid? LookupAuditId,
    string AccessMethod,
    string Direction,
    string PolicyOutcome,
    Guid DestinationApartmentId,
    string DestinationBlock,
    string DestinationUnit);

public sealed record AccessCredentialResponse(
    Guid Id,
    Guid TenantId,
    string SubjectType,
    Guid SubjectId,
    string Method,
    string Status,
    DateTime ValidFromUtc,
    DateTime? ExpiresAtUtc,
    Guid? ReplacedByCredentialId,
    Guid IssuedByProfileId,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc,
    string? OneTimeQrPayload = null);

public sealed record LookupSubjectRequest(string Criterion, string Value, string? Unit);

public sealed record LookupResponseItem(
    string SubjectType,
    Guid SubjectId,
    Guid? ApartmentId,
    string? ApartmentBlock,
    string? ApartmentUnit,
    string? DisplayName,
    string? DocumentMasked,
    string? Plate);

public sealed record LookupResponse(
    Guid LookupAuditId,
    string Criterion,
    string ResultCountBand,
    IReadOnlyList<LookupResponseItem> Items);

public sealed record RecordManualAccessRequest(
    Guid LookupAuditId,
    string SubjectType,
    Guid SubjectId,
    string Direction,
    Guid? GatehouseId,
    string? Kind = null,
    string? PackageDescription = null,
    string? PackageCarrierCode = null);

public sealed record ManualAccessResponse(
    Guid AccessEventId,
    Guid LookupAuditId,
    string SubjectType,
    Guid SubjectId,
    string AccessMethod,
    string Direction,
    string PolicyOutcome,
    Guid DestinationApartmentId,
    string DestinationBlock,
    string DestinationUnit,
    string? Kind = null,
    string? PackageDescription = null,
    string? PackageCarrierCode = null);