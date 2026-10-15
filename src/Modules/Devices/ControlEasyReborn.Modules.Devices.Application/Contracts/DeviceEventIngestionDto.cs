// Discriminated outcome for a single device-event ingestion. The result is
// projected to the wire as JSON with camelCase keys (Outcome +
// existingEventId + visitId + accessEventId + refusedScanAttemptId
// + occurredAtUtc + processedAtUtc + failureCode) so the Angular
// devices-api.service can deserialize it without a generated client.
public sealed record DeviceEventIngestionDto(
    string Outcome,
    Guid? ExistingEventId,
    Guid? VisitId,
    Guid? AccessEventId,
    Guid? RefusedScanAttemptId,
    DateTime OccurredAtUtc,
    DateTime ProcessedAtUtc,
    // Canonical refusal code (e.g. invalid_credential) when the outcome is a
    // denial; null for accepted / lifecycle outcomes. Additive field.
    string? FailureCode = null);