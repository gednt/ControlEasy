using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;

namespace ControlEasyReborn.Modules.AccessControl.Domain.Entities;

public sealed class AccessEvent
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public SubjectType SubjectType { get; private set; }
    public Guid SubjectId { get; private set; }
    public CycleDirection Direction { get; private set; }
    public AccessMethod AccessMethod { get; private set; }
    public Guid? CredentialId { get; private set; }
    public Guid? LookupAuditId { get; private set; }
    public Guid ScanAttemptId { get; private set; }
    public Guid PerformedByProfileId { get; private set; }
    public Guid? GatehouseId { get; private set; }
    public DateTime OccurredAtUtc { get; private set; }
    public Guid CorrelationId { get; private set; }
    public Guid? DuplicateOfAccessEventId { get; private set; }
    public bool DuplicateConfirmed { get; private set; }
    public PolicyOutcome PolicyOutcome { get; private set; }
    public Guid DestinationApartmentId { get; private set; }
    public string DestinationBlock { get; private set; } = string.Empty;
    public string DestinationUnit { get; private set; } = string.Empty;
    public AccessEventKind EventKind { get; private set; }
    public string? PackageDescription { get; private set; }
    public string? PackageCarrierCode { get; private set; }

    private AccessEvent() { }

    private AccessEvent(
        Guid id,
        Guid tenantId,
        SubjectType subjectType,
        Guid subjectId,
        CycleDirection direction,
        AccessMethod accessMethod,
        Guid? credentialId,
        Guid? lookupAuditId,
        Guid scanAttemptId,
        Guid performedByProfileId,
        Guid? gatehouseId,
        DateTime occurredAtUtc,
        Guid correlationId,
        Guid? duplicateOfAccessEventId,
        bool duplicateConfirmed,
        PolicyOutcome policyOutcome,
        Guid destinationApartmentId,
        string destinationBlock,
        string destinationUnit,
        AccessEventKind eventKind = AccessEventKind.Access,
        string? packageDescription = null,
        string? packageCarrierCode = null)
    {
        if (destinationApartmentId == Guid.Empty && eventKind != AccessEventKind.PackageDrop)
            throw new InvalidOperationException("Destination apartment is required.");
        if (eventKind == AccessEventKind.PackageDrop && destinationApartmentId == Guid.Empty
            && (string.IsNullOrWhiteSpace(destinationBlock) || string.IsNullOrWhiteSpace(destinationUnit)))
            throw new InvalidOperationException("Condominium-level package drops require a gatehouse destination snapshot.");
        if (string.IsNullOrWhiteSpace(destinationBlock)) throw new InvalidOperationException("Destination block is required.");
        if (string.IsNullOrWhiteSpace(destinationUnit)) throw new InvalidOperationException("Destination unit is required.");
        if (accessMethod == AccessMethod.Qr && credentialId is null)
            throw new InvalidOperationException("QR access events require a credential id.");
        if (accessMethod == AccessMethod.ManualLookup && lookupAuditId is null)
            throw new InvalidOperationException("Manual lookup access events require a lookup audit id.");
        if (eventKind != AccessEventKind.PackageDrop && (packageDescription is not null || packageCarrierCode is not null))
            throw new InvalidOperationException("Package fields are only valid for package-drop events.");

        Id = id;
        TenantId = tenantId;
        SubjectType = subjectType;
        SubjectId = subjectId;
        Direction = direction;
        AccessMethod = accessMethod;
        CredentialId = credentialId;
        LookupAuditId = lookupAuditId;
        ScanAttemptId = scanAttemptId;
        PerformedByProfileId = performedByProfileId;
        GatehouseId = gatehouseId;
        OccurredAtUtc = occurredAtUtc;
        CorrelationId = correlationId;
        DuplicateOfAccessEventId = duplicateOfAccessEventId;
        DuplicateConfirmed = duplicateConfirmed;
        PolicyOutcome = policyOutcome;
        DestinationApartmentId = destinationApartmentId;
        DestinationBlock = destinationBlock;
        DestinationUnit = destinationUnit;
        EventKind = eventKind;
        PackageDescription = packageDescription;
        PackageCarrierCode = packageCarrierCode;
    }

    public static AccessEvent Record(
        Guid tenantId,
        SubjectType subjectType,
        Guid subjectId,
        CycleDirection direction,
        AccessMethod accessMethod,
        Guid? credentialId,
        Guid? lookupAuditId,
        Guid scanAttemptId,
        Guid performedByProfileId,
        Guid? gatehouseId,
        DateTime occurredAtUtc,
        Guid correlationId,
        Guid? duplicateOfAccessEventId,
        bool duplicateConfirmed,
        PolicyOutcome policyOutcome,
        Guid destinationApartmentId,
        string destinationBlock,
        string destinationUnit,
        AccessEventKind eventKind = AccessEventKind.Access,
        string? packageDescription = null,
        string? packageCarrierCode = null)
    {
        return new AccessEvent(
            id: Guid.NewGuid(),
            tenantId: tenantId,
            subjectType: subjectType,
            subjectId: subjectId,
            direction: direction,
            accessMethod: accessMethod,
            credentialId: credentialId,
            lookupAuditId: lookupAuditId,
            scanAttemptId: scanAttemptId,
            performedByProfileId: performedByProfileId,
            gatehouseId: gatehouseId,
            occurredAtUtc: occurredAtUtc,
            correlationId: correlationId,
            duplicateOfAccessEventId: duplicateOfAccessEventId,
            duplicateConfirmed: duplicateConfirmed,
            policyOutcome: policyOutcome,
            destinationApartmentId: destinationApartmentId,
            destinationBlock: destinationBlock,
            destinationUnit: destinationUnit,
            eventKind: eventKind,
            packageDescription: packageDescription,
            packageCarrierCode: packageCarrierCode);
    }

    public static AccessEvent Hydrate(
        Guid id,
        Guid tenantId,
        SubjectType subjectType,
        Guid subjectId,
        CycleDirection direction,
        AccessMethod accessMethod,
        Guid? credentialId,
        Guid? lookupAuditId,
        Guid scanAttemptId,
        Guid performedByProfileId,
        Guid? gatehouseId,
        DateTime occurredAtUtc,
        Guid correlationId,
        Guid? duplicateOfAccessEventId,
        bool duplicateConfirmed,
        PolicyOutcome policyOutcome,
        Guid destinationApartmentId,
        string destinationBlock,
        string destinationUnit,
        AccessEventKind eventKind = AccessEventKind.Access,
        string? packageDescription = null,
        string? packageCarrierCode = null)
    {
        return new AccessEvent(
            id: id,
            tenantId: tenantId,
            subjectType: subjectType,
            subjectId: subjectId,
            direction: direction,
            accessMethod: accessMethod,
            credentialId: credentialId,
            lookupAuditId: lookupAuditId,
            scanAttemptId: scanAttemptId,
            performedByProfileId: performedByProfileId,
            gatehouseId: gatehouseId,
            occurredAtUtc: occurredAtUtc,
            correlationId: correlationId,
            duplicateOfAccessEventId: duplicateOfAccessEventId,
            duplicateConfirmed: duplicateConfirmed,
            policyOutcome: policyOutcome,
            destinationApartmentId: destinationApartmentId,
            destinationBlock: destinationBlock,
            destinationUnit: destinationUnit,
            eventKind: eventKind,
            packageDescription: packageDescription,
            packageCarrierCode: packageCarrierCode);
    }
}
