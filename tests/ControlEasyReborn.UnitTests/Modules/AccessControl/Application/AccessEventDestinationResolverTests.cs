using ControlEasyReborn.Modules.AccessControl.Application.Handlers;
using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;
using ControlEasyReborn.Modules.Apartments.Application.Abstractions;
using ControlEasyReborn.Modules.Apartments.Domain.Entities;
using ControlEasyReborn.Modules.Residents.Application.Abstractions;
using ControlEasyReborn.Modules.Residents.Domain.Entities;
using ControlEasyReborn.Modules.Vehicles.Application.Abstractions;
using ControlEasyReborn.Modules.Vehicles.Domain.Entities;
using FluentAssertions;
using NSubstitute;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.AccessControl.Application.Handlers;

public sealed class AccessEventDestinationResolverTests
{
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly IResidentDirectory _residents = Substitute.For<IResidentDirectory>();
    private readonly IVehicleDirectory _vehicles = Substitute.For<IVehicleDirectory>();
    private readonly IApartmentDirectory _apartments = Substitute.For<IApartmentDirectory>();
    private readonly ControlEasyReborn.Modules.Visits.Application.Abstractions.IVisitDirectory _visits = Substitute.For<ControlEasyReborn.Modules.Visits.Application.Abstractions.IVisitDirectory>();

    private AccessEventDestinationResolver BuildResolver() => new(_residents, _vehicles, _apartments, _visits);

    [Fact]
    public async Task Resident_with_active_apartment_returns_that_apartment()
    {
        var residentId = Guid.NewGuid();
        var apartmentId = Guid.NewGuid();
        _residents.FindByIdAsync(_tenantId, residentId, Arg.Any<CancellationToken>())
            .Returns(new Resident(residentId, _tenantId, "Maria", "000", null, null, apartmentId, active: true, DateTime.UtcNow, null));
        _apartments.FindActiveAsync(_tenantId, apartmentId, Arg.Any<CancellationToken>())
            .Returns(new Apartment(apartmentId, _tenantId, "A", "101", active: true, DateTime.UtcNow, null));

        var resolver = BuildResolver();
        var resolution = await resolver.ResolveAsync(_tenantId, SubjectType.Resident, residentId, CancellationToken.None);

        resolution.Resolved.Should().BeTrue();
        resolution.ApartmentId.Should().Be(apartmentId);
        resolution.Block.Should().Be("A");
        resolution.Unit.Should().Be("101");
        resolution.FailureCode.Should().BeNull();
    }

    [Fact]
    public async Task Resident_without_apartment_returns_destination_required()
    {
        var residentId = Guid.NewGuid();
        _residents.FindByIdAsync(_tenantId, residentId, Arg.Any<CancellationToken>())
            .Returns(new Resident(residentId, _tenantId, "Maria", "000", null, null, apartmentId: null, active: true, DateTime.UtcNow, null));

        var resolver = BuildResolver();
        var resolution = await resolver.ResolveAsync(_tenantId, SubjectType.Resident, residentId, CancellationToken.None);

        resolution.Resolved.Should().BeFalse();
        resolution.FailureCode.Should().Be(RefusalCodes.DestinationRequired);
    }

    [Fact]
    public async Task Resident_inactive_returns_subject_inactive()
    {
        var residentId = Guid.NewGuid();
        _residents.FindByIdAsync(_tenantId, residentId, Arg.Any<CancellationToken>())
            .Returns(new Resident(residentId, _tenantId, "Maria", "000", null, null, Guid.NewGuid(), active: false, DateTime.UtcNow, null));

        var resolver = BuildResolver();
        var resolution = await resolver.ResolveAsync(_tenantId, SubjectType.Resident, residentId, CancellationToken.None);

        resolution.Resolved.Should().BeFalse();
        resolution.FailureCode.Should().Be(RefusalCodes.SubjectInactive);
    }

