namespace ControlEasyReborn.Modules.Devices.Domain.Entities;

public sealed class Device
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string DeviceType { get; private set; } = string.Empty;
    public string Vendor { get; private set; } = string.Empty;
    public byte[] ConnectionParamsCiphertext { get; private set; } = Array.Empty<byte>();
    public Guid? GatehouseId { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? UpdatedAtUtc { get; private set; }
    public Guid CreatedByProfileId { get; private set; }

    private Device() { }

    public Device(
        Guid id,
        Guid tenantId,
        string deviceType,
        string vendor,
        byte[] connectionParamsCiphertext,
        Guid? gatehouseId,
        bool isActive,
        Guid createdByProfileId,
        DateTime createdAtUtc,
        DateTime? updatedAtUtc = null)
    {
        if (id == Guid.Empty) throw new InvalidOperationException("Device id is required.");
        if (tenantId == Guid.Empty) throw new InvalidOperationException("Tenant id is required.");
        if (string.IsNullOrWhiteSpace(deviceType)) throw new InvalidOperationException("Device type is required.");
        if (deviceType != "reader" && deviceType != "controller")
            throw new InvalidOperationException("Device type must be 'reader' or 'controller'.");
        if (string.IsNullOrWhiteSpace(vendor)) throw new InvalidOperationException("Vendor is required.");
        if (connectionParamsCiphertext is null || connectionParamsCiphertext.Length == 0)
            throw new InvalidOperationException("Connection params ciphertext is required.");
        if (createdByProfileId == Guid.Empty) throw new InvalidOperationException("Created by profile id is required.");

        Id = id;
        TenantId = tenantId;
        DeviceType = deviceType;
        Vendor = vendor;
        ConnectionParamsCiphertext = connectionParamsCiphertext;
        GatehouseId = gatehouseId;
        IsActive = isActive;
        CreatedByProfileId = createdByProfileId;
        CreatedAtUtc = createdAtUtc;
        UpdatedAtUtc = updatedAtUtc;
    }

    public void Activate()
    {
        if (IsActive) return;
        IsActive = true;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        if (!IsActive) return;
        IsActive = false;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void RotateConnectionParams(byte[] newCiphertext)
    {
        if (newCiphertext is null || newCiphertext.Length == 0)
            throw new InvalidOperationException("Connection params ciphertext is required.");
        ConnectionParamsCiphertext = newCiphertext;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public bool IsAccessibleTo(Guid tenantId) => TenantId == tenantId;
}