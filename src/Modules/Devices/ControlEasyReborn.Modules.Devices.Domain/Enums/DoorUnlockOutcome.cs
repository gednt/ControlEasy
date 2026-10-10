namespace ControlEasyReborn.Modules.Devices.Domain.Enums;

public enum DoorUnlockOutcome
{
    Success = 0,
    DeviceOffline = 1,
    AuthFailed = 2,
    RateLimited = 3,
    UnknownTenantFlag = 4,
    UnknownDevice = 5,
    DeviceInactive = 6
}