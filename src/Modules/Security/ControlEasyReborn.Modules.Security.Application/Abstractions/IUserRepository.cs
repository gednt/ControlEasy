using ControlEasyReborn.Modules.Security.Domain.Entities;

namespace ControlEasyReborn.Modules.Security.Application.Abstractions;

public interface IUserRepository
{
    Task<User?> FindByEmailAsync(string email, CancellationToken ct);
    Task<User?> FindAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<User>> ListByTenantAsync(Guid tenantId, CancellationToken ct);
    Task AddAsync(User user, CancellationToken ct);
    Task UpdateAsync(User user, CancellationToken ct);
}