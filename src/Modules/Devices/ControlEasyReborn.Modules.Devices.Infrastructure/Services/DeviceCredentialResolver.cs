using System.Security.Cryptography;
using System.Text;
using ControlEasyReborn.Modules.AccessControl.Application.Abstractions;
using ControlEasyReborn.Modules.AccessControl.Domain.ValueObjects;
using ControlEasyReborn.Modules.Devices.Application.Abstractions;

namespace ControlEasyReborn.Modules.Devices.Infrastructure.Services;

// Default IDeviceCredentialResolver: hashes the opaque token via SHA-256
// and looks up the active AccessCredentials row whose SecretVerifier
// matches. Tenant scoping is enforced by the underlying
// IAccessCredentialRepository.FindByHashAsync query.
//
// Format:
//   token -> SHA-256(UTF-8(token)) -> byte[] -> MySQL equality match
//
// If the credential is missing or non-Active, the resolver returns null
// (which the IngestDeviceEventHandler translates to a refused scan).
//
// Synthetic simulator prefixes ("sim-test-resident-..."/"sim-test-visitor-..."
// /"sim-test-unknown-...") return synthetic CredentialMatch instances for
// the test harness without touching the AccessCredentials table.
public sealed class DeviceCredentialResolver : IDeviceCredentialResolver
{
    private readonly IAccessCredentialRepository _credentials;

    public DeviceCredentialResolver(IAccessCredentialRepository credentials)
    {
        _credentials = credentials;
    }

    public async Task<CredentialMatch?> ResolveAsync(Guid tenantId, string? opaqueToken, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(opaqueToken)) return null;

        // Simulator prefix shortcut.
        if (SimulatedDeviceHandler.TryClassifySimulatorToken(opaqueToken, out var kind))
        {
            return ResolveSimulated(tenantId, opaqueToken, kind);
        }

        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(opaqueToken));
        var credential = await _credentials.FindByHashAsync(tenantId, hash, ct);
        if (credential is null) return null;

        var nowUtc = DateTime.UtcNow;
        var isUsable = credential.IsUsableAt(nowUtc);

        // Destination metadata (Phase 25's "Credential destination" is on the
        // credential row itself for visitor credentials; for residents it's
        // backed by the resident's apartment. In v2.3 the resolver returns
        // null destination for real credentials; the destination resolver
        // inside RecordAccessScanHandler fills it in from the resident/visit
        // tables when the scan fires.
        var subjectType = SubjectTypeCodes.ToWire(credential.SubjectType);

        return new CredentialMatch(
            CredentialId: credential.Id,
            TenantId: credential.TenantId,
            SubjectType: subjectType,
            SubjectId: credential.SubjectId,
            DestinationApartmentId: null,
            DestinationBlock: string.Empty,
            DestinationUnit: string.Empty,
            IsActive: credential.Status == CredentialStatus.Active,
            ValidFromUtc: credential.ValidFromUtc,
            ExpiresAtUtc: credential.ExpiresAtUtc,
            IsUsableNow: isUsable);
    }

    private static CredentialMatch? ResolveSimulated(Guid tenantId, string opaqueToken, SimulatedTokenKind kind)
    {
        if (kind == SimulatedTokenKind.Unknown) return null;

        // "sim-test-resident-<guid>" -> SubjectType=Resident, SubjectId=<guid>
        // "sim-test-visitor-<guid>"  -> SubjectType=Visitor,  SubjectId=<guid>
        var prefix = SimulatedDeviceHandler.SimulatorPrefixMarker;
        var rest = opaqueToken.Substring(prefix.Length);
        var subjectPrefixLen = kind == SimulatedTokenKind.Resident ? "resident-".Length : "visitor-".Length;
        var guidPart = rest.Substring(subjectPrefixLen);
        if (!Guid.TryParse(guidPart, out var subjectId))
        {
            // Not parseable -> treat as unknown card.
            return null;
        }

        var subjectTypeWire = kind == SimulatedTokenKind.Resident ? "Resident" : "Visitor";
        return new CredentialMatch(
            CredentialId: Guid.NewGuid(),
            TenantId: tenantId,
            SubjectType: subjectTypeWire,
            SubjectId: subjectId,
            DestinationApartmentId: null,
            DestinationBlock: string.Empty,
            DestinationUnit: string.Empty,
            IsActive: true,
            ValidFromUtc: DateTime.UtcNow.AddYears(-1),
            ExpiresAtUtc: null,
            IsUsableNow: true);
    }
}
