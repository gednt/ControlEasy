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
    private readonly VisitorArrivalHandler _arrivalHandler;

    public CreateVisitHandler(
        IVisitRepository visits,
        IApartmentRepository apartments,
        IValidator<CreateVisitRequest> validator,
        VisitorArrivalHandler arrivalHandler)
    {
        _visits = visits;
        _apartments = apartments;
        _validator = validator;
        _arrivalHandler = arrivalHandler;
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

        // Walk-in (D-02/VISIT-02): CheckInNow routes through the shared VisitorArrivalHandler
        // so deduplication against already CheckedIn or Pending visits by document is enforced.
        if (request.CheckInNow)
        {
            var arrivalResult = await _arrivalHandler.HandleAsync(new VisitorArrivalCommand(
                TenantId: tenantId,
                VisitorName: request.VisitorName,
                VisitorDocument: request.VisitorDocument,
                VisitorPhone: request.VisitorPhone,
                DestinationApartmentId: apartment.Id,
                DestinationBlock: apartment.Block,
                DestinationUnit: apartment.Unit,
                Purpose: request.Purpose,
                AttendantProfileId: attendantProfileId,
                GatehouseId: gatehouseId,
                OccurredAtUtc: DateTime.UtcNow), ct);

            return ToResponse(arrivalResult.Visit);
        }

        var nowUtc = DateTime.UtcNow;
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
            status: VisitStatus.Pending,
            attendantProfileId: null,
            gatehouseId: null,
            checkedInAtUtc: null,
            checkedOutAtUtc: null,
            createdAtUtc: nowUtc);

        await _visits.AddAsync(visit, ct);
        return ToResponse(visit);
    }

    internal static VisitResponse ToResponse(Visit v) =>
        new(v.Id, v.TenantId, v.VisitorName, v.VisitorDocument, v.VisitorPhone, v.ApartmentId, v.DestinationBlock, v.DestinationUnit, v.Purpose, v.Status.ToString(), v.AttendantProfileId, v.GatehouseId, v.CheckedInAtUtc, v.CheckedOutAtUtc, v.CreatedAtUtc, v.UpdatedAtUtc);
}