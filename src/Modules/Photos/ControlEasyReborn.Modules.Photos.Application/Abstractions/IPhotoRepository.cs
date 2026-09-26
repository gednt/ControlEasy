using ControlEasyReborn.Modules.Photos.Domain.Entities;

namespace ControlEasyReborn.Modules.Photos.Application.Abstractions;

public interface IPhotoRepository
{
    Task<Photo?> FindAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<Photo>> ListByEntityAsync(string entityType, string entityId, CancellationToken ct);
    Task AddAsync(Photo photo, CancellationToken ct);
    Task SoftDeleteAsync(Photo photo, CancellationToken ct);
}

public interface IConsentAuditLogRepository
{
    Task AddAsync(ConsentAuditLogEntry entry, CancellationToken ct);
    Task<IReadOnlyList<ConsentAuditLogEntry>> ListAsync(string? entryState, string? subjectType, DateTime? fromUtc, DateTime? toUtc, Guid? porteiro, int skip, int take, CancellationToken ct);
}

public interface ITenantConsentPolicyRepository
{
    Task<TenantConsentPolicy?> FindByCategoryAsync(Guid tenantId, string subjectCategory, CancellationToken ct);
    Task UpsertAsync(TenantConsentPolicy policy, CancellationToken ct);
}
