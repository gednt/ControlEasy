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

public sealed class RecordAccessScanHandlerTests
{
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _profileId = Guid.NewGuid();

    private readonly IAccessCredentialRepository _credentials = Substitute.For<IAccessCredentialRepository>();
    private readonly IAccessEventRepository _events = Substitute.For<IAccessEventRepository>();
    private readonly IRefusedScanAttemptRepository _refusals = Substitute.For<IRefusedScanAttemptRepository>();
    private readonly IResidentDirectory _residents = Substitute.For<IResidentDirectory>();
    private readonly IVehicleDirectory _vehicles = Substitute.For<IVehicleDirectory>();
    private readonly IApartmentDirectory _apartments = Substitute.For<IApartmentDirectory>();
    private readonly IConsentPolicyEvaluator _policy = Substitute.For<IConsentPolicyEvaluator>();
    private readonly IGatehouseAccessValidator _gatehouses = Substitute.For<IGatehouseAccessValidator>();

    public RecordAccessScanHandlerTests()
    {
        _credentials.ListAsync(_tenantId, 0, 100, Arg.Any<CancellationToken>(), Arg.Any<Guid?>(), Arg.Any<SubjectType?>(), Arg.Any<CredentialStatus?>())
            .Returns(Array.Empty<AccessCredential>());
        _credentials.ListAllAsync(_tenantId, Arg.Any<CancellationToken>()).Returns(Array.Empty<AccessCredential>());
        _events.ListAsync(_tenantId, Arg.Any<DateTime?>(), Arg.Any<DateTime?>(), Arg.Any<CycleDirection?>(), Arg.Any<SubjectType?>(), Arg.Any<Guid?>(), Arg.Any<AccessMethod?>(), Arg.Any<CredentialStatus?>(), Arg.Any<Guid?>(), Arg.Any<Guid?>(), 0, 100, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<AccessEvent>());
        _refusals.ListAsync(_tenantId, Arg.Any<DateTime?>(), Arg.Any<DateTime?>(), Arg.Any<CycleDirection?>(), Arg.Any<string?>(), Arg.Any<Guid?>(), 0, 100, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<RefusedScanAttempt>());
        _residents.SearchByApartmentAsync(_tenantId, Arg.Any<Guid>(), 0, 100, Arg.Any<CancellationToken>()).Returns(Array.Empty<Resident>());
        _residents.GetActiveIdentityDocumentsAsync(_tenantId, Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(Array.Empty<ResidentIdentityDocument>());
        _crypto.ResolveByTokenAsync(_tenantId, Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((AccessCredential?)null);
        _gatehouses.EnsureValidAsync(_tenantId, Arg.Any<Guid?>(), Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);
    }

    private readonly IAccessControlCryptoService _crypto = Substitute.For<IAccessControlCryptoService>();

    private RecordAccessScanHandler BuildHandler() => new(
        _credentials,
        _events,
        _refusals,
        _residents,
        _vehicles,
        _apartments,
        _policy,
        _crypto,
        new SystemAccessControlClock(),
        _gatehouses);

    [Fact]
    public async Task Rejects_scan_before_persisting_when_gatehouse_is_missing()
    {
        var cmd = new RecordAccessScanCommand(
            _tenantId,
            "token",
            CycleDirection.Entrance,
            Guid.NewGuid(),
            _profileId,
            null,
            false);
        _gatehouses.EnsureValidAsync(_tenantId, null, Arg.Any<CancellationToken>()).Returns(
            Task.FromException(new ControlEasyReborn.Modules.AccessControl.Application.Errors.ValidationException(
                new Dictionary<string, string[]> { ["GatehouseId"] = new[] { "required" } })));

        var act = () => BuildHandler().HandleAsync(cmd, CancellationToken.None);

        await act.Should().ThrowAsync<ControlEasyReborn.Modules.AccessControl.Application.Errors.ValidationException>();
        await _events.DidNotReceive().AddAsync(Arg.Any<AccessEvent>(), Arg.Any<CancellationToken>());
        await _refusals.DidNotReceive().AddAsync(Arg.Any<RefusedScanAttempt>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Returns_refused_invalid_credential_when_no_credential_matches_token_within_tenant()
    {
        var cmd = new RecordAccessScanCommand(
            _tenantId,
            QrPayload: "invalid-token",
            Direction: CycleDirection.Entrance,
            ScanAttemptId: Guid.NewGuid(),
            PerformedByProfileId: _profileId,
            GatehouseId: null,
            ConfirmDuplicate: false);

        var handler = BuildHandler();
        var result = await handler.HandleAsync(cmd, CancellationToken.None);

        result.Decision.Should().Be(ScanDecisionKind.Refused);
        result.FailureCode.Should().Be(RefusalCodes.InvalidCredential);
        await _refusals.Received(1).AddAsync(
            Arg.Is<RefusedScanAttempt>(a => a.FailureCode == RefusalCodes.InvalidCredential && a.TenantId == _tenantId),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Returns_recorded_decision_with_resolved_destination_for_active_resident_credential()
    {
        var residentId = Guid.NewGuid();
        var apartmentId = Guid.NewGuid();
        var credential = BuildCredential(SubjectType.Resident, residentId, CredentialStatus.Active);
        _crypto.ResolveByTokenAsync(_tenantId, Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(credential);
        var resident = BuildResident(residentId, apartmentId, active: true);
        _residents.FindByIdAsync(_tenantId, residentId, Arg.Any<CancellationToken>()).Returns(resident);
        var apartment = BuildApartment(apartmentId, "A1", "101", active: true);
        _apartments.FindActiveAsync(_tenantId, apartmentId, Arg.Any<CancellationToken>()).Returns(apartment);
        _policy.EvaluateAsync("resident", residentId, "scan", Arg.Any<CancellationToken>())
            .Returns(ConsentOutcome.Permitted);

        var cmd = new RecordAccessScanCommand(
            _tenantId,
            "qr-token",
            CycleDirection.Entrance,
            Guid.NewGuid(),
            _profileId,
            null,
            false);

        var handler = BuildHandler();
        var result = await handler.HandleAsync(cmd, CancellationToken.None);

        result.Decision.Should().Be(ScanDecisionKind.Recorded);
        result.DestinationApartmentId.Should().Be(apartmentId);
        result.DestinationBlock.Should().Be("A1");
        result.DestinationUnit.Should().Be("101");
        result.SubjectType.Should().Be(SubjectType.Resident);
        result.SubjectId.Should().Be(residentId);
        result.PolicyOutcome.Should().Be(PolicyOutcome.Permit);
        await _events.Received(1).AddAsync(Arg.Is<AccessEvent>(e =>
            e.SubjectId == residentId &&
            e.DestinationApartmentId == apartmentId &&
            e.AccessMethod == AccessMethod.Qr),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Returns_refused_credential_inactive_when_credential_status_is_revoked()
    {
        var residentId = Guid.NewGuid();
        var credential = BuildCredential(SubjectType.Resident, residentId, CredentialStatus.Revoked);
        _crypto.ResolveByTokenAsync(_tenantId, Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(credential);

        var cmd = new RecordAccessScanCommand(
            _tenantId, "qr-token", CycleDirection.Entrance, Guid.NewGuid(), _profileId, null, false);

        var handler = BuildHandler();
        var result = await handler.HandleAsync(cmd, CancellationToken.None);

        result.Decision.Should().Be(ScanDecisionKind.Refused);
        result.FailureCode.Should().Be(RefusalCodes.CredentialInactive);
    }

    [Fact]
    public async Task Returns_refused_subject_inactive_when_subject_is_deactivated()
    {
        var residentId = Guid.NewGuid();
        var credential = BuildCredential(SubjectType.Resident, residentId, CredentialStatus.Active);
        _crypto.ResolveByTokenAsync(_tenantId, Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(credential);
        _residents.FindByIdAsync(_tenantId, residentId, Arg.Any<CancellationToken>())
            .Returns(BuildResident(residentId, Guid.NewGuid(), active: false));

        var cmd = new RecordAccessScanCommand(
            _tenantId, "qr-token", CycleDirection.Entrance, Guid.NewGuid(), _profileId, null, false);

        var handler = BuildHandler();
        var result = await handler.HandleAsync(cmd, CancellationToken.None);

        result.Decision.Should().Be(ScanDecisionKind.Refused);
        result.FailureCode.Should().Be(RefusalCodes.SubjectInactive);
    }

    [Fact]
    public async Task Returns_refused_destination_required_when_resident_has_no_apartment()
    {
        var residentId = Guid.NewGuid();
        var credential = BuildCredential(SubjectType.Resident, residentId, CredentialStatus.Active);
        _crypto.ResolveByTokenAsync(_tenantId, Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(credential);
        _residents.FindByIdAsync(_tenantId, residentId, Arg.Any<CancellationToken>())
            .Returns(BuildResident(residentId, apartmentId: null, active: true));

        var cmd = new RecordAccessScanCommand(
            _tenantId, "qr-token", CycleDirection.Entrance, Guid.NewGuid(), _profileId, null, false);

        var handler = BuildHandler();
        var result = await handler.HandleAsync(cmd, CancellationToken.None);

        result.Decision.Should().Be(ScanDecisionKind.Refused);
        result.FailureCode.Should().Be(RefusalCodes.DestinationRequired);
    }

    [Fact]
    public async Task Returns_refused_destination_inactive_when_apartment_is_deactivated()
    {
        var residentId = Guid.NewGuid();
        var apartmentId = Guid.NewGuid();
        var credential = BuildCredential(SubjectType.Resident, residentId, CredentialStatus.Active);
        _crypto.ResolveByTokenAsync(_tenantId, Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(credential);
        _residents.FindByIdAsync(_tenantId, residentId, Arg.Any<CancellationToken>())
            .Returns(BuildResident(residentId, apartmentId, active: true));
        _apartments.FindActiveAsync(_tenantId, apartmentId, Arg.Any<CancellationToken>())
            .Returns(BuildApartment(apartmentId, "A1", "101", active: false));

        var cmd = new RecordAccessScanCommand(
            _tenantId, "qr-token", CycleDirection.Entrance, Guid.NewGuid(), _profileId, null, false);

        var handler = BuildHandler();
        var result = await handler.HandleAsync(cmd, CancellationToken.None);

        result.Decision.Should().Be(ScanDecisionKind.Refused);
        result.FailureCode.Should().Be(RefusalCodes.DestinationInactive);
    }

    [Fact]
    public async Task Returns_policy_action_required_when_consent_policy_requires_action()
    {
        var residentId = Guid.NewGuid();
        var apartmentId = Guid.NewGuid();
        var credential = BuildCredential(SubjectType.Resident, residentId, CredentialStatus.Active);
        _crypto.ResolveByTokenAsync(_tenantId, Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(credential);
        _residents.FindByIdAsync(_tenantId, residentId, Arg.Any<CancellationToken>())
            .Returns(BuildResident(residentId, apartmentId, active: true));
        _apartments.FindActiveAsync(_tenantId, apartmentId, Arg.Any<CancellationToken>())
            .Returns(BuildApartment(apartmentId, "A1", "101", active: true));
        _policy.EvaluateAsync("resident", residentId, "scan", Arg.Any<CancellationToken>())
            .Returns(ConsentOutcome.RequiresAction);

        var cmd = new RecordAccessScanCommand(
            _tenantId, "qr-token", CycleDirection.Entrance, Guid.NewGuid(), _profileId, null, false);

        var handler = BuildHandler();
        var result = await handler.HandleAsync(cmd, CancellationToken.None);

        result.Decision.Should().Be(ScanDecisionKind.PolicyActionRequired);
        result.FailureCode.Should().Be(RefusalCodes.PolicyActionRequired);
    }

    [Fact]
    public async Task Duplicate_scan_attempt_returns_same_decision_without_creating_a_second_event()
    {
        var residentId = Guid.NewGuid();
        var apartmentId = Guid.NewGuid();
        var credential = BuildCredential(SubjectType.Resident, residentId, CredentialStatus.Active);
        _crypto.ResolveByTokenAsync(_tenantId, Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(credential);
        _residents.FindByIdAsync(_tenantId, residentId, Arg.Any<CancellationToken>())
            .Returns(BuildResident(residentId, apartmentId, active: true));
        _apartments.FindActiveAsync(_tenantId, apartmentId, Arg.Any<CancellationToken>())
            .Returns(BuildApartment(apartmentId, "A1", "101", active: true));
        _policy.EvaluateAsync("resident", residentId, "scan", Arg.Any<CancellationToken>())
            .Returns(ConsentOutcome.Permitted);

        var scanAttemptId = Guid.NewGuid();
        var first = new RecordAccessScanCommand(_tenantId, "qr-token", CycleDirection.Entrance, scanAttemptId, _profileId, null, false);
        var second = new RecordAccessScanCommand(_tenantId, "qr-token", CycleDirection.Entrance, scanAttemptId, _profileId, null, false);

        AccessEvent? recorded = null;
        _events.WhenForAnyArgs(e => e.AddAsync(Arg.Any<AccessEvent>(), Arg.Any<CancellationToken>()))
            .Do(info => recorded = info.Arg<AccessEvent>());
        _events.FindByScanAttemptAsync(_tenantId, scanAttemptId, Arg.Any<CancellationToken>())
            .Returns(_ => recorded is null ? null : BuildEventFromRecorded(recorded));

        var handler = BuildHandler();
        var firstResult = await handler.HandleAsync(first, CancellationToken.None);
        var secondResult = await handler.HandleAsync(second, CancellationToken.None);

        firstResult.Decision.Should().Be(ScanDecisionKind.Recorded);
        secondResult.Decision.Should().Be(ScanDecisionKind.Recorded);
        secondResult.AccessEventId.Should().Be(firstResult.AccessEventId);
        await _events.Received(1).AddAsync(Arg.Any<AccessEvent>(), Arg.Any<CancellationToken>());
    }

    private static AccessEvent BuildEventFromRecorded(AccessEvent recorded) =>
        AccessEvent.Hydrate(
            recorded.Id,
            recorded.TenantId,
            recorded.SubjectType,
            recorded.SubjectId,
            recorded.Direction,
            recorded.AccessMethod,
            recorded.CredentialId,
            recorded.LookupAuditId,
            recorded.ScanAttemptId,
            recorded.PerformedByProfileId,
            recorded.GatehouseId,
            recorded.OccurredAtUtc,
            recorded.CorrelationId,
            recorded.DuplicateOfAccessEventId,
            recorded.DuplicateConfirmed,
            recorded.PolicyOutcome,
            recorded.DestinationApartmentId,
            recorded.DestinationBlock,
            recorded.DestinationUnit);

    private static AccessCredential BuildCredential(SubjectType subjectType, Guid subjectId, CredentialStatus status)
    {
        return AccessCredential.Hydrate(
            Guid.NewGuid(),
            Guid.NewGuid(),
            subjectType,
            subjectId,
            CredentialMethod.Qr,
            new byte[] { 1, 2, 3 },
            keyVersion: 1,
            status: status,
            validFromUtc: DateTime.UtcNow.AddMinutes(-5),
            expiresAtUtc: null,
            replacedByCredentialId: null,
            issuedByProfileId: Guid.NewGuid(),
            createdAtUtc: DateTime.UtcNow.AddMinutes(-5),
            updatedAtUtc: DateTime.UtcNow.AddMinutes(-5));
    }

    private static Resident BuildResident(Guid id, Guid? apartmentId, bool active) =>
        new(id, Guid.NewGuid(), "Test", "00000000000", null, null, apartmentId, active, DateTime.UtcNow, null);

    private static Apartment BuildApartment(Guid id, string block, string unit, bool active) =>
        new(id, Guid.NewGuid(), block, unit, active, DateTime.UtcNow, null);

    private static AccessEvent BuildEvent(Guid tenantId, Guid residentId, Guid credentialId, Guid apartmentId, Guid scanAttemptId) =>
        AccessEvent.Hydrate(
            Guid.NewGuid(),
            tenantId,
            SubjectType.Resident,
            residentId,
            CycleDirection.Entrance,
            AccessMethod.Qr,
            credentialId,
            null,
            scanAttemptId,
            Guid.NewGuid(),
            null,
            DateTime.UtcNow,
            Guid.NewGuid(),
            null,
            false,
            PolicyOutcome.Permit,
            apartmentId,
            "A1",
            "101");
}

internal sealed class SystemAccessControlClock : ControlEasyReborn.Modules.AccessControl.Application.Abstractions.IAccessControlClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}
