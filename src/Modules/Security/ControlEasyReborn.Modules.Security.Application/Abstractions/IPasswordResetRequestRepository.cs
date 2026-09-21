using ControlEasyReborn.Modules.Security.Domain.Entities;

namespace ControlEasyReborn.Modules.Security.Application.Abstractions;

public interface IPasswordResetRequestRepository
{
    Task AddAsync(PasswordResetRequest request, CancellationToken ct);
    Task<PasswordResetRequest?> FindLatestByEmailAsync(string normalizedEmail, CancellationToken ct);
    Task<PasswordResetRequest?> FindLatestByUserIdAsync(Guid userId, CancellationToken ct);
    Task UpdateAsync(PasswordResetRequest request, CancellationToken ct);
    Task<int> CountRecentRequestsAsync(string normalizedEmail, DateTime sinceUtc, CancellationToken ct);
}
