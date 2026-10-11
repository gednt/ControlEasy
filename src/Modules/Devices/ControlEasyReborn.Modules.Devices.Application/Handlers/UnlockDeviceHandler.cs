using System.Security.Cryptography;
using System.Text;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;
using ControlEasyReborn.Modules.Devices.Application.Contracts;
using ControlEasyReborn.Modules.Devices.Application.Logging;
using ControlEasyReborn.Modules.Devices.Domain.Entities;
using ControlEasyReborn.Modules.Devices.Domain.Enums;
using FluentValidation;
using Microsoft.Extensions.Logging;

namespace ControlEasyReborn.Modules.Devices.Application.Handlers;

// Heart of the DOOR-01/02/07 security bar:
//   1. Tenant opt-in flag check (404 if disabled).
//   2. Constant-time HMAC-SHA256 signature verification over a canonical
//      request line using the per-tenant derived key.
//   3. Timestamp window (±30s).
//   4. Nonce replay protection (5-minute TTL window).
//   5. Per-device rate limit (1 unlock per 3 seconds, 429 on exceed).
//   6. Device existence + IsActive check.
//   7. Delegated IDoorController.UnlockAsync (simulator or real driver).
//   8. Append-only audit row.
//
// Audit is written only on accepted signature + accepted rate-limit slot.
// 401/403/404 (tenant off, signature bad, expired ts, replayed nonce) skip audit.
public sealed class UnlockDeviceHandler
{
    public static readonly TimeSpan ReplayWindow = TimeSpan.FromSeconds(30);
    public static readonly TimeSpan NonceTtl = TimeSpan.FromSeconds(300);
    public static readonly TimeSpan RateLimitWindow = TimeSpan.FromSeconds(3);

    private readonly IDeviceRepository _devices;
    private readonly IDeviceUnlockAuditRepository _audits;
    private readonly IDeviceUnlockKeyProvider _keyProvider;
    private readonly IDeviceNonceCache _nonces;
    private readonly IDeviceUnlockRateLimiter _rateLimiter;
    private readonly IDoorController _doorController;
    private readonly IDoorSimulatorState _simulatorState;
    private readonly ITenantDoorIntegrationFlagLookup _tenantFlagLookup;
    private readonly IValidator<DoorUnlockRequest> _validator;
    private readonly ILogger<UnlockDeviceHandler> _logger;
    private readonly IGatehouseLookup _gatehouses;

    public UnlockDeviceHandler(
        IDeviceRepository devices,
        IDeviceUnlockAuditRepository audits,
        IDeviceUnlockKeyProvider keyProvider,
        IDeviceNonceCache nonces,
        IDeviceUnlockRateLimiter rateLimiter,
        IDoorController doorController,
        IDoorSimulatorState simulatorState,
        ITenantDoorIntegrationFlagLookup tenantFlagLookup,
        IValidator<DoorUnlockRequest> validator,
        IGatehouseLookup gatehouses,
        ILogger<UnlockDeviceHandler>? logger = null)
    {
        _devices = devices;
        _audits = audits;
        _keyProvider = keyProvider;
        _nonces = nonces;
        _rateLimiter = rateLimiter;
        _doorController = doorController;
        _simulatorState = simulatorState;
        _tenantFlagLookup = tenantFlagLookup;
        _validator = validator;
        _logger = logger ?? Microsoft.Extensions.Logging.Abstractions.NullLogger<UnlockDeviceHandler>.Instance;
        _gatehouses = gatehouses;
    }

    public async Task<DoorUnlockResult> HandleAsync(
        Guid tenantId,
        Guid deviceId,
        Guid actorProfileId,
        DoorUnlockRequest request,
        CancellationToken ct)
    {
        var validation = await _validator.ValidateAsync(request, ct);
        if (!validation.IsValid)
        {
            throw new Application.Errors.ValidationException(validation.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()));
        }

        // 1. Tenant opt-in flag (404 hides the feature).
        var flagEnabled = await _tenantFlagLookup.IsEnabledAsync(tenantId, ct);
        if (!flagEnabled)
        {
            using var _ = DeviceLoggingProperties.BeginScope(tenantId, deviceId, actorProfileId, outcome: "tenant_flag_off");
            return new DoorUnlockResult(
                DoorUnlockResultKind.UnknownTenantFlag,
                CorrelationId: Guid.NewGuid(),
                OccurredAtUtc: DateTime.UtcNow,
                FailureCode: "tenant_door_integration_disabled",
                FailureDetail: "Door integration is not enabled for this tenant.");
        }

        // 2. Per-tenant HMAC key + canonical signature verification.
        var key = await _keyProvider.GetKeyForAsync(tenantId, ct);
        var expectedSignature = ComputeCanonicalSignature(
            key: key,
            deviceId: deviceId,
            timestampUtc: request.TimestampUtc.ToUniversalTime(),
            nonceBase64Url: request.Nonce,
            bodyHashHex: request.BodyHash.ToLowerInvariant());

