using System.Security.Cryptography;
using System.Text;
using ControlEasyReborn.Infrastructure.KeyDerivation;
using ControlEasyReborn.Modules.Devices.Infrastructure.Services;
using FluentAssertions;
using Xunit;

namespace ControlEasyReborn.UnitTests.Modules.Devices;

public sealed class DeviceConnectionCryptoServiceTests
{
    private static DeviceConnectionCryptoService CreateService()
    {
        // PerTenantKeyDeriver uses the master key from the env var (or the
        // dev default when unset). Build a deriver that always uses a fixed
        // deterministic master key so tests are reproducible.
        var master = Encoding.UTF8.GetBytes("CE-UNIT-TEST-MASTER-KEY-V1-DETERMINISTIC-32BYTES");
        var keyProvider = new FixedTenantMasterKeyProvider(master);
        var deriver = new PerTenantKeyDeriver(keyProvider);
        return new DeviceConnectionCryptoService(deriver);
    }

    [Fact]
    public void Encrypt_Decrypt_Roundtrip()
    {
        var tenantId = Guid.NewGuid();
        var service = CreateService();
        var plaintext = Encoding.UTF8.GetBytes("hello-device-conn-params-12345");

        var ciphertext = service.Encrypt(tenantId, plaintext);
        var decrypted = service.Decrypt(tenantId, ciphertext);

        decrypted.Should().Equal(plaintext);
    }

    [Fact]
    public void Encrypt_ForTenantA_DoesNotDecryptForTenantB()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var service = CreateService();
        var plaintext = Encoding.UTF8.GetBytes("connection-string-secret");

        var ciphertext = service.Encrypt(tenantA, plaintext);

        var act = () => service.Decrypt(tenantB, ciphertext);
        act.Should().Throw<CryptographicException>();
    }

    [Fact]
    public void Encrypt_DifferentIv_EachCall()
    {
        var tenantId = Guid.NewGuid();
        var service = CreateService();
        var plaintext = Encoding.UTF8.GetBytes("same-plaintext");

        var first = service.Encrypt(tenantId, plaintext);
        var second = service.Encrypt(tenantId, plaintext);

        first.Should().NotEqual(second);
    }

    [Fact]
    public void Decrypt_TamperedCiphertext_Throws()
    {
        var tenantId = Guid.NewGuid();
        var service = CreateService();
        var plaintext = Encoding.UTF8.GetBytes("authentic-payload");

        var ciphertext = service.Encrypt(tenantId, plaintext);

        // Flip a byte near the end (inside the ciphertext body, after the header).
        var tampered = (byte[])ciphertext.Clone();
        tampered[tampered.Length - 1] ^= 0x01;

        var act = () => service.Decrypt(tenantId, tampered);
        act.Should().Throw<CryptographicException>();
    }

    [Fact]
    public void Decrypt_ShortCiphertext_Throws()
    {
        var tenantId = Guid.NewGuid();
        var service = CreateService();

        var act = () => service.Decrypt(tenantId, new byte[5]);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Encrypt_EmptyPlaintext_Succeeds()
    {
        var tenantId = Guid.NewGuid();
        var service = CreateService();
        var plaintext = Array.Empty<byte>();

        var ciphertext = service.Encrypt(tenantId, plaintext);
        var decrypted = service.Decrypt(tenantId, ciphertext);

        decrypted.Should().BeEmpty();
    }

    private sealed class FixedTenantMasterKeyProvider : ITenantMasterKeyProvider
    {
        private readonly byte[] _key;
        public FixedTenantMasterKeyProvider(byte[] key) => _key = key;
        public byte[] GetMasterKey() => _key;
    }
}