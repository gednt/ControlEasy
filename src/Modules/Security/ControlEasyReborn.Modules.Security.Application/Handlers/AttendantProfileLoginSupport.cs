using ControlEasyReborn.Modules.Security.Application.Abstractions;
using ControlEasyReborn.Modules.Security.Domain.Entities;
using ControlEasyReborn.Modules.Tenants.Application.Abstractions;
using ControlEasyReborn.SharedKernel.MultiTenancy;

namespace ControlEasyReborn.Modules.Security.Application.Handlers;

internal static class AttendantProfileLoginSupport
{
    internal static async Task<AttendantProfile?> ResolveActiveProfileAsync(
        User user,
        IAttendantProfileRepository profiles,
        ITenantAdminRepository adminProfiles,
        CancellationToken ct)
    {
        var activeProfiles = await ListActiveProfilesAsync(profiles, user.Id, ct);

        if (RequiresAttendantProfile(user.Roles))
        {
            var needsRepair = activeProfiles.Count == 0 ||
                (user.Roles.Contains("TenantAdmin", StringComparison.Ordinal) &&
                 activeProfiles.Any(p => MissingTenantAdminPermissions(p.Permissions)));

            if (needsRepair)
            {
                await adminProfiles.EnsureAttendantProfileAsync(
                    user.Id, user.TenantId, user.DisplayName, user.Roles, ct);
                activeProfiles = await ListActiveProfilesAsync(profiles, user.Id, ct);
            }
        }

        return SelectProfile(user.Roles, activeProfiles);
    }

    private static bool MissingTenantAdminPermissions(string permissions)
    {
        var current = permissions
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var set = new HashSet<string>(current, StringComparer.OrdinalIgnoreCase);
        return ControlEasyReborn.Modules.Tenants.Application.TenantAdminDefaults.Permissions
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Any(p => !set.Contains(p));
    }

    internal static AttendantProfile? SelectProfile(string roles, IReadOnlyList<AttendantProfile> activeProfiles)
    {
        if (activeProfiles.Count == 0)
            return null;

        return UserTenantAccess.IsPlatformAdmin(roles)
            ? activeProfiles.FirstOrDefault()
            : activeProfiles.FirstOrDefault(p => p.TenantId != PlatformTenant.Id)
              ?? activeProfiles.FirstOrDefault();
    }

    private static bool RequiresAttendantProfile(string roles) =>
        roles.Contains("TenantAdmin", StringComparison.Ordinal) ||
        roles.Contains("PlatformAdmin", StringComparison.Ordinal);

    private static async Task<List<AttendantProfile>> ListActiveProfilesAsync(
        IAttendantProfileRepository profiles,
        Guid userId,
        CancellationToken ct)
    {
        var profilesForUser = await profiles.ListByUserAsync(userId, ct);
        return profilesForUser.Where(p => p.Active).ToList();
    }
}
