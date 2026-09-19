namespace ControlEasyReborn.Modules.Security.Domain.Entities;

public sealed class PasswordResetRequest
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public Guid UserId { get; private set; }
    public string NormalizedEmail { get; private set; } = string.Empty;
    public string HashedTempPassword { get; private set; } = string.Empty;
    public string DeliveryState { get; private set; } = "Pending";
    public string? FailureReason { get; private set; }
    public Guid? RequestedByUserId { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? DeliveredAtUtc { get; private set; }
    public DateTime ExpiresAtUtc { get; private set; }

    private PasswordResetRequest() { }

    public PasswordResetRequest(
        Guid id,
        Guid tenantId,
        Guid userId,
        string normalizedEmail,
        string hashedTempPassword,
        string deliveryState,
        string? failureReason,
        Guid? requestedByUserId,
        DateTime createdAtUtc,
        DateTime? deliveredAtUtc,
        DateTime expiresAtUtc)
    {
        Id = id;
        TenantId = tenantId;
        UserId = userId;
        NormalizedEmail = normalizedEmail;
        HashedTempPassword = hashedTempPassword;
        DeliveryState = deliveryState;
        FailureReason = failureReason;
        RequestedByUserId = requestedByUserId;
        CreatedAtUtc = createdAtUtc;
        DeliveredAtUtc = deliveredAtUtc;
        ExpiresAtUtc = expiresAtUtc;
    }

    public void MarkSent()
    {
        DeliveryState = "Sent";
        DeliveredAtUtc = DateTime.UtcNow;
        FailureReason = null;
    }

    public void MarkFailed(string reason)
    {
        DeliveryState = "Failed";
        FailureReason = reason;
    }
}
