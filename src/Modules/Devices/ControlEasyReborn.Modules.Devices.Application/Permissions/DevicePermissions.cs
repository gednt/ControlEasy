namespace ControlEasyReborn.Modules.Devices.Application.Permissions;

public static class DevicePermissions
{
    public const string Unlock = "devices.unlock";
    public const string Read = "devices.read";

    public static readonly IReadOnlyList<string> All = new[]
    {
        Unlock,
        Read
    };
}