        byte[] expectedBytes;
        byte[] receivedBytes;
        try
        {
            expectedBytes = Base64UrlDecode(expectedSignature);
            receivedBytes = Base64UrlDecode(request.Signature);
        }
        catch
        {
            using var _ = DeviceLoggingProperties.BeginScope(tenantId, deviceId, actorProfileId, outcome: "auth_failed");
            return AuthFailedResult("signature_invalid");
        }

        if (expectedBytes.Length != receivedBytes.Length ||
            !CryptographicOperations.FixedTimeEquals(expectedBytes, receivedBytes))
        {
            using var _ = DeviceLoggingProperties.BeginScope(tenantId, deviceId, actorProfileId, outcome: "auth_failed");
            return AuthFailedResult("signature_invalid");
        }

        // 3. Replay window: ±30s from server now.
        var nowUtc = DateTime.UtcNow;
        var skew = (request.TimestampUtc.ToUniversalTime() - nowUtc);
        if (skew < TimeSpan.Zero) skew = -skew;
        if (skew > ReplayWindow)
        {
            using var _ = DeviceLoggingProperties.BeginScope(tenantId, deviceId, actorProfileId, outcome: "auth_failed");
            return AuthFailedResult("replay_window_exceeded");
        }

        // 4. Nonce replay protection.
        var nonceOk = await _nonces.TryConsumeAsync(tenantId, deviceId, request.Nonce, NonceTtl, ct);
        if (!nonceOk)
        {
            using var _ = DeviceLoggingProperties.BeginScope(tenantId, deviceId, actorProfileId, outcome: "auth_failed");
            return AuthFailedResult("nonce_replayed");
        }

        // 5. Rate limit.
        var rateOk = await _rateLimiter.TryAcquireAsync(tenantId, deviceId, RateLimitWindow, ct);
        if (!rateOk)
        {
            var correlationId = Guid.NewGuid();
            await SafeWriteAuditAsync(
                tenantId, deviceId, actorProfileId, request,
                DoorUnlockOutcome.RateLimited, correlationId, nowUtc, ct);
            using var _ = DeviceLoggingProperties.BeginScope(tenantId, deviceId, actorProfileId, correlationId, outcome: "rate_limited");
            return new DoorUnlockResult(
                DoorUnlockResultKind.RateLimited,
                CorrelationId: correlationId,
                OccurredAtUtc: nowUtc,
                FailureCode: "unlock_rate_limited",
                FailureDetail: "Too many unlock attempts for this device.");
        }

        // 6. Device existence + IsActive.
        var device = await _devices.GetByIdAsync(tenantId, deviceId, ct);
        if (device is null)
        {
            var correlationId = Guid.NewGuid();
            using var _ = DeviceLoggingProperties.BeginScope(tenantId, deviceId, actorProfileId, correlationId, outcome: "unknown_device");
            return new DoorUnlockResult(
                DoorUnlockResultKind.UnknownDevice,
                CorrelationId: correlationId,
                OccurredAtUtc: nowUtc,
                FailureCode: "device_not_found");
        }
        if (!device.IsActive)
        {
            var correlationId = Guid.NewGuid();
            using var _ = DeviceLoggingProperties.BeginScope(tenantId, deviceId, actorProfileId, correlationId, outcome: "device_inactive");
            return new DoorUnlockResult(
                DoorUnlockResultKind.DeviceInactive,
                CorrelationId: correlationId,
                OccurredAtUtc: nowUtc,
                FailureCode: "device_inactive");
        }
        if (device.GatehouseId.HasValue &&
            !await _gatehouses.IsActiveAsync(tenantId, device.GatehouseId.Value, ct))
        {
            var correlationId = Guid.NewGuid();
            using var _ = DeviceLoggingProperties.BeginScope(tenantId, deviceId, actorProfileId, correlationId, outcome: "gatehouse_inactive");
            return new DoorUnlockResult(
                DoorUnlockResultKind.DeviceInactive,
                CorrelationId: correlationId,
                OccurredAtUtc: nowUtc,
                FailureCode: "gatehouse_inactive",
                FailureDetail: "The device gatehouse is inactive.");
        }

        // 7. Delegate to IDoorController (simulated or real driver).
        var nonceGuid = TryParseNonceToGuid(request.Nonce);
        var command = new DoorUnlockCommand(
            NonceBase64Url: request.Nonce,
            TimestampUtc: request.TimestampUtc,
            SignatureBase64Url: request.Signature,
            BodyHashHex: request.BodyHash.ToLowerInvariant(),
            ActorProfileId: actorProfileId);

        var result = await _doorController.UnlockAsync(tenantId, deviceId, command, ct);

        // 8. Append-only audit row.
        var outcomeEnum = (DoorUnlockOutcome)(int)result.Outcome;
        await SafeWriteAuditAsync(
            tenantId, deviceId, actorProfileId, request,
            outcomeEnum, result.CorrelationId, result.OccurredAtUtc, ct);

