using ControlEasyReborn.Modules.AccessControl.Application.Abstractions;
using ControlEasyReborn.Modules.AccessControl.Domain.Entities;
using ControlEasyReborn.Modules.AccessControl.Infrastructure.Services;

namespace ControlEasyReborn.Modules.AccessControl.Infrastructure.Persistence;

public sealed class AccessControlCryptoService : IAccessControlCryptoService
{
    private readonly IOpaqueTokenIssuer _issuer;
    private readonly IAccessCredentialRepository _credentials;
    private readonly byte[] _hmacKey;

    public AccessControlCryptoService(IOpaqueTokenIssuer issuer, IAccessCredentialRepository credentials, AccessControlHmacKeyProvider keyProvider)
    {
        _issuer = issuer;
        _credentials = credentials;
        _hmacKey = keyProvider.Key;
    }

    public async Task<AccessCredential?> ResolveByTokenAsync(Guid tenantId, string qrPayload, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(qrPayload)) return null;

        var candidates = await _credentials.ListAllAsync(tenantId, ct);

        // 1. Direct UUID resolution (by Credential ID or Subject ID)
        if (Guid.TryParse(qrPayload.Trim(), out var uuid))
        {
            var match = candidates
                .Where(c => c.Status == Domain.ValueObjects.CredentialStatus.Active && (c.Id == uuid || c.SubjectId == uuid))
                .FirstOrDefault()
                ?? candidates.FirstOrDefault(c => c.Id == uuid || c.SubjectId == uuid);

            if (match is not null)
            {
                return match;
            }
        }

        // 2. Cryptographic token HMAC verification
        foreach (var candidate in candidates)
        {
            if (_issuer.Verify(qrPayload, candidate.SecretVerifier, candidate.KeyVersion, _hmacKey))
            {
                return candidate;
            }
        }
        return null;
    }
}