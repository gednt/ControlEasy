namespace ControlEasyReborn.Modules.Devices.Application.Abstractions;

// AES-256-GCM per-tenant encryption of device connection params. Plaintext is
// never persisted in the devices table — only the encrypted blob. Ciphertext
// format: version(1) || iv(12) || tag(16) || ciphertext(N).
public interface IDeviceConnectionCryptoService
{
    byte[] Encrypt(Guid tenantId, ReadOnlySpan<byte> plaintext);
    byte[] Decrypt(Guid tenantId, ReadOnlySpan<byte> ciphertext);
}