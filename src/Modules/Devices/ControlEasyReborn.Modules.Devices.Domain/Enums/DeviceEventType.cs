// Vendor-agnostic reader-event types. Phase 25 ingests CardRead + CardDenied
// + Tamper + DoorForced + ReaderReconnected. Heartbeat is reserved for
// Phase 26 (Phase 25's handler rejects Heartbeat events with 400 BadRequest).
namespace ControlEasyReborn.Modules.Devices.Domain.Enums;

public enum DeviceEventType
{
    CardRead = 0,
    CardDenied = 1,
    Tamper = 2,
    DoorForced = 3,
    ReaderReconnected = 4,
    Heartbeat = 5
}

public static class DeviceEventTypeCodes
{
    public const string CardRead = "card_read";
    public const string CardDenied = "card_denied";
    public const string Tamper = "tamper";
    public const string DoorForced = "door_forced";
    public const string ReaderReconnected = "reader_reconnected";
    public const string Heartbeat = "heartbeat";

    public static readonly IReadOnlyDictionary<string, DeviceEventType> ParseTable = new Dictionary<string, DeviceEventType>(StringComparer.OrdinalIgnoreCase)
    {
        [CardRead] = DeviceEventType.CardRead,
        [CardDenied] = DeviceEventType.CardDenied,
        [Tamper] = DeviceEventType.Tamper,
        [DoorForced] = DeviceEventType.DoorForced,
        [ReaderReconnected] = DeviceEventType.ReaderReconnected,
        [Heartbeat] = DeviceEventType.Heartbeat
    };

    public static string ToWire(DeviceEventType type) => type switch
    {
        DeviceEventType.CardRead => CardRead,
        DeviceEventType.CardDenied => CardDenied,
        DeviceEventType.Tamper => Tamper,
        DeviceEventType.DoorForced => DoorForced,
        DeviceEventType.ReaderReconnected => ReaderReconnected,
        DeviceEventType.Heartbeat => Heartbeat,
        _ => "unknown"
    };

    public static bool TryParse(string? value, out DeviceEventType type)
    {
        if (!string.IsNullOrWhiteSpace(value) && ParseTable.TryGetValue(value, out type))
        {
            return true;
        }
        type = DeviceEventType.CardRead;
        return false;
    }
}
