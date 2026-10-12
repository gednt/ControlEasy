namespace ControlEasyReborn.Modules.Security.Domain.Entities;

public sealed class Gatehouse
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? Location { get; private set; }
    public bool Active { get; private set; }

    private Gatehouse() { }

    public Gatehouse(Guid id, Guid tenantId, string name, string? location, bool active = true)
    {
        Id = id;
        TenantId = tenantId;
        Active = active;
        UpdateDetails(name, location);
    }

    public void UpdateDetails(string name, string? location)
    {
        ArgumentNullException.ThrowIfNull(name);
        Name = name.Trim();
        Location = string.IsNullOrWhiteSpace(location) ? null : location.Trim();
    }

    public void SetActive(bool active) => Active = active;
}
