using ControlEasyReborn.Modules.Photos.Application.Abstractions;
using ControlEasyReborn.Modules.Photos.Application.Contracts;
using ControlEasyReborn.Modules.Photos.Application.Errors;
using ControlEasyReborn.Modules.Photos.Application.Handlers;
using ControlEasyReborn.Modules.Photos.Application.Validators;
using ControlEasyReborn.Modules.Photos.Domain.Entities;
using FluentAssertions;
using NSubstitute;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.Photos;

public sealed class EntryLogHandlersTests
{
    private readonly IConsentAuditLogRepository _auditLogRepo = Substitute.For<IConsentAuditLogRepository>();
    private readonly IPhotoRepository _photoRepo = Substitute.For<IPhotoRepository>();
    private readonly ITenantConsentPolicyRepository _policyRepo = Substitute.For<ITenantConsentPolicyRepository>();
    private readonly CreateEntryLogRequestValidator _validator = new();
    private readonly CreateEntryLogHandler _createHandler;
    private readonly ListEntryLogsHandler _listHandler;
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _profileId = Guid.NewGuid();

    public EntryLogHandlersTests()
    {
        _createHandler = new CreateEntryLogHandler(_auditLogRepo, _photoRepo, _policyRepo, _validator);
        _listHandler = new ListEntryLogsHandler(_auditLogRepo);
    }

