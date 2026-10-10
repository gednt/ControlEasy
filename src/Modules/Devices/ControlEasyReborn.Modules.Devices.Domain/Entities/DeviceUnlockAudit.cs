using ControlEasyReborn.Modules.Devices.Domain.Enums;

namespace ControlEasyReborn.Modules.Devices.Domain.Entities;

// Append-only audit row. NO Update / Delete methods exist by design (matches the
// DB BEFORE UPDATE / BEFORE DELETE triggers that reject mutation at MySQL layer).
public sealed class DeviceUnlockAudit
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid DeviceId { get; private set; }
    public Guid ActorProfileId { get; private set; }
    public string CommandHash { get; private set; } = string.Empty;
    public DateTime OccurredAtUtc { get; private set; }
    public DoorUnlockOutcome ResponseOutcome { get; private set; }
    public Guid CommandNonce { get; private set; }
    public Guid CorrelationId { get; private set; }

    private DeviceUnlockAudit() { }

    public DeviceUnlockAudit(
        Guid id,
        Guid tenantId,
        Guid deviceId,
        Guid actorProfileId,
        string commandHash,
        DateTime occurredAtUtc,
        DoorUnlockOutcome responseOutcome,
        Guid commandNonce,
        Guid correlationId)
    {
        if (id == Guid.Empty) throw new InvalidOperationException("Audit id is required.");
        if (tenantId == Guid.Empty) throw new InvalidOperationException("Tenant id is required.");
        if (deviceId == Guid.Empty) throw new InvalidOperationException("Device id is required.");
        if (actorProfileId == Guid.Empty) throw new InvalidOperationException("Actor profile id is required.");
        if (string.IsNullOrWhiteSpace(commandHash)) throw new InvalidOperationException("Command hash is required.");
        if (commandNonce == Guid.Empty) throw new InvalidOperationException("Command nonce is required.");
        if (correlationId == Guid.Empty) throw new InvalidOperationException("Correlation id is required.");

        Id = id;
        TenantId = tenantId;
        DeviceId = deviceId;
        ActorProfileId = actorProfileId;
        CommandHash = commandHash;
        OccurredAtUtc = occurredAtUtc;
        ResponseOutcome = responseOutcome;
        CommandNonce = commandNonce;
        CorrelationId = correlationId;
    }
}