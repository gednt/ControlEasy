using ControlEasyReborn.Modules.Photos.Application.Abstractions;
using ControlEasyReborn.Modules.Photos.Application.Contracts;
using ControlEasyReborn.Modules.Photos.Application.Handlers;
using ControlEasyReborn.Modules.Photos.Domain.Entities;
using FluentAssertions;
using NSubstitute;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.Photos;

public sealed class EntryLogHandlersTests
{
    private readonly IConsentAuditLogRepository _auditLogRepo = Substitute.For<IConsentAuditLogRepository>();
    private readonly ListEntryLogsHandler _listHandler;
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _profileId = Guid.NewGuid();

    public EntryLogHandlersTests()
    {
        _listHandler = new ListEntryLogsHandler(_auditLogRepo);
    }

    [Fact]
    public async Task ListEntryLogs_MapsAllContractFields()
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
        results[0].EntryState.Should().Be(EntryStates.EnteredWithoutConsent);
        results[0].PerformedByProfileId.Should().Be(_profileId);
    }
}