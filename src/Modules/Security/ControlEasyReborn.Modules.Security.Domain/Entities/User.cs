namespace ControlEasyReborn.Modules.Security.Domain.Entities;

public sealed class User
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string Email { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public string DisplayName { get; private set; } = string.Empty;
    public bool Active { get; private set; }
    public bool MustChangePassword { get; private set; }
    public string Roles { get; private set; } = string.Empty;
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? UpdatedAtUtc { get; private set; }

    private User() { }

    public User(Guid id, Guid tenantId, string email, string passwordHash, string displayName, bool active, bool mustChangePassword, string roles, DateTime createdAtUtc, DateTime? updatedAtUtc = null)
    {
        Id = id;
        TenantId = tenantId;
        Email = email;
        PasswordHash = passwordHash;
        DisplayName = displayName;
        Active = active;
        MustChangePassword = mustChangePassword;
        Roles = roles;
        CreatedAtUtc = createdAtUtc;
        UpdatedAtUtc = updatedAtUtc;
    }

    public void Deactivate()
    {
        Active = false;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void UpdateProfile(string displayName, string roles)
    {
        DisplayName = displayName;
        Roles = roles;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void SetPasswordHash(string passwordHash)
    {
        PasswordHash = passwordHash;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void ChangePassword(string passwordHash)
    {
        PasswordHash = passwordHash;
        MustChangePassword = false;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void ResetPassword(string passwordHash)
    {
        PasswordHash = passwordHash;
        MustChangePassword = true;
        UpdatedAtUtc = DateTime.UtcNow;
    }
}