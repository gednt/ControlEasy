namespace ControlEasyReborn.Modules.Tenants.Application;

public static class PorteiroDefaults
{
    public const string Role = "AttendantProfile";

    public const string Permissions =
        "Visits.Read,Apartments.Read,Residents.Read,Vehicles.Read,ServiceProviders.Read,Reports.Read,Photos.Read,Photos.Write," +
        "Access.Read,Access.Access.Operate";
}
