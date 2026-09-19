using ControlEasyReborn.Modules.AccessControl.Domain.Entities;
using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;
using ControlEasyReborn.Modules.Apartments.Application.Abstractions;
using ControlEasyReborn.Modules.Apartments.Domain.Entities;
using ControlEasyReborn.Modules.Residents.Application.Abstractions;
using ControlEasyReborn.Modules.Residents.Domain.Entities;
using ControlEasyReborn.Modules.Vehicles.Application.Abstractions;
using ControlEasyReborn.Modules.Vehicles.Domain.Entities;
using ControlEasyReborn.Modules.Visits.Application.Abstractions;
using ControlEasyReborn.Modules.Visits.Domain.Entities;

namespace ControlEasyReborn.Modules.AccessControl.Application.Handlers;

public sealed record DestinationResolution(
    bool Resolved,
    Guid? ApartmentId,
    string Block,
    string Unit,
    string? FailureCode);

public sealed class AccessEventDestinationResolver
{
    private readonly IResidentDirectory _residents;
    private readonly IVehicleDirectory _vehicles;
    private readonly IApartmentDirectory _apartments;
    private readonly IVisitDirectory _visits;

    public AccessEventDestinationResolver(
        IResidentDirectory residents,
        IVehicleDirectory vehicles,
        IApartmentDirectory apartments,
        IVisitDirectory visits)
    {
        _residents = residents;
        _vehicles = vehicles;
        _apartments = apartments;
        _visits = visits;
    }

    public async Task<DestinationResolution> ResolveAsync(Guid tenantId, SubjectType subjectType, Guid subjectId, CancellationToken ct)
    {
        return subjectType switch
        {
            SubjectType.Resident => await ResolveResidentAsync(tenantId, subjectId, ct),
            SubjectType.Vehicle => await ResolveVehicleAsync(tenantId, subjectId, ct),
            SubjectType.Visitor => await ResolveVisitorAsync(tenantId, subjectId, ct),
            _ => new DestinationResolution(false, null, string.Empty, string.Empty, RefusalCodes.NotAuthorized)
        };
    }

    private async Task<DestinationResolution> ResolveVisitorAsync(Guid tenantId, Guid visitId, CancellationToken ct)
    {
        var visit = await _visits.FindByIdAsync(tenantId, visitId, ct);
        if (visit is not null)
        {
            if (visit.Status == VisitStatus.Cancelled)
                return new DestinationResolution(false, null, string.Empty, string.Empty, RefusalCodes.SubjectInactive);
            if (visit.ApartmentId == Guid.Empty)
                return new DestinationResolution(false, null, string.Empty, string.Empty, RefusalCodes.DestinationRequired);

            return new DestinationResolution(true, visit.ApartmentId, visit.DestinationBlock, visit.DestinationUnit, null);
        }

        // Standalone visitor credential: allow entry with fallback apartment
        var fallbackApt = await _apartments.FindFirstActiveAsync(tenantId, ct);
        if (fallbackApt is not null)
        {
            return new DestinationResolution(true, fallbackApt.Id, fallbackApt.Block, fallbackApt.Unit, null);
        }

        return new DestinationResolution(false, null, string.Empty, string.Empty, RefusalCodes.DestinationRequired);
    }

    private async Task<DestinationResolution> ResolveResidentAsync(Guid tenantId, Guid residentId, CancellationToken ct)
    {
        var resident = await _residents.FindByIdAsync(tenantId, residentId, ct);
        if (resident is not null)
        {
            if (!resident.Active)
                return new DestinationResolution(false, null, string.Empty, string.Empty, RefusalCodes.SubjectInactive);
            if (!resident.ApartmentId.HasValue || resident.ApartmentId.Value == Guid.Empty)
                return new DestinationResolution(false, null, string.Empty, string.Empty, RefusalCodes.DestinationRequired);

            return await ResolveApartmentAsync(tenantId, resident.ApartmentId.Value, ct);
        }

        // Standalone resident credential: allow entry with fallback apartment
        var fallbackApt = await _apartments.FindFirstActiveAsync(tenantId, ct);
        if (fallbackApt is not null)
        {
            return new DestinationResolution(true, fallbackApt.Id, fallbackApt.Block, fallbackApt.Unit, null);
        }

        return new DestinationResolution(false, null, string.Empty, string.Empty, RefusalCodes.DestinationRequired);
    }

    private async Task<DestinationResolution> ResolveVehicleAsync(Guid tenantId, Guid vehicleId, CancellationToken ct)
    {
        var vehicle = await _vehicles.FindActiveAsync(tenantId, vehicleId, ct);
        if (vehicle is null)
            return new DestinationResolution(false, null, string.Empty, string.Empty, RefusalCodes.VehicleInactive);

        if (vehicle.OwnerResidentId.HasValue && vehicle.OwnerResidentId.Value != Guid.Empty)
        {
            var owner = await _residents.FindByIdAsync(tenantId, vehicle.OwnerResidentId.Value, ct);
            if (owner is not null && owner.Active && owner.ApartmentId.HasValue && owner.ApartmentId.Value != Guid.Empty)
            {
                return await ResolveApartmentAsync(tenantId, owner.ApartmentId.Value, ct);
            }
        }

        if (vehicle.ApartmentId.HasValue && vehicle.ApartmentId.Value != Guid.Empty)
        {
            return await ResolveApartmentAsync(tenantId, vehicle.ApartmentId.Value, ct);
        }

        return new DestinationResolution(false, null, string.Empty, string.Empty, RefusalCodes.DestinationRequired);
    }

    private async Task<DestinationResolution> ResolveApartmentAsync(Guid tenantId, Guid apartmentId, CancellationToken ct)
    {
        var apartment = await _apartments.FindActiveAsync(tenantId, apartmentId, ct);
        if (apartment is null || !apartment.Active)
            return new DestinationResolution(false, null, string.Empty, string.Empty, RefusalCodes.DestinationInactive);

        return new DestinationResolution(true, apartmentId, apartment.Block, apartment.Unit, null);
    }
}