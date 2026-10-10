namespace ControlEasyReborn.Modules.Security.Application;

public static class Permissions
{
    public const string VisitsCheckIn = "Visits.CheckIn";
    public const string VisitsCheckOut = "Visits.CheckOut";
    public const string VisitsRead = "Visits.Read";
    public const string ApartmentsRead = "Apartments.Read";
    public const string ApartmentsWrite = "Apartments.Write";
    public const string ResidentsRead = "Residents.Read";
    public const string ResidentsWrite = "Residents.Write";
    public const string VehiclesRead = "Vehicles.Read";
    public const string VehiclesWrite = "Vehicles.Write";
    public const string ServiceProvidersRead = "ServiceProviders.Read";
    public const string ServiceProvidersWrite = "ServiceProviders.Write";
    public const string ReportsRead = "Reports.Read";
    public const string PhotosRead = "Photos.Read";
    public const string PhotosWrite = "Photos.Write";
    public const string PhotosDelete = "Photos.Delete";
    public const string AccessControlIssue = "Access.Control.Issue";
    public const string AccessControlReplace = "Access.Control.Replace";
    public const string AccessControlRevoke = "Access.Control.Revoke";
    public const string AccessOperate = "Access.Access.Operate";
    public const string AccessRead = "Access.Read";
    public const string DevicesUnlock = "devices.unlock";
    public const string DevicesRead = "devices.read";

    public static readonly string[] All =
    [
        VisitsCheckIn,
        VisitsCheckOut,
        VisitsRead,
        ApartmentsRead,
        ApartmentsWrite,
        ResidentsRead,
        ResidentsWrite,
        VehiclesRead,
        VehiclesWrite,
        ServiceProvidersRead,
        ServiceProvidersWrite,
        ReportsRead,
        PhotosRead,
        PhotosWrite,
        PhotosDelete,
        AccessControlIssue,
        AccessControlReplace,
        AccessControlRevoke,
        AccessOperate,
        AccessRead,
        DevicesUnlock,
        DevicesRead
    ];
}