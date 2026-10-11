namespace ControlEasyReborn.Modules.Devices.Application.Permissions;

public static class DevicePermissions
{
    // Phase 23
    public const string Unlock = "devices.unlock";

    // Phase 24 — DOOR-05 + DOOR-06
    public const string Read = "devices.read";
    public const string Write = "devices.write";
    public const string ToggleDoorIntegration = "tenants.toggle_door_integration";

    public static readonly IReadOnlyList<string> All = new[]
    {
        Unlock,
        Read,
        Write,
        ToggleDoorIntegration
    };
}