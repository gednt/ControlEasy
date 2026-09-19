namespace ControlEasyReborn.Modules.Visits.Application.Contracts;

public sealed record CreateVisitRequest(string VisitorName, string VisitorDocument, string? VisitorPhone, Guid? ApartmentId, string? Purpose, bool CheckInNow = false);

public sealed record CheckInRequest;

public sealed record CheckOutRequest;

public sealed record VisitResponse(
    Guid Id,
    Guid TenantId,
    string VisitorName,
    string VisitorDocument,
    string? VisitorPhone,
    Guid ApartmentId,
    string DestinationBlock,
    string DestinationUnit,
    string? Purpose,
    string Status,
    Guid? AttendantProfileId,
    Guid? GatehouseId,
    DateTime? CheckedInAtUtc,
    DateTime? CheckedOutAtUtc,
    DateTime CreatedAtUtc,
    DateTime? UpdatedAtUtc);