        using (DeviceLoggingProperties.BeginScope(tenantId, deviceId, actorProfileId, result.CorrelationId,
                   outcome: outcomeEnum.ToString()))
        {
            _logger.LogInformation(
                "device.unlock resolved outcome {Outcome} for device {DeviceId} (correlation {CorrelationId}).",
                outcomeEnum, deviceId, result.CorrelationId);
        }

        return result;
    }

    private async Task SafeWriteAuditAsync(
        Guid tenantId,
        Guid deviceId,
        Guid actorProfileId,
        DoorUnlockRequest request,
        DoorUnlockOutcome outcome,
        Guid correlationId,
        DateTime occurredAtUtc,
        CancellationToken ct)
    {
        var commandHash = ComputeCommandHash(
            deviceId, request.TimestampUtc.ToUniversalTime(), request.Nonce, request.BodyHash);

        var nonceGuid = TryParseNonceToGuid(request.Nonce);

        var audit = new DeviceUnlockAudit(
            id: Guid.NewGuid(),
            tenantId: tenantId,
            deviceId: deviceId,
            actorProfileId: actorProfileId,
            commandHash: commandHash,
            occurredAtUtc: occurredAtUtc,
            responseOutcome: outcome,
            commandNonce: nonceGuid == Guid.Empty ? Guid.NewGuid() : nonceGuid,
            correlationId: correlationId);

        try
        {
            await _audits.InsertAsync(audit, ct);
        }
        catch (Exception ex)
        {
            // Audit failures must never block the unlock decision. Log and
            // continue — operational dashboards will surface the gap.
            _logger.LogError(ex,
                "device.unlock audit insert failed (correlation {CorrelationId}).",
                correlationId);
        }
    }

    private static DoorUnlockResult AuthFailedResult(string failureCode) =>
        new(
            DoorUnlockResultKind.AuthFailed,
            CorrelationId: Guid.NewGuid(),
            OccurredAtUtc: DateTime.UtcNow,
            FailureCode: failureCode);

    private static string ComputeCanonicalSignature(
        byte[] key,
        Guid deviceId,
        DateTime timestampUtc,
        string nonceBase64Url,
        string bodyHashHex)
    {
        // Canonical line:
        //   POST\n{deviceId}\n{timestampIso8601Utc}\n{nonceBase64Url}\n{bodyHashHexLower}
        var canonical = new StringBuilder(256);
        canonical.Append("POST\n");
        canonical.Append(deviceId.ToString("D"));
        canonical.Append('\n');
        canonical.Append(timestampUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"));
        canonical.Append('\n');
        canonical.Append(nonceBase64Url);
        canonical.Append('\n');
        canonical.Append(bodyHashHex);

        using var hmac = new HMACSHA256(key);
        var bytes = Encoding.UTF8.GetBytes(canonical.ToString());
        var digest = hmac.ComputeHash(bytes);
        return Convert.ToBase64String(digest)
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static string ComputeCommandHash(
        Guid deviceId,
        DateTime timestampUtc,
        string nonceBase64Url,
        string bodyHashHex)
    {
        var canonical = new StringBuilder(256);
        canonical.Append("POST\n");
        canonical.Append(deviceId.ToString("D"));
        canonical.Append('\n');
        canonical.Append(timestampUtc.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"));
        canonical.Append('\n');
        canonical.Append(nonceBase64Url);
        canonical.Append('\n');
        canonical.Append(bodyHashHex);

        using var sha = SHA256.Create();
        var bytes = Encoding.UTF8.GetBytes(canonical.ToString());
        var digest = sha.ComputeHash(bytes);

        var hex = new StringBuilder(64);
        foreach (var b in digest) hex.Append(b.ToString("x2"));
        return hex.ToString();
    }

    private static byte[] Base64UrlDecode(string value)
    {
        var normalized = value.Replace('-', '+').Replace('_', '/');
        switch (normalized.Length % 4)
        {
            case 2: normalized += "=="; break;
            case 3: normalized += "="; break;
        }
        return Convert.FromBase64String(normalized);
    }

    private static Guid TryParseNonceToGuid(string nonceBase64Url)
    {
        try
        {
            var bytes = Base64UrlDecode(nonceBase64Url);
            if (bytes.Length < 16) return Guid.Empty;
            Span<byte> guidBytes = stackalloc byte[16];
            bytes.AsSpan(0, 16).CopyTo(guidBytes);
            return new Guid(guidBytes);
        }
        catch
        {
            return Guid.Empty;
        }
    }
}

// Read-only flag lookup — implementation reads from the Tenants table.
// Lives in Application/Abstractions so the handler does not depend on a
// concrete repository for cross-module reads.
public interface ITenantDoorIntegrationFlagLookup
{
    Task<bool> IsEnabledAsync(Guid tenantId, CancellationToken ct);
}
