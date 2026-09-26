using ControlEasyReborn.Modules.Security.Application.Abstractions;
using ControlEasyReborn.Modules.Security.Application.Contracts;
using ControlEasyReborn.Modules.Security.Application.Errors;
using ControlEasyReborn.SharedKernel.MultiTenancy;

namespace ControlEasyReborn.Modules.Security.Application.Handlers;

public sealed class ListStaffHandler
{
    private static readonly HashSet<string> StaffRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        "TenantAdmin",
        "Porteiro"
    };

    private readonly IUserRepository _users;
    private readonly IAttendantProfileRepository _profiles;
    private readonly ITenantContext _tenantContext;

    public ListStaffHandler(IUserRepository users, IAttendantProfileRepository profiles, ITenantContext tenantContext)
    {
        _users = users;
        _profiles = profiles;
        _tenantContext = tenantContext;
    }

    public async Task<IReadOnlyList<StaffMemberResponse>> HandleAsync(Guid tenantId, CancellationToken ct)
    {
        var isPlatformAdmin = _tenantContext.IsPlatformAdmin || _tenantContext.Roles.Contains("PlatformAdmin");
        var isTenantAdmin = _tenantContext.Roles.Contains("TenantAdmin");
        if (!isPlatformAdmin && !isTenantAdmin)
        {
            throw new ForbiddenException("Only TenantAdmin or PlatformAdmin can list staff.");
        }

        var users = await _users.ListByTenantAsync(tenantId, ct);
        var profiles = await _profiles.ListByTenantAsync(tenantId, ct);

        var profileIdByUserId = new Dictionary<Guid, Guid>(profiles.Count);
        foreach (var profile in profiles)
        {
            profileIdByUserId[profile.UserId] = profile.Id;
        }

        var staff = new List<StaffMemberResponse>();
        foreach (var user in users)
        {
            if (!user.Active) continue;

            var roles = user.Roles.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            var isStaff = roles.Any(StaffRoles.Contains);
            if (!isStaff) continue;

            Guid? resolvedProfileId = profileIdByUserId.TryGetValue(user.Id, out var profileId)
                ? profileId
                : (Guid?)null;
            staff.Add(new StaffMemberResponse(user.Id, resolvedProfileId, user.Email, user.DisplayName, user.Roles, user.Active));
        }

        return staff;
    }
}