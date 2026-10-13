using System.Text.Json;
using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;

namespace ControlEasyReborn.Modules.Devices.Application.Contracts;

// Strict direction extraction from a device-event payload_json.
//
// The canonical credential decision (RecordAccessScanHandler) needs a real
// Entrance/Exit direction: an absent or unknown value is a caller error and
// MUST NOT silently default to Entrance (spec: "never silently coerce to
// Entrance"). CardRead / CardDenied events carry "direction" inside the
// free-form payload_json — no schema change.
public static class DeviceEventPayloadDirection
{
    public const string PropertyName = "direction";

    public static bool TryParse(string? payloadJson, out CycleDirection direction)
    {
        direction = default;
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return false;
        }

        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            // Only an object can carry named properties — any other root
            // ([] / "x" / 123) must fail parsing gracefully as an invalid
            // direction so the caller gets a 400, not an InvalidOperationException → 500.
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
            {
                return false;
            }

            if (!doc.RootElement.TryGetProperty(PropertyName, out var element))
            {
                return false;
            }

            var raw = element.ValueKind == JsonValueKind.String ? element.GetString() : null;
            return CycleDirectionCodes.TryParse(raw, out direction);
        }
        catch (JsonException)
        {
            return false;
        }
    }

    public static string BuildPayloadJson(CycleDirection direction) =>
        JsonSerializer.Serialize(
            new Dictionary<string, string>(StringComparer.Ordinal)
            {
                [PropertyName] = CycleDirectionCodes.ToWire(direction)
            });
}