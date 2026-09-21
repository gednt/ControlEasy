namespace ControlEasyReborn.Modules.Tenants.Application;

public static class TenantAdminDefaults
{
    public const string Permissions =
        "Visits.CheckIn,Visits.CheckOut,Visits.Read," +
        "Apartments.Read,Apartments.Write," +
        "Residents.Read,Residents.Write," +
        "Vehicles.Read,Vehicles.Write," +
        "ServiceProviders.Read,ServiceProviders.Write," +
        "Reports.Read," +
        "Photos.Read,Photos.Write,Photos.Delete," +
        "Access.Read,Access.Access.Operate," +
        "Access.Control.Issue,Access.Control.Replace,Access.Control.Revoke";
}
