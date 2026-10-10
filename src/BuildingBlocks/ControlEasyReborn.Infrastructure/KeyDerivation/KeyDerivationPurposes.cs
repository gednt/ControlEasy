using System.Text;

namespace ControlEasyReborn.Infrastructure.KeyDerivation;

// Centralized enum of all per-purpose key derivation constants used across
// the codebase. Adding a new module that needs a derived key MUST add a
// constant here — do not introduce parallel key schemes.
public enum KeyDerivationPurpose
{
    AccessControlHmacV1 = 0,
    DoorUnlockV1 = 1,
    DoorConnectionParamsV1 = 2
}

public static class KeyDerivationPurposes
{
    public const KeyDerivationPurpose ACCESS_CONTROL_HMAC_V1 = KeyDerivationPurpose.AccessControlHmacV1;
    public const KeyDerivationPurpose DOOR_UNLOCK_V1 = KeyDerivationPurpose.DoorUnlockV1;
    public const KeyDerivationPurpose DOOR_CONNECTION_PARAMS_V1 = KeyDerivationPurpose.DoorConnectionParamsV1;

    public static byte[] ToInfoBytes(KeyDerivationPurpose purpose)
    {
        var s = purpose switch
        {
            KeyDerivationPurpose.AccessControlHmacV1 => "ACCESS_CONTROL_HMAC_V1",
            KeyDerivationPurpose.DoorUnlockV1 => "DOOR_UNLOCK_V1",
            KeyDerivationPurpose.DoorConnectionParamsV1 => "DOOR_CONNECTION_PARAMS_V1",
            _ => throw new ArgumentOutOfRangeException(nameof(purpose), purpose, "Unknown key derivation purpose.")
        };
        return Encoding.UTF8.GetBytes(s);
    }
}