    [Fact]
    public async Task CreateEntry_WhenEnteredWithConsentAndValidPhoto_Succeeds()
    {
        var photoId = Guid.NewGuid();
        var photo = new Photo(photoId, _tenantId, "2026-09/photo.jpg", null, "image/jpeg", 100, DateTime.UtcNow, DateTime.UtcNow);
        _photoRepo.FindAsync(photoId, Arg.Any<CancellationToken>()).Returns(photo);

        var request = new CreateEntryLogRequest(
            EntryState: EntryStates.EnteredWithConsent,
            SubjectType: SubjectCategories.Visitor,
            SubjectName: "Alice",
            SubjectDocument: "123456789",
            PhotoId: photoId,
            OverrideReason: null);

        var response = await _createHandler.HandleAsync(request, _tenantId, _profileId, CancellationToken.None);

        response.Should().NotBeNull();
        response.EntryState.Should().Be(EntryStates.EnteredWithConsent);
        response.PhotoId.Should().Be(photoId);
        response.SubjectType.Should().Be(SubjectCategories.Visitor);
        response.PerformedByProfileId.Should().Be(_profileId);

        await _auditLogRepo.Received(1).AddAsync(Arg.Is<ConsentAuditLogEntry>(e =>
            e.TenantId == _tenantId &&
            e.EntryState == EntryStates.EnteredWithConsent &&
            e.PhotoId == photoId), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateEntry_WhenEnteredWithConsentAndNullPhotoId_ThrowsValidationException()
    {
        var request = new CreateEntryLogRequest(
            EntryState: EntryStates.EnteredWithConsent,
            SubjectType: SubjectCategories.Visitor,
            SubjectName: "Alice",
            SubjectDocument: "123456789",
            PhotoId: null,
            OverrideReason: null);

        var act = () => _createHandler.HandleAsync(request, _tenantId, _profileId, CancellationToken.None);

        await act.Should().ThrowAsync<ValidationException>()
            .Where(ex => ex.Errors.ContainsKey("PhotoId"));
    }

    [Fact]
    public async Task CreateEntry_WhenPhotoNotFoundOrBelongsToAnotherTenant_ThrowsNotFoundException()
    {
        var photoId = Guid.NewGuid();
        var otherTenantId = Guid.NewGuid();
        var photo = new Photo(photoId, otherTenantId, "path", null, "image/jpeg", 100, null, DateTime.UtcNow);
        _photoRepo.FindAsync(photoId, Arg.Any<CancellationToken>()).Returns(photo);

        var request = new CreateEntryLogRequest(
            EntryState: EntryStates.EnteredWithConsent,
            SubjectType: SubjectCategories.Visitor,
            SubjectName: "Alice",
            SubjectDocument: "123456789",
            PhotoId: photoId,
            OverrideReason: null);

        var act = () => _createHandler.HandleAsync(request, _tenantId, _profileId, CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Theory]
    [InlineData(SubjectCategories.Dweller, OverrideReasons.Emergency)]
    [InlineData(SubjectCategories.Visitor, OverrideReasons.Vouched)]
    public async Task CreateEntry_WhenEnteredOverrideForDwellerOrVisitorWithReason_Succeeds(string subject, string reason)
    {
        var request = new CreateEntryLogRequest(
            EntryState: EntryStates.EnteredOverride,
            SubjectType: subject,
            SubjectName: "Bob",
            SubjectDocument: "987654321",
            PhotoId: null,
            OverrideReason: reason);

        var response = await _createHandler.HandleAsync(request, _tenantId, _profileId, CancellationToken.None);

        response.Should().NotBeNull();
        response.EntryState.Should().Be(EntryStates.EnteredOverride);
        response.OverrideReason.Should().Be(reason);
    }

    [Theory]
    [InlineData(SubjectCategories.ServiceProvider)]
    [InlineData(SubjectCategories.Vehicle)]
    public async Task CreateEntry_WhenEnteredOverrideForServiceProviderOrVehicle_ThrowsValidationException(string subject)
    {
        var request = new CreateEntryLogRequest(
            EntryState: EntryStates.EnteredOverride,
            SubjectType: subject,
            SubjectName: "Contractor",
            SubjectDocument: "111222333",
            PhotoId: null,
            OverrideReason: OverrideReasons.Emergency);

        var act = () => _createHandler.HandleAsync(request, _tenantId, _profileId, CancellationToken.None);

        await act.Should().ThrowAsync<ValidationException>()
            .Where(ex => ex.Errors.ContainsKey("SubjectType"));
    }

    [Fact]
    public async Task CreateEntry_WhenEnteredOverrideWithoutReason_ThrowsValidationException()
    {
        var request = new CreateEntryLogRequest(
            EntryState: EntryStates.EnteredOverride,
            SubjectType: SubjectCategories.Visitor,
            SubjectName: "Bob",
            SubjectDocument: "123",
            PhotoId: null,
            OverrideReason: null);

        var act = () => _createHandler.HandleAsync(request, _tenantId, _profileId, CancellationToken.None);

        await act.Should().ThrowAsync<ValidationException>()
            .Where(ex => ex.Errors.ContainsKey("OverrideReason"));
    }

    [Fact]
    public async Task CreateEntry_WhenGatehouseOnly_ThrowsValidationException()
    {
        var request = new CreateEntryLogRequest(
            EntryState: "gatehouse_only",
            SubjectType: SubjectCategories.ServiceProvider,
            SubjectName: "Delivery",
            SubjectDocument: "999",
            PhotoId: null,
            OverrideReason: null);

        var act = () => _createHandler.HandleAsync(request, _tenantId, _profileId, CancellationToken.None);

        await act.Should().ThrowAsync<ValidationException>()
            .Where(ex => ex.Errors.ContainsKey("EntryState"));
    }

    [Theory]
    [InlineData(SubjectCategories.Dweller)]
    [InlineData(SubjectCategories.Vehicle)]
    public async Task CreateEntry_WhenResidentOrVehicleExits_Succeeds(string subjectType)
    {
        var request = new CreateEntryLogRequest(
            EntryState: EntryStates.Exited,
            SubjectType: subjectType,
            SubjectName: "Gatehouse subject",
            SubjectDocument: "123",
            PhotoId: null,
            OverrideReason: null);

        var response = await _createHandler.HandleAsync(request, _tenantId, _profileId, CancellationToken.None);

        response.EntryState.Should().Be(EntryStates.Exited);
        response.SubjectType.Should().Be(subjectType);
    }

    [Fact]
    public async Task CreateEntry_WhenVisitorExits_ThrowsValidationException()
    {
        var request = new CreateEntryLogRequest(
            EntryState: EntryStates.Exited,
            SubjectType: SubjectCategories.Visitor,
            SubjectName: "Visitor",
            SubjectDocument: "123",
            PhotoId: null,
            OverrideReason: null);

        var act = () => _createHandler.HandleAsync(request, _tenantId, _profileId, CancellationToken.None);

        await act.Should().ThrowAsync<ValidationException>()
            .Where(ex => ex.Errors.ContainsKey("SubjectType"));
    }

    [Fact]
    public async Task CreateEntry_WhenEnteredWithoutConsentAndPolicyRequiresPhoto_SucceedsWithoutPhoto()
    {
        var policy = new TenantConsentPolicy(Guid.NewGuid(), _tenantId, SubjectCategories.Visitor, photoRequired: true, null, null, DateTime.UtcNow);
        _policyRepo.FindByCategoryAsync(_tenantId, SubjectCategories.Visitor, Arg.Any<CancellationToken>()).Returns(policy);

        var request = new CreateEntryLogRequest(
            EntryState: EntryStates.EnteredWithoutConsent,
            SubjectType: SubjectCategories.Visitor,
            SubjectName: "Visitor Refused",
            SubjectDocument: "999",
            PhotoId: null,
            OverrideReason: null);

        var response = await _createHandler.HandleAsync(request, _tenantId, _profileId, CancellationToken.None);

        response.Should().NotBeNull();
        response.EntryState.Should().Be(EntryStates.EnteredWithoutConsent);
        response.PhotoId.Should().BeNull();
    }

    [Fact]
    public async Task CreateEntry_WhenEnteredWithoutConsentUsesPhotoFromAnotherTenant_ThrowsNotFoundException()
    {
        var photoId = Guid.NewGuid();
        var policy = new TenantConsentPolicy(Guid.NewGuid(), _tenantId, SubjectCategories.Visitor, photoRequired: true, null, null, DateTime.UtcNow);
        var photo = new Photo(photoId, Guid.NewGuid(), "path", null, "image/jpeg", 100, null, DateTime.UtcNow);
        _policyRepo.FindByCategoryAsync(_tenantId, SubjectCategories.Visitor, Arg.Any<CancellationToken>()).Returns(policy);
        _photoRepo.FindAsync(photoId, Arg.Any<CancellationToken>()).Returns(photo);

        var request = new CreateEntryLogRequest(
            EntryState: EntryStates.EnteredWithoutConsent,
            SubjectType: SubjectCategories.Visitor,
            SubjectName: "Visitor Refused",
            SubjectDocument: "999",
            PhotoId: photoId,
            OverrideReason: null);

        var act = () => _createHandler.HandleAsync(request, _tenantId, _profileId, CancellationToken.None);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task ListEntryLogs_DelegatesToRepositoryAndMapsResults()
    {
        var entry = new ConsentAuditLogEntry(
            id: Guid.NewGuid(),
            tenantId: _tenantId,
            entryState: EntryStates.EnteredWithoutConsent,
            overrideReason: null,
            photoId: null,
            subjectType: SubjectCategories.ServiceProvider,
            subjectName: "Tech",
            subjectDocument: "555",
            performedByProfileId: _profileId,
            recordedAt: DateTime.UtcNow);

        _auditLogRepo.ListAsync(EntryStates.EnteredWithoutConsent, null, null, null, 0, 10, Arg.Any<CancellationToken>())
            .Returns(new[] { entry });

        var results = await _listHandler.HandleAsync(EntryStates.EnteredWithoutConsent, null, null, null, 0, 10, CancellationToken.None);

        results.Should().ContainSingle();
        results[0].Id.Should().Be(entry.Id);
        results[0].SubjectName.Should().Be("Tech");
    }
}
