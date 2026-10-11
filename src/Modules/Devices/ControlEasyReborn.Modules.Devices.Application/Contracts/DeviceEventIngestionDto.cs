// Discriminated outcome for a single device-event ingestion. The result is
// projected to the wire as JSON with snake_case keys (Outcome +
// existing_event_id + visit_id + access_event_id + refused_scan_attempt_id
// + occurred_at_utc + processed_at_utc) so the Angular devices-api.service
// can deserialize it without a generated client.
public sealed record DeviceEventIngestionDto(
    string Outcome,
    Guid? ExistingEventId,
    Guid? VisitId,
    Guid? AccessEventId,
    Guid? RefusedScanAttemptId,
    DateTime OccurredAtUtc,
    DateTime ProcessedAtUtc);
