using ControlEasyReborn.Modules.AccessControl.Application.Abstractions;
using ControlEasyReborn.Modules.AccessControl.Application.Commands;
using ControlEasyReborn.Modules.AccessControl.Application.Handlers;
using ControlEasyReborn.Modules.AccessControl.Domain.Entities;
using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;
using ControlEasyReborn.Modules.Apartments.Application.Abstractions;
using ControlEasyReborn.Modules.Apartments.Domain.Entities;
using ControlEasyReborn.Modules.Residents.Application.Abstractions;
using ControlEasyReborn.Modules.Residents.Domain.Entities;
using ControlEasyReborn.Modules.Vehicles.Application.Abstractions;
using FluentAssertions;
using NSubstitute;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.AccessControl.Application.Handlers;

public sealed class LookupSubjectHandlerTests
{
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _profileId = Guid.NewGuid();
    private readonly IAccessLookupAuditRepository _audits = Substitute.For<IAccessLookupAuditRepository>();
    private readonly IResidentDirectory _residents = Substitute.For<IResidentDirectory>();
    private readonly IVehicleDirectory _vehicles = Substitute.For<IVehicleDirectory>();
    private readonly IApartmentDirectory _apartments = Substitute.For<IApartmentDirectory>();
    private readonly ControlEasyReborn.Modules.Visits.Application.Abstractions.IVisitDirectory _visits = Substitute.For<ControlEasyReborn.Modules.Visits.Application.Abstractions.IVisitDirectory>();

    private sealed class StubClock : IAccessControlClock
    {
        public DateTime UtcNow { get; set; } = DateTime.UtcNow;
    }

    private LookupSubjectHandler Build(StubClock? clock = null) =>
        new(_audits, clock ?? new StubClock(), _residents, _vehicles, _apartments, _visits);

    [Fact]
    public async Task Lookup_by_name_below_min_length_throws_validation_search_too_broad()
    {
        var handler = Build();
        var cmd = new LookupSubjectCommand(_tenantId, LookupCriterionType.Name, "Ma", null);

        var act = async () => await handler.HandleAsync(cmd, _profileId, CancellationToken.None);

        await act.Should().ThrowAsync<ControlEasyReborn.Modules.AccessControl.Application.Errors.ValidationException>();
    }

    [Fact]
    public async Task Lookup_by_cpf_returns_resident_with_masked_document()
    {
        var residentId = Guid.NewGuid();
        var apartmentId = Guid.NewGuid();
        _residents.FindActiveByCpfAsync(_tenantId, "12345678901", Arg.Any<CancellationToken>())
            .Returns(new Resident(residentId, _tenantId, "Maria", "12345678901", null, null, apartmentId, active: true, DateTime.UtcNow, null));
        _apartments.FindActiveAsync(_tenantId, apartmentId, Arg.Any<CancellationToken>())
            .Returns(new Apartment(apartmentId, _tenantId, "A1", "101", active: true, DateTime.UtcNow, null));

        var handler = Build();
        var cmd = new LookupSubjectCommand(_tenantId, LookupCriterionType.Cpf, "12345678901", null);
        var result = await handler.HandleAsync(cmd, _profileId, CancellationToken.None);

        result.Items.Should().HaveCount(1);
        var item = result.Items[0];
        item.SubjectId.Should().Be(residentId);
        item.DisplayName.Should().Be("Maria");
        item.DocumentMasked.Should().Be("***8901");
        item.ApartmentBlock.Should().Be("A1");
        item.ApartmentUnit.Should().Be("101");
    }

    [Fact]
    public async Task Lookup_by_block_writes_access_lookup_audit_with_zero_band_when_no_match()
    {
        _apartments.SearchByBlockAsync(_tenantId, "BLOCK-Z", 0, 25, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<Apartment>());

        var handler = Build();
        var cmd = new LookupSubjectCommand(_tenantId, LookupCriterionType.Block, "BLOCK-Z", null);
        var result = await handler.HandleAsync(cmd, _profileId, CancellationToken.None);

        result.ResultCountBand.Should().Be(ResultCountBand.Zero);
        result.Items.Should().BeEmpty();
        await _audits.Received(1).AddAsync(
            Arg.Is<AccessLookupAudit>(a => a.CriterionType == LookupCriterionType.Block && a.ResultCountBand == ResultCountBand.Zero && a.TenantId == _tenantId && a.PerformedByProfileId == _profileId),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Lookup_by_name_with_no_match_returns_zero_band_and_no_items()
    {
        _residents.SearchByNameAsync(_tenantId, "Absent", 0, 25, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<Resident>());

        var handler = Build();
        var cmd = new LookupSubjectCommand(_tenantId, LookupCriterionType.Name, "Absent", null);
        var result = await handler.HandleAsync(cmd, _profileId, CancellationToken.None);

        result.ResultCountBand.Should().Be(ResultCountBand.Zero);
        result.Items.Should().BeEmpty();
    }

    [Fact]
    public async Task Lookup_by_document_with_no_match_returns_zero_band()
    {
        _residents.SearchByDocumentAsync(_tenantId, "national_id", "ABC123", Arg.Any<CancellationToken>())
            .Returns(Array.Empty<Resident>());

        var handler = Build();
        var cmd = new LookupSubjectCommand(_tenantId, LookupCriterionType.IdentityDocument, "ABC123", null);
        var result = await handler.HandleAsync(cmd, _profileId, CancellationToken.None);

        result.ResultCountBand.Should().Be(ResultCountBand.Zero);
    }

    [Fact]
    public async Task Lookup_by_cpf_returns_both_resident_and_pending_visitor()
    {
        var residentId = Guid.NewGuid();
        var visitId = Guid.NewGuid();
        var apartmentId = Guid.NewGuid();

        _residents.FindActiveByCpfAsync(_tenantId, "12345678909", Arg.Any<CancellationToken>())
            .Returns(new Resident(residentId, _tenantId, "Felipe Residente", "12345678909", null, null, apartmentId, true, DateTime.UtcNow, null));
        _apartments.FindActiveAsync(_tenantId, apartmentId, Arg.Any<CancellationToken>())
            .Returns(new Apartment(apartmentId, _tenantId, "A", "101", true, DateTime.UtcNow, null));

        var visit = new ControlEasyReborn.Modules.Visits.Domain.Entities.Visit(
            visitId, _tenantId, "Felipe Visitante", "12345678909", null, apartmentId, "B", "202", "Visit",
            ControlEasyReborn.Modules.Visits.Domain.Entities.VisitStatus.Pending, null, null, null, null, DateTime.UtcNow, null);

        _visits.SearchPendingByDocumentAsync(_tenantId, "12345678909", Arg.Any<CancellationToken>())
            .Returns(new[] { visit });

        var handler = Build();
        var cmd = new LookupSubjectCommand(_tenantId, LookupCriterionType.Cpf, "12345678909", null);
        var result = await handler.HandleAsync(cmd, _profileId, CancellationToken.None);

        result.Items.Should().HaveCount(2);
        result.Items.Should().Contain(i => i.SubjectType == "resident" && i.DisplayName == "Felipe Residente" && i.ApartmentBlock == "A");
        result.Items.Should().Contain(i => i.SubjectType == "visitor" && i.DisplayName == "Felipe Visitante" && i.ApartmentBlock == "B");
    }
}
