using System.Globalization;
using System.Text;
using ControlEasyReborn.Modules.Photos.Application.Abstractions;
using ControlEasyReborn.Modules.Photos.Application.Contracts;
using ControlEasyReborn.Modules.Photos.Domain.Entities;

namespace ControlEasyReborn.Modules.Photos.Application.Handlers;

public sealed class ExportEntryLogCsvHandler
{
    private readonly IConsentAuditLogRepository _auditLog;

    public ExportEntryLogCsvHandler(IConsentAuditLogRepository auditLog)
    {
        _auditLog = auditLog;
    }

    public async Task<string> HandleAsync(string? entryState, string? subjectType, DateTime? fromUtc, DateTime? toUtc, Guid? porteiro, CancellationToken ct)
    {
        var entries = await _auditLog.ListAsync(entryState, subjectType, fromUtc, toUtc, porteiro, 0, int.MaxValue, ct);

        var sb = new StringBuilder();
        sb.AppendLine("id,entry_state,override_reason,photo_id,subject_type,subject_name,subject_document,performed_by_profile_id,recorded_at");

        foreach (var e in entries)
        {
            sb.Append(Escape(e.Id.ToString())).Append(',');
            sb.Append(Escape(e.EntryState)).Append(',');
            sb.Append(Escape(e.OverrideReason)).Append(',');
            sb.Append(Escape(e.PhotoId?.ToString())).Append(',');
            sb.Append(Escape(e.SubjectType)).Append(',');
            sb.Append(Escape(e.SubjectName)).Append(',');
            sb.Append(Escape(e.SubjectDocument)).Append(',');
            sb.Append(Escape(e.PerformedByProfileId?.ToString())).Append(',');
            sb.Append(Escape(e.RecordedAt.ToString("yyyy-MM-dd HH:mm:ss.fff", CultureInfo.InvariantCulture)));
            sb.AppendLine();
        }

        return sb.ToString();
    }

    private static string Escape(string? value)
    {
        if (string.IsNullOrEmpty(value))
            return string.Empty;
        if (value.Contains(',') || value.Contains('"') || value.Contains('\n') || value.Contains('\r'))
            return "\"" + value.Replace("\"", "\"\"") + "\"";
        return value;
    }
}