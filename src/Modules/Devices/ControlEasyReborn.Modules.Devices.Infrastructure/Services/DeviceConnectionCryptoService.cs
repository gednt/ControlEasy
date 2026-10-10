using System.Collections.Concurrent;
using System.Security.Cryptography;
using ControlEasyReborn.Infrastructure.KeyDerivation;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;

namespace ControlEasyReborn.Modules.Devices.Infrastructure.Services;

// AES-256-GCM per-tenant encryption of device connection params.
// Ciphertext format: version(1) || iv(12) || tag(16) || ciphertext(N).
// version byte allows future algorithm migrations (currently always 0x01).
// Per-tenant key derived via HKDF with KeyDerivationPurpose.DoorConnectionParamsV1.
public sealed class DeviceConnectionCryptoService : IDeviceConnectionCryptoService
{
    private const byte FormatVersion = 0x01;
    private const int IvLength = 12;
    private const int TagLength = 16;
    private const int HeaderLength = 1 + IvLength + TagLength;

    private readonly IPerTenantKeyDeriver _deriver;
    private readonly ConcurrentDictionary<Guid, byte[]> _keyCache = new();
    private readonly object _cacheLock = new();
    private DateTime _cacheStamp = DateTime.UtcNow;
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(1);

    public DeviceConnectionCryptoService(IPerTenantKeyDeriver deriver)
    {
        _deriver = deriver;
    }

    public byte[] Encrypt(Guid tenantId, ReadOnlySpan<byte> plaintext)
    {
        var key = GetOrDeriveKey(tenantId);
        var iv = RandomNumberGenerator.GetBytes(IvLength);
        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[TagLength];

        using var aes = new AesGcm(key, TagLength);
        aes.Encrypt(iv, plaintext, ciphertext, tag);

        var output = new byte[HeaderLength + ciphertext.Length];
        output[0] = FormatVersion;
        Buffer.BlockCopy(iv, 0, output, 1, IvLength);
        Buffer.BlockCopy(tag, 0, output, 1 + IvLength, TagLength);
        Buffer.BlockCopy(ciphertext, 0, output, HeaderLength, ciphertext.Length);
        return output;
    }

    public byte[] Decrypt(Guid tenantId, ReadOnlySpan<byte> ciphertext)
    {
        if (ciphertext.Length < HeaderLength)
            throw new ArgumentException("Ciphertext is too short.", nameof(ciphertext));
        if (ciphertext[0] != FormatVersion)
            throw new CryptographicException($"Unsupported ciphertext format version: {ciphertext[0]}.");

        var key = GetOrDeriveKey(tenantId);
        var iv = ciphertext.Slice(1, IvLength);
        var tag = ciphertext.Slice(1 + IvLength, TagLength);
        var body = ciphertext.Slice(HeaderLength);

        var plaintext = new byte[body.Length];
        try
        {
            using var aes = new AesGcm(key, TagLength);
            aes.Decrypt(iv, body, tag, plaintext);
        }
        catch (CryptographicException)
        {
            // Constant-time failure: caller MUST treat decryption failures as
            // auth failures (tampered ciphertext or wrong tenant key).
            throw;
        }
        return plaintext;
    }

    private byte[] GetOrDeriveKey(Guid tenantId)
    {
        EvictIfExpired();

        if (_keyCache.TryGetValue(tenantId, out var cached))
            return cached;

        lock (_cacheLock)
        {
            if (_keyCache.TryGetValue(tenantId, out cached))
                return cached;

            cached = _deriver.DeriveKey(tenantId, KeyDerivationPurpose.DoorConnectionParamsV1);
            _keyCache[tenantId] = cached;
            return cached;
        }
    }

    private void EvictIfExpired()
    {
        if (DateTime.UtcNow - _cacheStamp < CacheTtl) return;
        lock (_cacheLock)
        {
            if (DateTime.UtcNow - _cacheStamp < CacheTtl) return;
            _keyCache.Clear();
            _cacheStamp = DateTime.UtcNow;
        }
    }
}