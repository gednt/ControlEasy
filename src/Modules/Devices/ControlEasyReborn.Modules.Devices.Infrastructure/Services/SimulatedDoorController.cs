using ControlEasyReborn.Modules.Devices.Application.Abstractions;

namespace ControlEasyReborn.Modules.Devices.Infrastructure.Services;

public sealed class SimulatedDoorController : IDoorController
{
    private readonly DoorSimulatorState _state;

    public SimulatedDoorController(DoorSimulatorState state)
    {
        _state = state;
    }

    public Task<DoorUnlockResult> UnlockAsync(Guid tenantId, Guid deviceId, DoorUnlockCommand command, CancellationToken ct)
    {
        var nowUtc = DateTime.UtcNow;
        var correlationId = Guid.NewGuid();

        var outcome = _state.ResolveOutcome(deviceId, nowUtc) ?? nameof(DoorUnlockResultKind.Success);
        var resultKind = Enum.TryParse<DoorUnlockResultKind>(outcome, out var parsed)
            ? parsed
            : DoorUnlockResultKind.Success;

        _state.RecordAttempt(
            tenantId, deviceId, command.ActorProfileId, command.NonceGuid(),
            command.TimestampUtc, outcome, correlationId, nowUtc);

        return Task.FromResult(new DoorUnlockResult(resultKind, correlationId, nowUtc));
    }
}

internal static class DoorUnlockCommandExtensions
{
    internal static Guid NonceGuid(this DoorUnlockCommand command)
    {
        try
        {
            var normalized = command.NonceBase64Url.Replace('-', '+').Replace('_', '/');
            switch (normalized.Length % 4)
            {
                case 2: normalized += "=="; break;
                case 3: normalized += "="; break;
            }
            var bytes = Convert.FromBase64String(normalized);
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