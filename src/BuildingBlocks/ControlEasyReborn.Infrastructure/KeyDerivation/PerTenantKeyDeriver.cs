using System.Security.Cryptography;

namespace ControlEasyReborn.Infrastructure.KeyDerivation;

public interface ITenantMasterKeyProvider
{
    byte[] GetMasterKey();
}

// Per-tenant HKDF over the configured master key. Implementation uses
// System.Security.Cryptography.HKDF (added in .NET 8). Returns 32 bytes
// for the requested key derivation purpose.
public interface IPerTenantKeyDeriver
{
    byte[] DeriveKey(Guid tenantId, KeyDerivationPurpose purpose, int lengthBytes = 32);
}

public sealed class PerTenantKeyDeriver : IPerTenantKeyDeriver
{
    private readonly ITenantMasterKeyProvider _masterKeyProvider;

    public PerTenantKeyDeriver(ITenantMasterKeyProvider masterKeyProvider)
    {
        _masterKeyProvider = masterKeyProvider ?? throw new ArgumentNullException(nameof(masterKeyProvider));
    }

    public byte[] DeriveKey(Guid tenantId, KeyDerivationPurpose purpose, int lengthBytes = 32)
    {
        if (lengthBytes <= 0 || lengthBytes > 255)
            throw new ArgumentOutOfRangeException(nameof(lengthBytes), lengthBytes, "lengthBytes must be in (0,255].");

        var masterKey = _masterKeyProvider.GetMasterKey();
        var salt = tenantId.ToByteArray();
        var info = KeyDerivationPurposes.ToInfoBytes(purpose);

        var derived = new byte[lengthBytes];
        HKDF.DeriveKey(HashAlgorithmName.SHA256, masterKey, derived, salt, info);
        return derived;
    }
}