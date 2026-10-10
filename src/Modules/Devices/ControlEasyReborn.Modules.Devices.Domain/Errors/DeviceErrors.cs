namespace ControlEasyReborn.Modules.Devices.Domain.Errors;

public static class DeviceErrors
{
    public const string DeviceNotFoundTitle = "device-not-found";
    public const string DeviceInactiveTitle = "device-inactive";
    public const string TenantDoorIntegrationDisabledTitle = "tenant-door-integration-disabled";
    public const string InsufficientRoleTitle = "unlock-insufficient-role";
    public const string ReplayWindowExceededTitle = "unlock-replay-window-exceeded";
    public const string SignatureInvalidTitle = "unlock-signature-invalid";
    public const string RateLimitExceededTitle = "unlock-rate-limited";

    public const string DeviceNotFoundType = "https://errors.controleasy.app/devices/device-not-found";
    public const string DeviceInactiveType = "https://errors.controleasy.app/devices/device-inactive";
    public const string TenantDoorIntegrationDisabledType = "https://errors.controleasy.app/devices/tenant-door-integration-disabled";
    public const string InsufficientRoleType = "https://errors.controleasy.app/devices/unlock-insufficient-role";
    public const string ReplayWindowExceededType = "https://errors.controleasy.app/devices/unlock-replay-window-exceeded";
    public const string SignatureInvalidType = "https://errors.controleasy.app/devices/unlock-signature-invalid";
    public const string RateLimitExceededType = "https://errors.controleasy.app/devices/unlock-rate-limited";
}