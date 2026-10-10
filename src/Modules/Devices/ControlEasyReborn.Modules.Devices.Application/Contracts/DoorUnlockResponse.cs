namespace ControlEasyReborn.Modules.Devices.Application.Contracts;

public sealed record DoorUnlockResponse(
    Guid DeviceId,
    string Outcome,
    DateTime OccurredAtUtc,
    Guid CorrelationId);