    [Fact]
    public async Task Vehicle_with_owner_resident_prefers_owner_apartment_over_vehicle_apartment()
    {
        var vehicleId = Guid.NewGuid();
        var ownerId = Guid.NewGuid();
        var ownerApartmentId = Guid.NewGuid();
        var vehicleApartmentId = Guid.NewGuid();

        _vehicles.FindActiveAsync(_tenantId, vehicleId, Arg.Any<CancellationToken>())
            .Returns(new Vehicle(vehicleId, _tenantId, "AAA", null, null, null, vehicleApartmentId, "Owner", VehicleType.Car, active: true, DateTime.UtcNow, null, ownerResidentId: ownerId));
        _residents.FindByIdAsync(_tenantId, ownerId, Arg.Any<CancellationToken>())
            .Returns(new Resident(ownerId, _tenantId, "Owner", "000", null, null, ownerApartmentId, active: true, DateTime.UtcNow, null));
        _apartments.FindActiveAsync(_tenantId, ownerApartmentId, Arg.Any<CancellationToken>())
            .Returns(new Apartment(ownerApartmentId, _tenantId, "OWNER-BLOCK", "OWNER-UNIT", active: true, DateTime.UtcNow, null));
        _apartments.FindActiveAsync(_tenantId, vehicleApartmentId, Arg.Any<CancellationToken>())
            .Returns(new Apartment(vehicleApartmentId, _tenantId, "VEHICLE-BLOCK", "VEHICLE-UNIT", active: true, DateTime.UtcNow, null));

        var resolver = BuildResolver();
        var resolution = await resolver.ResolveAsync(_tenantId, SubjectType.Vehicle, vehicleId, CancellationToken.None);

        resolution.Resolved.Should().BeTrue();
        resolution.ApartmentId.Should().Be(ownerApartmentId);
        resolution.Block.Should().Be("OWNER-BLOCK");
        resolution.Unit.Should().Be("OWNER-UNIT");
    }

    [Fact]
    public async Task Vehicle_without_owner_falls_back_to_vehicle_apartment()
    {
        var vehicleId = Guid.NewGuid();
        var vehicleApartmentId = Guid.NewGuid();

        _vehicles.FindActiveAsync(_tenantId, vehicleId, Arg.Any<CancellationToken>())
            .Returns(new Vehicle(vehicleId, _tenantId, "AAA", null, null, null, vehicleApartmentId, "Owner", VehicleType.Car, active: true, DateTime.UtcNow, null, ownerResidentId: null));
        _apartments.FindActiveAsync(_tenantId, vehicleApartmentId, Arg.Any<CancellationToken>())
            .Returns(new Apartment(vehicleApartmentId, _tenantId, "VEHICLE-BLOCK", "VEHICLE-UNIT", active: true, DateTime.UtcNow, null));

        var resolver = BuildResolver();
        var resolution = await resolver.ResolveAsync(_tenantId, SubjectType.Vehicle, vehicleId, CancellationToken.None);

        resolution.Resolved.Should().BeTrue();
        resolution.ApartmentId.Should().Be(vehicleApartmentId);
    }

    [Fact]
    public async Task Vehicle_inactive_returns_vehicle_inactive()
    {
        var vehicleId = Guid.NewGuid();
        _vehicles.FindActiveAsync(_tenantId, vehicleId, Arg.Any<CancellationToken>())
            .Returns((Vehicle?)null);

        var resolver = BuildResolver();
        var resolution = await resolver.ResolveAsync(_tenantId, SubjectType.Vehicle, vehicleId, CancellationToken.None);

        resolution.Resolved.Should().BeFalse();
        resolution.FailureCode.Should().Be(RefusalCodes.VehicleInactive);
    }

    [Fact]
    public async Task Vehicle_with_no_owner_and_no_apartment_returns_destination_required()
    {
        var vehicleId = Guid.NewGuid();
        _vehicles.FindActiveAsync(_tenantId, vehicleId, Arg.Any<CancellationToken>())
            .Returns(new Vehicle(vehicleId, _tenantId, "AAA", null, null, null, apartmentId: null, "Owner", VehicleType.Car, active: true, DateTime.UtcNow, null, ownerResidentId: null));

        var resolver = BuildResolver();
        var resolution = await resolver.ResolveAsync(_tenantId, SubjectType.Vehicle, vehicleId, CancellationToken.None);

        resolution.Resolved.Should().BeFalse();
        resolution.FailureCode.Should().Be(RefusalCodes.DestinationRequired);
    }

