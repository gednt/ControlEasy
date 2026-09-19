using ControlEasyReborn.Modules.AccessControl.Application.Abstractions;
using ControlEasyReborn.Modules.AccessControl.Application.Commands;
using ControlEasyReborn.Modules.AccessControl.Application.Handlers;
using ControlEasyReborn.Modules.AccessControl.Domain.Entities;
using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;
using ControlEasyReborn.Modules.Apartments.Application.Abstractions;
using ControlEasyReborn.Modules.Apartments.Domain.Entities;
using ControlEasyReborn.Modules.Photos.Application.Abstractions;
using ControlEasyReborn.Modules.Residents.Application.Abstractions;
using ControlEasyReborn.Modules.Residents.Domain.Entities;
using ControlEasyReborn.Modules.Vehicles.Application.Abstractions;
using ControlEasyReborn.Modules.Vehicles.Domain.Entities;
using FluentAssertions;
using NSubstitute;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.AccessControl.Application.Handlers;

public sealed class RecordManualAccessHandlerTests
{
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _profileId = Guid.NewGuid();
    private readonly IAccessLookupAuditRepository _audits = Substitute.For<IAccessLookupAuditRepository>();
    private readonly IAccessEventRepository _events = Substitute.For<IAccessEventRepository>();
    private readonly IResidentDirectory _residents = Substitute.For<IResidentDirectory>();
    private readonly IVehicleDirectory _vehicles = Substitute.For<IVehicleDirectory>();
    private readonly IApartmentDirectory _apartments = Substitute.For<IApartmentDirectory>();
    private readonly ControlEasyReborn.Modules.Visits.Application.Abstractions.IVisitDirectory _visits = Substitute.For<ControlEasyReborn.Modules.Visits.Application.Abstractions.IVisitDirectory>();
    private readonly IConsentPolicyEvaluator _policy = Substitute.For<IConsentPolicyEvaluator>();

    private sealed class StubClock : IAccessControlClock
    {
        public DateTime UtcNow { get; set; } = DateTime.UtcNow;
    }

    private RecordManualAccessHandler Build() =>
        new(_audits, _events, new StubClock(), _policy, new AccessEventDestinationResolver(_residents, _vehicles, _apartments, _visits), _visits);

