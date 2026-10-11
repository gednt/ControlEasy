using ControlEasyReborn.Modules.AccessControl.Domain.Entities;
using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;

namespace ControlEasyReborn.Modules.AccessControl.Application.Abstractions;

public interface IAccessCredentialRepository
{
    Task<AccessCredential?> FindActiveAsync(Guid tenantId, SubjectType subjectType, Guid subjectId, CancellationToken ct);
    Task<AccessCredential?> FindByIdAsync(Guid tenantId, Guid credentialId, CancellationToken ct);
    /// <summary>
    /// Phase 25 reader-event credential lookup. Looks up the active credential
    /// whose <see cref="AccessCredential.SecretVerifier"/> exactly matches the
    /// supplied SHA-256 hash (raw bytes) within the supplied tenant. Returns
    /// null when no match is found.
    /// </summary>
    Task<AccessCredential?> FindByHashAsync(Guid tenantId, byte[] sha256Hash, CancellationToken ct);
    Task<IReadOnlyList<AccessCredential>> ListAllAsync(Guid tenantId, CancellationToken ct);
    Task<IReadOnlyList<AccessCredential>> ListAsync(Guid tenantId, int skip, int take, CancellationToken ct, Guid? subjectId = null, SubjectType? subjectType = null, CredentialStatus? status = null);
    Task AddAsync(AccessCredential credential, CancellationToken ct);
    Task ReplaceAsync(AccessCredential predecessor, AccessCredential successor, CredentialLifecycleAction action, CancellationToken ct);
    Task UpdateStatusAsync(AccessCredential credential, CancellationToken ct);
}
