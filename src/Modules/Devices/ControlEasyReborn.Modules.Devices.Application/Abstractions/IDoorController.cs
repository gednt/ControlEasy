namespace ControlEasyReborn.Modules.Devices.Application.Abstractions;

// Command payload sent down to the in-process or external door controller.
// BodyHashHex is the SHA-256 hex of the canonical request body used by the
// HMAC signing scheme. The signature covers:
//   POST\n{deviceId}\n{timestampUtc}\n{nonceBase64Url}\n{bodyHashHex}
public sealed record DoorUnlockCommand(
    string NonceBase64Url,
    DateTime TimestampUtc,
    string SignatureBase64Url,
    string BodyHashHex,
    Guid ActorProfileId);

public enum DoorUnlockResultKind
{
    Success = 0,
    DeviceOffline = 1,
    AuthFailed = 2,
    RateLimited = 3,
    UnknownTenantFlag = 4,
    UnknownDevice = 5,
    DeviceInactive = 6
}

public sealed record DoorUnlockResult(
    DoorUnlockResultKind Outcome,
    Guid CorrelationId,
    DateTime OccurredAtUtc,
    string? FailureCode = null,
    string? FailureDetail = null);

public interface IDoorController
{
    Task<DoorUnlockResult> UnlockAsync(Guid tenantId, Guid deviceId, DoorUnlockCommand command, CancellationToken ct);
}