namespace ControlEasyReborn.Modules.Devices.Application.Contracts;

// Register a new device (DOOR-06). DeviceType is one of "reader"/"controller";
// vendor is normalized server-side (lowercased). connectionParams is the raw
// JSON object the admin entered — the handler encrypts it via
// IDeviceConnectionCryptoService before persistence; the value is NEVER
// returned in any response payload (see DeviceDetail.RedactedConnectionParams).
public sealed record RegisterDeviceRequest(
    string DeviceType,
    string Vendor,
    Guid? GatehouseId,
    System.Collections.Generic.IDictionary<string, object>? ConnectionParams);