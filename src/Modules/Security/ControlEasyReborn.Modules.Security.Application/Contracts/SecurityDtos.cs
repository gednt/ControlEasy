namespace ControlEasyReborn.Modules.Security.Application.Contracts;

public sealed record CreateUserRequest(string Email, string Password, string DisplayName, string Roles, Guid TenantId);

public sealed record LoginRequest(string Email, string Password);

public sealed record LoginResponse(string Token, string RefreshToken, Guid TenantId, Guid ProfileId, string Roles, string Permissions, bool MustChangePassword, bool IsDemoPersona);

public sealed record RefreshRequest(string RefreshToken);

public sealed record RefreshResponse(string Token, string RefreshToken);

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public sealed record CreateAttendantProfileRequest(Guid UserId, string? DisplayName, Guid? ShiftId, Guid? GatehouseId, string Permissions);

public sealed record UpdateAttendantProfileRequest(string? DisplayName, Guid? ShiftId, Guid? GatehouseId, string Permissions);

public sealed record AttendantProfileResponse(
    Guid Id,
    Guid TenantId,
    Guid UserId,
    string? DisplayName,
    Guid? ShiftId,
    Guid? GatehouseId,
    string Permissions,
    bool Active,
    DateTime CreatedAtUtc);

public sealed record CreateShiftRequest(string Name, TimeSpan StartTime, TimeSpan EndTime);

public sealed record ShiftResponse(Guid Id, Guid TenantId, string Name, TimeSpan StartTime, TimeSpan EndTime, bool CrossesMidnight);

public sealed record CreateGatehouseRequest(string Name, string? Location);

public sealed record SetGatehouseActivationRequest(bool? Active);

public sealed record GatehouseResponse(Guid Id, Guid TenantId, string Name, string? Location, bool Active);

public sealed record TenantLookupResponse(Guid TenantId, string Slug, string DisplayName, string UserDisplayName);

public sealed record TenantSwitchRequest(Guid TenantId);

public sealed record TenantSwitchResponse(string Token, string RefreshToken, Guid TenantId, Guid ProfileId, string Roles, string Permissions, bool IsDemoPersona);

public sealed record SessionTenantResponse(Guid TenantId, string Slug, string DisplayName, string UserDisplayName);

public sealed record SessionResponse(
    Guid TenantId,
    string TenantSlug,
    string TenantDisplayName,
    string UserDisplayName,
    string Roles,
    bool IsDemoPersona,
    IReadOnlyList<SessionTenantResponse> SwitchableTenants);

public sealed record ResetUserPasswordResponse(Guid UserId, bool MustChangePassword, string DeliveryState);

public sealed record StaffMemberResponse(Guid UserId, Guid? ProfileId, string Email, string DisplayName, string Roles, bool Active);

public sealed record ForgotPasswordRequest(string Email);

public sealed record ForgotPasswordResponse(string Message);
