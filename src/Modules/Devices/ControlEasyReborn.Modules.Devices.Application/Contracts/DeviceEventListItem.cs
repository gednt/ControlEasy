// Admin list endpoint projection of one device_events row. Does NOT include
// payload_json (size + may contain vendor PII). For full payload retrieval
// the support endpoints fetch the row directly and the access is
// audit-logged.
public sealed record DeviceEventListItem(
    Guid Id,
    Guid DeviceId,
    string EventType,
    DateTime OccurredAtUtc,
    DateTime ProcessedAtUtc,
    long SequenceNumber,
    string ResultCode,
    string? FailureCode,
    Guid? VisitId,
    Guid? AccessEventId,
    Guid? RefusedScanAttemptId);
