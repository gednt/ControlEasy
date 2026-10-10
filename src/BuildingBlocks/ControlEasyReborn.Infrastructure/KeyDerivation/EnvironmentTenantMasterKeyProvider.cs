using System.Text;

namespace ControlEasyReborn.Infrastructure.KeyDerivation;

public sealed class EnvironmentTenantMasterKeyProvider : ITenantMasterKeyProvider
{
    private const string EnvVarName = "CE_MASTER_KEY_V1";
    private const string DefaultDevKey = "CE-DEV-MASTER-KEY-V1-CHANGE-IN-PROD-32B-MIN!!";

    private readonly byte[] _key;

    public EnvironmentTenantMasterKeyProvider()
    {
        var configured = System.Environment.GetEnvironmentVariable(EnvVarName);
        if (!string.IsNullOrWhiteSpace(configured))
        {
            _key = Encoding.UTF8.GetBytes(configured);
            return;
        }
        _key = Encoding.UTF8.GetBytes(DefaultDevKey);
    }

    public byte[] GetMasterKey() => _key;
}