    [Fact]
    public async Task Resident_apartment_inactive_returns_destination_inactive()
    {
        var residentId = Guid.NewGuid();
        var apartmentId = Guid.NewGuid();
        _residents.FindByIdAsync(_tenantId, residentId, Arg.Any<CancellationToken>())
            .Returns(new Resident(residentId, _tenantId, "Maria", "000", null, null, apartmentId, active: true, DateTime.UtcNow, null));
        _apartments.FindActiveAsync(_tenantId, apartmentId, Arg.Any<CancellationToken>())
            .Returns((Apartment?)null);

        var resolver = BuildResolver();
        var resolution = await resolver.ResolveAsync(_tenantId, SubjectType.Resident, residentId, CancellationToken.None);

        resolution.Resolved.Should().BeFalse();
        resolution.FailureCode.Should().Be(RefusalCodes.DestinationInactive);
    }

    [Fact]
    public async Task Visitor_with_valid_visit_returns_destination()
    {
        var visitId = Guid.NewGuid();
        var apartmentId = Guid.NewGuid();
        var visit = new ControlEasyReborn.Modules.Visits.Domain.Entities.Visit(
            visitId, _tenantId, "Carlos Visitante", "12345678901", null, apartmentId, "Block B", "204", "Party",
            ControlEasyReborn.Modules.Visits.Domain.Entities.VisitStatus.Pending, null, null, null, null, DateTime.UtcNow, null);

        _visits.FindByIdAsync(_tenantId, visitId, Arg.Any<CancellationToken>())
            .Returns(visit);

        var resolver = BuildResolver();
        var resolution = await resolver.ResolveAsync(_tenantId, SubjectType.Visitor, visitId, CancellationToken.None);

        resolution.Resolved.Should().BeTrue();
        resolution.ApartmentId.Should().Be(apartmentId);
        resolution.Block.Should().Be("Block B");
        resolution.Unit.Should().Be("204");
        resolution.FailureCode.Should().BeNull();
    }

    [Fact]
    public async Task Resident_standalone_credential_without_resident_entity_resolves_fallback_apartment()
    {
        var randomResidentId = Guid.NewGuid();
        var fallbackAptId = Guid.NewGuid();
        _residents.FindByIdAsync(_tenantId, randomResidentId, Arg.Any<CancellationToken>())
            .Returns((Resident?)null);
        _apartments.FindFirstActiveAsync(_tenantId, Arg.Any<CancellationToken>())
            .Returns(new Apartment(fallbackAptId, _tenantId, "1", "51", active: true, DateTime.UtcNow, null));

        var resolver = BuildResolver();
        var resolution = await resolver.ResolveAsync(_tenantId, SubjectType.Resident, randomResidentId, CancellationToken.None);

        resolution.Resolved.Should().BeTrue();
        resolution.ApartmentId.Should().Be(fallbackAptId);
        resolution.Block.Should().Be("1");
        resolution.Unit.Should().Be("51");
        resolution.FailureCode.Should().BeNull();
    }

    [Fact]
    public async Task Visitor_standalone_credential_without_visit_entity_resolves_fallback_apartment()
    {
        var randomVisitId = Guid.NewGuid();
        var fallbackAptId = Guid.NewGuid();
        _visits.FindByIdAsync(_tenantId, randomVisitId, Arg.Any<CancellationToken>())
            .Returns((ControlEasyReborn.Modules.Visits.Domain.Entities.Visit?)null);
        _apartments.FindFirstActiveAsync(_tenantId, Arg.Any<CancellationToken>())
            .Returns(new Apartment(fallbackAptId, _tenantId, "1", "51", active: true, DateTime.UtcNow, null));

        var resolver = BuildResolver();
        var resolution = await resolver.ResolveAsync(_tenantId, SubjectType.Visitor, randomVisitId, CancellationToken.None);

        resolution.Resolved.Should().BeTrue();
        resolution.ApartmentId.Should().Be(fallbackAptId);
        resolution.Block.Should().Be("1");
        resolution.Unit.Should().Be("51");
        resolution.FailureCode.Should().BeNull();
    }
}