namespace ControlEasyReborn.Modules.Devices.Application.Contracts;

public sealed record DoorUnlockRequest(
    string Nonce,
    DateTime TimestampUtc,
    string Signature,
    string BodyHash);