    [Fact]
    public async Task Records_manual_event_when_audit_belongs_to_profile_and_subject_resolves()
    {
        var lookupAuditId = Guid.NewGuid();
        var residentId = Guid.NewGuid();
        var apartmentId = Guid.NewGuid();
        _audits.FindAsync(_tenantId, lookupAuditId, Arg.Any<CancellationToken>())
            .Returns(AccessLookupAudit.Hydrate(lookupAuditId, _tenantId, LookupCriterionType.Cpf, ResultCountBand.One, SubjectType.Resident, residentId, _profileId, DateTime.UtcNow, Guid.NewGuid()));
        _residents.FindByIdAsync(_tenantId, residentId, Arg.Any<CancellationToken>())
            .Returns(new Resident(residentId, _tenantId, "Maria", "000", null, null, apartmentId, active: true, DateTime.UtcNow, null));
        _apartments.FindActiveAsync(_tenantId, apartmentId, Arg.Any<CancellationToken>())
            .Returns(new Apartment(apartmentId, _tenantId, "A1", "101", active: true, DateTime.UtcNow, null));
        _policy.EvaluateAsync("resident", residentId, "manual", Arg.Any<CancellationToken>())
            .Returns(ConsentOutcome.Permitted);

        var handler = Build();
        var cmd = new RecordManualAccessCommand(_tenantId, lookupAuditId, SubjectType.Resident, residentId, CycleDirection.Entrance, _profileId, null);
        var result = await handler.HandleAsync(cmd, CancellationToken.None);

        result.AccessEventId.Should().NotBe(Guid.Empty);
        result.SubjectType.Should().Be(SubjectType.Resident);
        result.SubjectId.Should().Be(residentId);
        result.AccessMethod.Should().Be(AccessMethod.ManualLookup);
        result.DestinationApartmentId.Should().Be(apartmentId);
        result.DestinationBlock.Should().Be("A1");
        result.DestinationUnit.Should().Be("101");

        await _events.Received(1).AddAsync(
            Arg.Is<AccessEvent>(e => e.SubjectId == residentId && e.AccessMethod == AccessMethod.ManualLookup && e.LookupAuditId == lookupAuditId),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Throws_validation_when_lookup_audit_is_orphan()
    {
        var lookupAuditId = Guid.NewGuid();
        _audits.FindAsync(_tenantId, lookupAuditId, Arg.Any<CancellationToken>())
            .Returns((AccessLookupAudit?)null);

        var handler = Build();
        var cmd = new RecordManualAccessCommand(_tenantId, lookupAuditId, SubjectType.Resident, Guid.NewGuid(), CycleDirection.Entrance, _profileId, null);

        var act = async () => await handler.HandleAsync(cmd, CancellationToken.None);

        var exception = await act.Should().ThrowAsync<ControlEasyReborn.Modules.AccessControl.Application.Errors.ValidationException>();
        exception.Which.Errors.Should().ContainKey("LookupAuditId");
        exception.Which.Errors["LookupAuditId"].Should().Contain(RefusalCodes.ManualEventOrphanLookupId);
    }

    [Fact]
    public async Task Throws_validation_when_lookup_audit_belongs_to_different_profile()
    {
        var lookupAuditId = Guid.NewGuid();
        var otherProfileId = Guid.NewGuid();
        _audits.FindAsync(_tenantId, lookupAuditId, Arg.Any<CancellationToken>())
            .Returns(AccessLookupAudit.Hydrate(lookupAuditId, _tenantId, LookupCriterionType.Cpf, ResultCountBand.One, SubjectType.Resident, Guid.NewGuid(), otherProfileId, DateTime.UtcNow, Guid.NewGuid()));

        var handler = Build();
        var cmd = new RecordManualAccessCommand(_tenantId, lookupAuditId, SubjectType.Resident, Guid.NewGuid(), CycleDirection.Entrance, _profileId, null);

        var act = async () => await handler.HandleAsync(cmd, CancellationToken.None);

        await act.Should().ThrowAsync<ControlEasyReborn.Modules.AccessControl.Application.Errors.ValidationException>();
    }

    [Fact]
    public async Task Throws_validation_when_destination_resolution_fails()
    {
        var lookupAuditId = Guid.NewGuid();
        var vehicleId = Guid.NewGuid();
        _audits.FindAsync(_tenantId, lookupAuditId, Arg.Any<CancellationToken>())
            .Returns(AccessLookupAudit.Hydrate(lookupAuditId, _tenantId, LookupCriterionType.Cpf, ResultCountBand.One, SubjectType.Vehicle, vehicleId, _profileId, DateTime.UtcNow, Guid.NewGuid()));
        _vehicles.FindActiveAsync(_tenantId, vehicleId, Arg.Any<CancellationToken>()).Returns((Vehicle?)null);

        var handler = Build();
        var cmd = new RecordManualAccessCommand(_tenantId, lookupAuditId, SubjectType.Vehicle, vehicleId, CycleDirection.Entrance, _profileId, null);

        var act = async () => await handler.HandleAsync(cmd, CancellationToken.None);

        var exception = await act.Should().ThrowAsync<ControlEasyReborn.Modules.AccessControl.Application.Errors.ValidationException>();
        exception.Which.Errors.Should().ContainKey("SubjectId");
        exception.Which.Errors["SubjectId"].Should().Contain(RefusalCodes.VehicleInactive);
    }

    [Fact]
    public async Task Throws_validation_when_policy_refuses_manual_event()
    {
        var lookupAuditId = Guid.NewGuid();
        var residentId = Guid.NewGuid();
        var apartmentId = Guid.NewGuid();
        _audits.FindAsync(_tenantId, lookupAuditId, Arg.Any<CancellationToken>())
            .Returns(AccessLookupAudit.Hydrate(lookupAuditId, _tenantId, LookupCriterionType.Cpf, ResultCountBand.One, SubjectType.Resident, residentId, _profileId, DateTime.UtcNow, Guid.NewGuid()));
        _residents.FindByIdAsync(_tenantId, residentId, Arg.Any<CancellationToken>())
            .Returns(new Resident(residentId, _tenantId, "Maria", "000", null, null, apartmentId, active: true, DateTime.UtcNow, null));
        _apartments.FindActiveAsync(_tenantId, apartmentId, Arg.Any<CancellationToken>())
            .Returns(new Apartment(apartmentId, _tenantId, "A1", "101", active: true, DateTime.UtcNow, null));
        _policy.EvaluateAsync("resident", residentId, "manual", Arg.Any<CancellationToken>())
            .Returns(ConsentOutcome.Refused);

        var handler = Build();
        var cmd = new RecordManualAccessCommand(_tenantId, lookupAuditId, SubjectType.Resident, residentId, CycleDirection.Entrance, _profileId, null);

        var act = async () => await handler.HandleAsync(cmd, CancellationToken.None);

        await act.Should().ThrowAsync<ControlEasyReborn.Modules.AccessControl.Application.Errors.ValidationException>();
    }

    [Fact]
    public async Task Records_manual_event_and_checks_in_visitor_on_entrance()
    {
        var lookupAuditId = Guid.NewGuid();
        var visitId = Guid.NewGuid();
        var apartmentId = Guid.NewGuid();
        var visit = new ControlEasyReborn.Modules.Visits.Domain.Entities.Visit(
            visitId, _tenantId, "Carlos Visitante", "12345678901", null, apartmentId, "Block B", "204", "Party",
            ControlEasyReborn.Modules.Visits.Domain.Entities.VisitStatus.Pending, null, null, null, null, DateTime.UtcNow, null);

        _audits.FindAsync(_tenantId, lookupAuditId, Arg.Any<CancellationToken>())
            .Returns(AccessLookupAudit.Hydrate(lookupAuditId, _tenantId, LookupCriterionType.Cpf, ResultCountBand.One, SubjectType.Visitor, visitId, _profileId, DateTime.UtcNow, Guid.NewGuid()));
        _visits.FindByIdAsync(_tenantId, visitId, Arg.Any<CancellationToken>())
            .Returns(visit);
        _policy.EvaluateAsync("visitor", visitId, "manual", Arg.Any<CancellationToken>())
            .Returns(ConsentOutcome.Permitted);

        var handler = Build();
        var cmd = new RecordManualAccessCommand(_tenantId, lookupAuditId, SubjectType.Visitor, visitId, CycleDirection.Entrance, _profileId, null);

        var result = await handler.HandleAsync(cmd, CancellationToken.None);

        result.PolicyOutcome.Should().Be(PolicyOutcome.Permit);
        result.SubjectType.Should().Be(SubjectType.Visitor);
        result.DestinationBlock.Should().Be("Block B");
        result.DestinationUnit.Should().Be("204");

        await _visits.Received(1).CheckInAsync(_tenantId, visitId, _profileId, null, Arg.Any<CancellationToken>());
    }
}