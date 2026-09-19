using ControlEasyReborn.Modules.Apartments.Application.Abstractions;
using ControlEasyReborn.Modules.Visits.Application.Abstractions;
using ControlEasyReborn.Modules.Visits.Application.Contracts;
using ControlEasyReborn.Modules.Visits.Application.Errors;
using ControlEasyReborn.Modules.Visits.Domain.Entities;
using FluentValidation;

namespace ControlEasyReborn.Modules.Visits.Application.Handlers;

public sealed class CreateVisitHandler
{
    private readonly IVisitRepository _visits;
    private readonly IApartmentRepository _apartments;
    private readonly IValidator<CreateVisitRequest> _validator;

    public CreateVisitHandler(
        IVisitRepository visits,
        IApartmentRepository apartments,
        IValidator<CreateVisitRequest> validator)
    {
        _visits = visits;
        _apartments = apartments;
        _validator = validator;
    }

    public async Task<VisitResponse> HandleAsync(CreateVisitRequest request, Guid tenantId, Guid? attendantProfileId = null, Guid? gatehouseId = null, CancellationToken ct = default)
    {
        var result = await _validator.ValidateAsync(request, ct);
        if (!result.IsValid)
        {
            throw new Errors.ValidationException(result.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()));
        }

        if (!request.ApartmentId.HasValue || request.ApartmentId.Value == Guid.Empty)
        {
            throw new Errors.ValidationException(new Dictionary<string, string[]>
            {
                ["ApartmentId"] = new[] { "An active destination apartment is required." }
            });
        }

        var apartment = await _apartments.FindAsync(request.ApartmentId.Value, ct);
        if (apartment is null)
        {
            throw new NotFoundException("Apartment " + request.ApartmentId + " was not found.");
        }
        if (!apartment.Active)
        {
            throw new Errors.ValidationException(new Dictionary<string, string[]>
            {
                ["ApartmentId"] = new[] { "Destination apartment is not active." }
            });
        }

        // Walk-in (D-02/VISIT-02): CheckInNow lands the Visit directly CheckedIn —
        // the person is physically present at the gate. AttendantProfileId and
        // GatehouseId are stamped server-side from the JWT tenant context.
        var nowUtc = DateTime.UtcNow;
        var checkInNow = request.CheckInNow;
        var visit = new Visit(
            id: Guid.NewGuid(),
            tenantId: tenantId,
            visitorName: request.VisitorName,
            visitorDocument: request.VisitorDocument,
            visitorPhone: request.VisitorPhone,
            apartmentId: apartment.Id,
            destinationBlock: apartment.Block,
            destinationUnit: apartment.Unit,
            purpose: request.Purpose,
            status: checkInNow ? VisitStatus.CheckedIn : VisitStatus.Pending,
            attendantProfileId: checkInNow ? attendantProfileId : null,
            gatehouseId: checkInNow ? gatehouseId : null,
            checkedInAtUtc: checkInNow ? nowUtc : null,
            checkedOutAtUtc: null,
            createdAtUtc: nowUtc);

        await _visits.AddAsync(visit, ct);
        return ToResponse(visit);
    }

    internal static VisitResponse ToResponse(Visit v) =>
        new(v.Id, v.TenantId, v.VisitorName, v.VisitorDocument, v.VisitorPhone, v.ApartmentId, v.DestinationBlock, v.DestinationUnit, v.Purpose, v.Status.ToString(), v.AttendantProfileId, v.GatehouseId, v.CheckedInAtUtc, v.CheckedOutAtUtc, v.CreatedAtUtc, v.UpdatedAtUtc);
}