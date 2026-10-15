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
    public DateTime? RemovedAtUtc { get; private set; }
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
        DateTime? updatedAtUtc = null,
        DateTime? removedAtUtc = null)
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
        RemovedAtUtc = removedAtUtc;
    }

    public void Activate()
    {
        if (IsActive) return;
        IsActive = true;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    // Deactivate IS soft-delete. Sets IsActive=false AND RemovedAtUtc=now.
    // Restoring requires a re-register (no undelete endpoint — see Phase 24
    // CONTEXT.md "Soft-delete semantics").
    public void Deactivate()
    {
        if (!IsActive && RemovedAtUtc.HasValue) return;
        IsActive = false;
        var now = DateTime.UtcNow;
        UpdatedAtUtc = now;
        RemovedAtUtc = now;
    }

    public void Remove(DateTime nowUtc)
    {
        IsActive = false;
        UpdatedAtUtc = nowUtc;
        RemovedAtUtc = nowUtc;
    }

    public void RotateConnectionParams(byte[] newCiphertext)
    {
        if (newCiphertext is null || newCiphertext.Length == 0)
            throw new InvalidOperationException("Connection params ciphertext is required.");
        ConnectionParamsCiphertext = newCiphertext;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public void UpdateMetadata(string? vendor, Guid? gatehouseId)
    {
        if (vendor is not null)
        {
            if (string.IsNullOrWhiteSpace(vendor)) throw new InvalidOperationException("Vendor cannot be empty.");
            Vendor = vendor;
        }
        // GatehouseId semantics (per the EditDeviceRequest contract): null =
        // leave the binding unchanged; Guid.Empty = clear the binding ("No
        // binding" in the Configure dialog); any other value = rebind.
        if (gatehouseId.HasValue) GatehouseId = gatehouseId.Value == Guid.Empty ? null : gatehouseId.Value;
        UpdatedAtUtc = DateTime.UtcNow;
    }

    public bool IsAccessibleTo(Guid tenantId) => TenantId == tenantId;

    public bool IsRemoved => RemovedAtUtc.HasValue;
}