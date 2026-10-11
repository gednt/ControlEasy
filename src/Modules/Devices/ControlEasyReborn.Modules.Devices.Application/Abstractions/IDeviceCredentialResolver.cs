namespace ControlEasyReborn.Modules.Devices.Application.Abstractions;

// Resolves an opaque token presented by a reader device at a registered
// door to the matching AccessCredentials row + destination apartment /
// block / unit (DOOR-10). The default implementation hashes the opaque
// token (SHA-256) and looks it up via the existing
// IAccessCredentialRepository — token formats are tenant-scoped so the
// lookup naturally filters by tenant_id.
//
// Returns null when the token is a synthetic simulator prefix (the
// SimulatedDeviceHandler shortcut) or when no credential matches.
public interface IDeviceCredentialResolver
{
    Task<CredentialMatch?> ResolveAsync(Guid tenantId, string? opaqueToken, CancellationToken ct);
}

public sealed record CredentialMatch(
    Guid CredentialId,
    Guid TenantId,
    string SubjectType,
    Guid SubjectId,
    Guid? DestinationApartmentId,
    string DestinationBlock,
    string DestinationUnit,
    bool IsActive,
    DateTime ValidFromUtc,
    DateTime? ExpiresAtUtc,
    bool IsUsableNow);
