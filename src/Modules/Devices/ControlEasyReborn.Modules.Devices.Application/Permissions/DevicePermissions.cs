namespace ControlEasyReborn.Modules.Devices.Application.Permissions;

public static class DevicePermissions
{
    // Phase 23
    public const string Unlock = "devices.unlock";

    // Phase 24 — DOOR-05 + DOOR-06
    public const string Read = "devices.read";
    public const string Write = "devices.write";
    public const string ToggleDoorIntegration = "tenants.toggle_door_integration";

    // Phase 26 — DOOR-13: read device-health dashboard data. Granted to both
    // TenantAdmin and Porteiro roles via the existing devices.read permission
    // (the dashboard page is visible to either role per CONTEXT.md "Permission
    // visibility"). We keep the symbol for future per-permission splits.
    public const string ReadHealth = "devices.read_health";

    public static readonly IReadOnlyList<string> All = new[]
    {
        Unlock,
        Read,
        Write,
        ToggleDoorIntegration,
        ReadHealth
    };
}