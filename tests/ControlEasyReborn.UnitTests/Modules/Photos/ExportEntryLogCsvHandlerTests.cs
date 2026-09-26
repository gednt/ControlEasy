using ControlEasyReborn.Modules.Photos.Application.Abstractions;
using ControlEasyReborn.Modules.Photos.Application.Handlers;
using ControlEasyReborn.Modules.Photos.Domain.Entities;
using FluentAssertions;
using NSubstitute;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.Photos;

public sealed class ExportEntryLogCsvHandlerTests
{
    private readonly IConsentAuditLogRepository _auditLogRepo = Substitute.For<IConsentAuditLogRepository>();
    private readonly ExportEntryLogCsvHandler _sut;
    private readonly Guid _tenantId = Guid.NewGuid();

    public ExportEntryLogCsvHandlerTests()
    {
        _sut = new ExportEntryLogCsvHandler(_auditLogRepo);
    }

    [Fact]
    public async Task HandleAsync_WhenEntriesExist_ReturnsCsvWithMillisecondPrecisionAndEscaping()
    {
        var recordedAt = new DateTime(2026, 9, 12, 14, 30, 45, 123, DateTimeKind.Utc);
        var entryId = Guid.NewGuid();
        var photoId = Guid.NewGuid();
        var profileId = Guid.NewGuid();

        var entry = new ConsentAuditLogEntry(
            id: entryId,
            tenantId: _tenantId,
            entryState: EntryStates.EnteredWithConsent,
            overrideReason: null,
            photoId: photoId,
            subjectType: SubjectCategories.Visitor,
            subjectName: "Doe, John \"The Builder\"",
            subjectDocument: "12345",
            performedByProfileId: profileId,
            recordedAt: recordedAt);

        _auditLogRepo.ListAsync(null, null, null, null, null, 0, int.MaxValue, Arg.Any<CancellationToken>())
            .Returns(new[] { entry });

        var csv = await _sut.HandleAsync(null, null, null, null, null, CancellationToken.None);

        csv.Should().NotBeNullOrEmpty();
        var lines = csv.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries);
        lines.Should().HaveCount(2);

        lines[0].Should().Be("id,entry_state,override_reason,photo_id,subject_type,subject_name,subject_document,performed_by_profile_id,recorded_at");

        var dataLine = lines[1];
        dataLine.Should().Contain(entryId.ToString());
        dataLine.Should().Contain(EntryStates.EnteredWithConsent);
        dataLine.Should().Contain(photoId.ToString());
        dataLine.Should().Contain("\"Doe, John \"\"The Builder\"\"\"");
        dataLine.Should().Contain("2026-09-12 14:30:45.123");
    }

    [Fact]
    public async Task HandleAsync_WhenNoEntriesExist_ReturnsHeaderOnlyCsv()
    {
        _auditLogRepo.ListAsync(null, null, null, null, null, 0, int.MaxValue, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<ConsentAuditLogEntry>());

        var csv = await _sut.HandleAsync(null, null, null, null, null, CancellationToken.None);

        var lines = csv.Split(new[] { "\r\n", "\n" }, StringSplitOptions.RemoveEmptyEntries);
        lines.Should().HaveCount(1);
        lines[0].Should().Be("id,entry_state,override_reason,photo_id,subject_type,subject_name,subject_document,performed_by_profile_id,recorded_at");
    }
}
