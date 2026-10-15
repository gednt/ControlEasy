# Phase 27: Resident Access Foundation - Pattern Map

**Mapped:** 2026-10-15
**Files analyzed:** 22 (new + modified, from 27-CONTEXT.md decisions + 27-RESEARCH.md project structure)
**Analogs found:** 19 / 22 exact-or-role matches (3 new constructs have no in-repo analog; use RESEARCH.md Patterns instead)

All analog paths below verified git-tracked (`git ls-files` non-empty for `src/Modules/Residents/**`, `src/Modules/Security/**`, `src/Host/**`, `tests/**`, `src/Web/**/features/{devices,residents}/**`, `docker/mysql/**`). No gitignored mirror paths used.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/Modules/Residents/...Domain/Entities/ResidentCredential.cs` | model | CRUD | `src/Modules/Residents/...Domain/Entities/Resident.cs` | exact |
| `src/Modules/Residents/...Domain/Entities/ResidentCredentialStatus.cs` | model | CRUD | `Resident.cs` bool-status + string status conventions | exact |
| `src/Modules/Residents/...Domain/Events/ResidentCredentialCreated.cs` (+ Revoked) | event | event-driven | `...Domain/Events/ResidentCreated.cs` | exact |
| `src/Modules/Residents/...Application/Abstractions/IResidentCredentialRepository.cs` | abstraction | CRUD | `...Application/Abstractions/IResidentRepository.cs` | exact |
| `src/Modules/Residents/...Application/Handlers/ProvisionResidentCredentialHandler.cs` | service | CRUD | `...Handlers/CreateResidentHandler.cs` | exact |
| `...Handlers/SetResidentCredentialStatusHandler.cs` + `RevokeResidentCredentialHandler.cs` | service | CRUD | `...Handlers/UpdateResidentHandler.cs` / `CreateResidentHandler.cs` | exact (role) |
| `...Handlers/ResetResidentPortalPasswordHandler.cs` | service | CRUD | `src/Modules/Security/...Handlers/ResetUserPasswordHandler.cs` | exact |
| `...Application/Validators/ProvisionResidentCredentialRequestValidator.cs` (etc.) | utility | transform | `...Validators/CreateResidentRequestValidator.cs` | exact |
| `...Application/Contracts/ResidentCredentialDtos.cs` | model | request-response | `...Contracts/ResidentDtos.cs` | exact (role) |
| `src/Modules/Residents/...Infrastructure/Persistence/ResidentCredentialRepository.cs` | repository | CRUD | `...Persistence/ResidentRepository.cs` | exact |
| `...Infrastructure/Persistence/ResidentCredentialResolver.cs` (or Application layer) | service | request-response | `...Persistence/ResidentRepository.cs` + `LoginHandler` seam | role-match |
| `src/Modules/Residents/...Api/Endpoints/ResidentPortalEndpoints.cs` | route | request-response | `...Api/Endpoints/ResidentEndpoints.cs` | exact |
| `src/Modules/Residents/...Api/Auth/ResidentPolicies.cs` | config | — | `src/Modules/Security/...Api/Auth/RequirePermissionRequirement.cs` + `Program.cs:102-112` policy loop | role-match |
| `src/Modules/Security/...Api/Auth/StaffPolicies.cs` (NEW) | config | — | `RequirePermissionRequirement.cs` + `Program.cs` policy registration | role-match |
| `src/Modules/Security/...Api/Auth/ResidentCredentialRequirement.cs` + `ResidentCredentialAuthorizationHandler.cs` (NEW) | middleware (authz) | request-response | `RequirePermissionAuthorizationHandler.cs` (shape only — no DB analog exists) | partial → see "No Analog Found" |
| `src/Modules/Security/...Handlers/LoginHandler.cs` (MODIFY) | controller/service | request-response | self — extend with resident branch | exact (target) |
| `...Handlers/RefreshHandler.cs` (MODIFY) | controller/service | request-response | self — same seam as LoginHandler (:59-66) | exact (target) |
| `...Handlers/ChangePasswordHandler.cs` (MODIFY) | service | request-response | self — `FindCurrentUserAsync` (:58-68) profile_kind branch | exact (target) |
| `...Handlers/GetSessionHandler.cs` (MODIFY) | controller | request-response | self — `ProfileId` gate (:35-39) resident branch | exact (target) |
| `...Infrastructure/Persistence/JwtTokenService.cs` (MODIFY) | service | transform | self — claims template (:35-52) | exact (target) |
| `src/Host/ControlEasyReborn.Api/Program.cs` (MODIFY) | config | — | self — `AddAuthorization` loop (:97-115) | exact (target) |
| Bare-auth sweep: `VisitEndpoints` / `ReportEndpoints` / `VehicleEndpoints` / `ResidentEndpoints` / `ApartmentEndpoints` / `ServiceProvidersEndpoints` / `AdministrationEndpoints` / `AccessControl*Endpoints` / `Photos*Endpoints` / `Devices*Endpoints` / `SecurityEndpoints` / `Host/Hosting/FeatureEndpoints.cs` (MODIFY ×~15) | route | request-response | `ResidentEndpoints.cs:16-18` group pattern; full inventory in RESEARCH Pattern 4 table | exact (targets) |
| Tenants/Security admin reset endpoint extension (MODIFY) | route | request-response | `ResetUserPasswordHandler.cs` in-handler role gate (:44-50) | exact |
| `src/Web/ControlEasyReborn.Web/src/app/features/residents/components/portal-access-modal.component.ts` (NEW) | component | request-response | `src/Web/ControlEasyReborn.Web/src/app/features/devices/components/device-form-modal.component.ts` | exact |
| `src/Web/ControlEasyReborn.Web/src/app/features/residents/residents-api.service.ts` (MODIFY) | service (client) | request-response | self + `devices-api.service.ts` handwritten method pattern | exact |
| `src/Web/.../features/residents/residents.page.ts` (MODIFY — Portal Access section) | component | request-response | residents area + device modal consumption pattern | exact |
| `docker/mysql/migrations/0023-resident-credentials.sql` (NEW) | migration | file-I/O | `docker/mysql/migrations/0022-gatehouse-lifecycle.sql` | exact |
| `docker/mysql/init/23-resident-credentials-schema.sql` (NEW) | migration | file-I/O | `docker/mysql/init/16-password-reset-requests.sql` | exact |
| `docker/mysql/init/03-tenant-backfill.sql` (MODIFY) | migration | file-I/O | self — `ALTER TABLE <T> ADD COLUMN tenant_id` entries (:7-21) | exact (target) |
| `tests/ControlEasyReborn.ArchitectureTests/EndpointAuthorizationScanTests.cs` (NEW) | test | reflection-scan | no endpoint-scan analog — see "No Analog Found"; file/regex-scanning style from `SchemaBackfillSyncTests.cs` | partial |
| `tests/ControlEasyReborn.ArchitectureTests/ResidentSurfaceRulesTests.cs` (NEW) | test | reflection | `...ArchitectureTests/AccessControlTenantRulesTests.cs` | exact |
| `tests/ControlEasyReborn.IntegrationTests/Residents/ResidentPortalTests.cs` (NEW) | test | request-response | `...IntegrationTests/TenantAwareWebApplicationFactory.cs` + `JwtTestHelper.cs` | exact |
| `tests/...IntegrationTests/Residents/ResidentDenyMatrixTests.cs` (NEW) | test | request-response | `TenantAwareWebApplicationFactory.cs` two-tenant pattern | exact |
| `tests/...UnitTests/Sources/Modules/Security/.../LoginHandlerTests.cs` (EXTEND) | test | — | self — existing suite | exact (target) |

---

## Pattern Assignments

### `ResidentCredential.cs` (model, CRUD)

**Analog:** `src/Modules/Residents/ControlEasyReborn.Modules.Residents.Domain/Entities/Resident.cs`

Entity shape to copy — private setters, all-args constructor, no EF attributes, `Guid TenantId` non-nullable, nullable FK column (`ApartmentId` is the live occupancy source, lines 6-12):

```csharp
// Resident.cs:3-30
public sealed class Resident
{
    public Guid Id { get; private set; }
    public Guid TenantId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Cpf { get; private set; } = string.Empty;
    public string? Email { get; private set; }
    public Guid? ApartmentId { get; private set; }
    public bool Active { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? UpdatedAtUtc { get; private set; }

    private Resident() { }

    public Resident(Guid id, Guid tenantId, /* ... */, bool active, DateTime createdAtUtc, DateTime? updatedAtUtc = null)
    { /* assign all */ }
}
```

Mutating behavior lives as domain methods, not property sets (`Deactivate()` line 32-36, `UpdateDetails(...)` line 38-46 — both set `UpdatedAtUtc = DateTime.UtcNow`). Copy for `ResidentCredential`: `SetStatus`, `Revoke`, `ChangePassword(hash)` + `ReArmMustChangePassword` methods.

**Status type:** follow the repo's enum-as-domain-type style; `Resident.cs` uses `bool Active` + string statuses elsewhere (`PasswordResetRequest.DeliveryState` is `VARCHAR(32)` with string states "Pending"/"Failed" — see `ResetUserPasswordHandler.cs:86-87,104,110`). For `ResidentCredentialStatus` (Active|Suspended|Revoked) a C# enum mapping to `VARCHAR(32)` is fine within conventions.

### `ResidentCredentialCreated.cs` (event, event-driven)

**Analog:** `src/Modules/Residents/ControlEasyReborn.Modules.Residents.Domain/Events/ResidentCreated.cs`

```csharp
// ResidentCreated.cs:3-9 — sealed record, id/tenant payload + OccurredAtUtc
public sealed record ResidentCreated(Guid ResidentId, Guid TenantId, string Name, DateTime OccurredAtUtc)
{
    public Guid ResidentId { get; } = ResidentId;
    public Guid TenantId { get; } = TenantId;
}
```

### `IResidentCredentialRepository.cs` (abstraction, CRUD)

**Analog:** `src/Modules/Residents/ControlEasyReborn.Modules.Residents.Application/Abstractions/IResidentRepository.cs`

```csharp
// IResidentRepository.cs:5-11 — interface in Application/Abstractions, no implementation deps
public interface IResidentRepository
{
    Task<Resident?> FindAsync(Guid id, CancellationToken ct);
    Task<IReadOnlyList<Resident>> ListAsync(string? search, int skip, int take, CancellationToken ct, Guid? apartmentId = null);
    Task AddAsync(Resident resident, CancellationToken ct);
    Task UpdateAsync(Resident resident, CancellationToken ct);
}
```

### `ResidentCredentialRepository.cs` (repository, CRUD)

**Analog:** `src/Modules/Residents/ControlEasyReborn.Modules.Residents.Infrastructure/Persistence/ResidentRepository.cs`

**Constructor + data-access pattern** (lines 10-33) — this is THE repository pattern in the codebase (`ITenantContext` scoped + `ITenantAwareLinqFactory` singleton, `db.SelectAsync(fields, table, whereClause, parameters)`):

```csharp
// ResidentRepository.cs:10-33
public sealed class ResidentRepository : IResidentRepository
{
    private const string TableName = "Residents";
    private readonly ITenantContext _ctx;
    private readonly ITenantAwareLinqFactory _factory;

    public ResidentRepository(ITenantContext ctx, ITenantAwareLinqFactory factory)
    { _ctx = ctx; _factory = factory; }

    public async Task<Resident?> FindAsync(Guid id, CancellationToken ct)
    {
        var db = _factory.Create(_ctx);
        var rows = await db.SelectAsync(
            fields: "Id, TenantId, Name, Cpf, Email, Phone, ApartmentId, Active, CreatedAtUtc, UpdatedAtUtc",
            table: TableName,
            whereClause: "Id = @param0",
            parameters: new object[] { id },
            ct: ct);
        return MapFirstOrDefault(rows);
    }
```

**Insert + Update + manual mapping** (lines 68-94, 114-130) — explicit column lists, `tenant_id` written alongside `TenantId`, nullable→`DBNull.Value`/`string.Empty` conversions, `MapRow(DataRow)` with `Guid.Parse`/`Convert.ToBoolean`:

```csharp
// ResidentRepository.cs:68-78 (AddAsync)
    await db.InsertAsync(
        new[] { "Id", "TenantId", /* ... */, "Active", "CreatedAtUtc", "UpdatedAtUtc", "tenant_id" },
        TableName,
        new object?[] { resident.Id, resident.TenantId, /* ... */, (object?)resident.UpdatedAtUtc ?? DBNull.Value, resident.TenantId },
        primaryKeyName: "Id", autoIncrement: false, ct: ct);
```

The credential resolver ("per-request status + occupancy read") follows the exact same shape: `_factory.Create(_ctx)` + `SelectAsync` join of `ResidentCredentials` × `Residents` by credential id, returning `(credentialStatus, residentId, apartmentId)` — no caching (locked decision).

### `ProvisionResidentCredentialHandler.cs` (service, CRUD)

**Analog:** `src/Modules/Residents/ControlEasyReborn.Modules.Residents.Application/Handlers/CreateResidentHandler.cs`

**Handler skeleton** (lines 10-54) — validator-first, cross-module FK existence check, entity construction, repository write, DTO projection:

```csharp
// CreateResidentHandler.cs:26-54
    public async Task<ResidentResponse> HandleAsync(CreateResidentRequest request, Guid tenantId, CancellationToken ct)
    {
        var result = await _validator.ValidateAsync(request, ct);
        if (!result.IsValid)
            throw new Errors.ValidationException(result.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()));

        if (request.ApartmentId.HasValue && !await _apartments.ExistsAsync(request.ApartmentId.Value, ct))
            throw new NotFoundException("Apartment " + request.ApartmentId + " was not found.");

        var resident = new Resident(id: Guid.NewGuid(), tenantId: tenantId, /* ... */ active: true, createdAtUtc: DateTime.UtcNow);
        await _residents.AddAsync(resident, ct);
        return ToResponse(resident);
    }
```

**Credential-specific behaviors to graft on (from Security module, verified):**
- Bcrypt ≥ 11 via the shared hasher: `IPasswordHasher.Hash(...)` (`ResetUserPasswordHandler.cs:74-75`), `WorkFactor = 11` const in `PasswordHasher.cs:8`.
- Temp/initial password: `ITempPasswordGenerator.Generate(12)` (`ResetUserPasswordHandler.cs:74`).
- Unique-per-resident guard: throw `ConflictException` (Residents `Application/Errors/DomainExceptions.cs`) when a credential row already exists for `(TenantId, ResidentId)`.
- Arm `MustChangePassword` at provision.

### `ResetResidentPortalPasswordHandler.cs` (service, CRUD)

**Analog:** `src/Modules/Security/ControlEasyReborn.Modules.Security.Application/Handlers/ResetUserPasswordHandler.cs`

**Admin-gate + reset machinery** (lines 42-50, 74-78, 114-123) — role gate from `ITenantContext`, temp password + hash, revoke ALL refresh tokens, structured log without secrets:

```csharp
// ResetUserPasswordHandler.cs:44-50 (actor gate)
    var isTenantAdmin = _tenantContext.Roles.Contains("TenantAdmin");
    if (!isPlatformAdmin && !isTenantAdmin)
        throw new ForbiddenException("Insufficient permissions to reset user passwords.");

// :74-78 (generate + hash + apply)
    var tempPassword = _tempPasswordGenerator.Generate(12);
    var hashedTempPassword = _passwordHasher.Hash(tempPassword);

// :114 (session invalidation — REQUIRED for resident reset too)
    await _refreshTokenRepository.RevokeAllForUserAsync(targetUser.Id, ct);

// :116-121 (log ids/outcomes only — never password material)
    _logger.LogInformation("Administrative password reset completed for user {UserId} ... by actor profile {ActorProfileId}",
        targetUser.Id, targetUser.TenantId, _tenantContext.ProfileId, resetRequest.DeliveryState);
```

Resident version: same skeleton but resolves `ResidentCredential` by resident id (tenant-scoped), re-arms `MustChangePassword` (not `User.ResetPassword`), revokes via the resident-keyed `RevokeAllForUserAsync` (see RefreshToken open question in RESEARCH Open Question 1), returns the temp password once.

### Validators (utility, transform)

**Analog:** `src/Modules/Residents/ControlEasyReborn.Modules.Residents.Application/Validators/CreateResidentRequestValidator.cs` (lines 1-28)

```csharp
public sealed class CreateResidentRequestValidator : AbstractValidator<CreateResidentRequest>
{
    public CreateResidentRequestValidator()
    {
        RuleFor(r => r.Name).NotEmpty().MaximumLength(200);
        RuleFor(r => r.Email).EmailAddress().When(r => !string.IsNullOrEmpty(r.Email));
    }
}
```

Copy for provision/status/reset request validators; registration lives in each module's DI extensions (`src/Modules/Residents/...Infrastructure/DI/ResidentsModuleServiceCollectionExtensions.cs`).

### `ResidentPortalEndpoints.cs` (route, request-response)

**Analog:** `src/Modules/Residents/ControlEasyReborn.Modules.Residents.Api/Endpoints/ResidentEndpoints.cs`

**Group + POST pattern** (lines 16-18, 41-51) — note line 17: this file ALSO needs the sweep (`.RequireAuthorization()` → `StaffPolicies` constant):

```csharp
// ResidentEndpoints.cs:16-18 (group with auth)
    var group = app.MapGroup("/api/v1/residents")
        .RequireAuthorization()
        .WithTags("Residents");

// :41-51 (write endpoint: tenantContext + handler + Created, named policy)
    group.MapPost("/", async (
        [FromBody] CreateResidentRequest request,
        ITenantContext tenantContext,
        CreateResidentHandler handler,
        CancellationToken ct) =>
    {
        var tenantId = tenantContext.TenantId
            ?? throw new InvalidOperationException("Tenant context is not resolved.");
        var response = await handler.HandleAsync(request, tenantId, ct);
        return Results.Created($"/api/v1/residents/{response.Id}", response);
    }).RequireAuthorization("Permission_Residents.Write");
```

New portal group copies this shape on `/api/v1/residents/{residentId:guid}/portal-credential*` with `StaffPolicies.TenantAdmin` (or `Permission_Residents.Write` — planner discretion), plus suspend/reactivate/revoke/reset-password sub-actions (RESEARCH C3).

**ProblemDetails pattern** (same file, lines 67-113): module exception middleware `Write(...)` producing `type = "https://httpstatuses.io/" + status` with `application/problem+json` — reuse rather than inventing a new writer.

### `StaffPolicies.cs` (config) + policy registration + `ResidentCredentialRequirement/Handler` (authz)

**Analogs:** `RequirePermissionRequirement.cs` + `RequirePermissionAuthorizationHandler.cs` + `Program.cs:97-115`

**Requirement shape** (5-13 lines):

```csharp
// RequirePermissionRequirement.cs:5-13 — sealed class, IAuthorizationRequirement, ctor-injected payload
public sealed class RequirePermissionRequirement : IAuthorizationRequirement
{
    public string Permission { get; }
    public RequirePermissionRequirement(string permission) { Permission = permission; }
}
```

**Handler shape** (lines 6-17) — note this one is claim-only; the resident handler adds a per-request DB read through `context.Resource`'s `RequestServices`:

```csharp
// RequirePermissionAuthorizationHandler.cs:6-17
public sealed class RequirePermissionAuthorizationHandler : AuthorizationHandler<RequirePermissionRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, RequirePermissionRequirement requirement)
    {
        var permissions = context.User.FindAll("permissions").Select(c => c.Value);
        if (permissions.Contains(requirement.Permission))
            context.Succeed(requirement);
        return Task.CompletedTask;
    }
}
```

**Policy registration + DI lifetime** (`Program.cs:97-115`) — CRITICAL: the new `ResidentCredentialAuthorizationHandler` MUST be registered with this same `AddSingleton<IAuthorizationHandler, ...>` pattern (scoped explodes in integration tests; RESEARCH Pitfall 1):

```csharp
// Program.cs:97-115
    builder.Services.AddAuthorization(options =>
    {
        options.AddPolicy(PlatformAdminRequirement.PolicyName, policy =>
            policy.Requirements.Add(new PlatformAdminRequirement()));

        foreach (var permission in ...Permissions.All)
        {
            options.AddPolicy("Permission_" + permission, policy =>
                policy.Requirements.Add(new RequirePermissionRequirement(permission)));
        }
    });
    builder.Services.AddSingleton<Microsoft.AspNetCore.Authorization.IAuthorizationHandler, RequirePermissionAuthorizationHandler>();
```

`StaffPolicies` policies register in the same `AddAuthorization` block as `policy.RequireRole("TenantAdmin", "Porteiro", ...)` constants (RESEARCH C2).

**Handler registration in module DI:** new repository/handlers/validators are registered in `src/Modules/Residents/ControlEasyReborn.Modules.Residents.Infrastructure/DI/ResidentsModuleServiceCollectionExtensions.cs` (mirror `SecurityModuleServiceCollectionExtensions.cs`).

### `LoginHandler.cs` / `RefreshHandler.cs` (MODIFY — resident dispatch)

**Target files; resolver seam verified at source:**

```csharp
// LoginHandler.cs:49-65 (staff branch — resident branch slots AFTER the user-miss determination)
    var user = await _users.FindByEmailAsync(request.Email, ct);
    if (user is null || !_passwordHasher.Verify(request.Password, user.PasswordHash))
    {
        throw new UnauthorizedException("Invalid email or password.");   // ← SAME MESSAGE reused in the resident branch (uniform deny)
    }
    if (!user.Active) { throw new UnauthorizedException("User account is inactive."); }
    var activeProfile = await AttendantProfileLoginSupport.ResolveActiveProfileAsync(user, _profiles, _adminProfiles, ct);

// RefreshHandler.cs:45-57 (refresh resolves user from token row — resident tokens need a subject-kind branch here)
    var entry = await _refreshTokens.FindByTokenAsync(request.RefreshToken, ct);
    if (entry is null || entry.IsRevoked || entry.IsExpired)
        throw new UnauthorizedException("Invalid or expired refresh token.");
    var user = await _users.FindAsync(entry.UserId, ct);
```

Dispatch rule (locked): staff branch wins when a staff-role user row exists; the resident branch runs only when no `Users` row matches and password verifies against the `ResidentCredential` hash. Login stays uniform-401 (`UnauthorizedException("Invalid email or password.")` for wrong password AND suspended/revoked — RESEARCH Pitfall 4); 403 is pipeline-only.

### `ChangePasswordHandler.cs` / `GetSessionHandler.cs` (MODIFY — profile_kind branches)

**Target files; the exact gates that break on resident tokens:**

```csharp
// ChangePasswordHandler.cs:58-68 (ProfileId → AttendantProfile chain; needs a resident credential branch)
private async Task<Domain.Entities.User> FindCurrentUserAsync(CancellationToken ct)
{
    var profileId = _tenantContext.ProfileId
        ?? throw new UnauthorizedException("No profile in current token.");
    var profile = await _profiles.FindAsync(profileId, ct)
        ?? throw new UnauthorizedException("Current profile not found.");
    return await _users.FindAsync(profile.UserId, ct);
}

// GetSessionHandler.cs:32-39 (same chain — throws "No active profile in current token." on resident tokens)
    var tenantId = _tenantContext.TenantId ?? throw new UnauthorizedException("No tenant context in current token.");
    var profileId = _tenantContext.ProfileId
        ?? throw new UnauthorizedException("No active profile in current token.");
    var profile = await _profiles.FindAsync(profileId, ct)
        ?? throw new UnauthorizedException("Attendant profile " + profileId + " was not found.");
```

Both branch on `profile_kind` claim: resident path resolves `ResidentCredential` (via the Residents-module resolver abstraction) instead of `AttendantProfile`.

### `JwtTokenService.cs` (MODIFY — resident claim variant)

**Target file; claim template to extend** (lines 22-52):

```csharp
// JwtTokenService.cs:22-52 — staff token today; resident variant adds credential_id + profile_kind,
// carries NO profile_id, NO permissions, NO apartment claim (locked).
public string GenerateAccessToken(Guid userId, Guid tenantId, Guid profileId, string roles, string permissions)
{
    ...
    var claims = new List<Claim>
    {
        new(JwtRegisteredClaimNames.Sub, userId.ToString()),
        new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        new("tenant_id", tenantId.ToString()),
        new("profile_id", profileId.ToString()),
    };
    foreach (var role in roles.Split(',', ...))
    {
        claims.Add(new Claim(ClaimTypes.Role, role));   // staff RequireRole policies read this
        claims.Add(new Claim("roles", role));
    }
    foreach (var perm in permissions.Split(',', ...))
        claims.Add(new Claim("permissions", perm));     // Permission_* policies read this
```

Signing config and 15-min TTL default (`Jwt:AccessTokenTtlMinutes`, line 30) are reused verbatim for the resident variant. `RefreshTokens.UserId` is a bare Guid keyed on users (lines 64-78) — the resident keying decision is RESEARCH Open Question 1 (`subject_kind` column in migration 0023 recommended).

### Bare-auth sweep (MODIFY — ~15 endpoint files)

**Target pattern (before → after):** every `Map*Endpoints` group currently built like `ResidentEndpoints.cs:16-18` / `VisitEndpoints.cs:15-17`:

```csharp
var group = app.MapGroup("/api/v1/visits").RequireAuthorization().WithTags("Visits");
// → becomes:
var group = app.MapGroup("/api/v1/visits").RequireAuthorization(StaffPolicies.Staff).WithTags("Visits");
```

Complete bare-site inventory (file + line): RESEARCH.md § Pattern 4 table (Visits :16, Reports :15/:69, Vehicles :17, Residents :17, Apartments :16, ServiceProviders :17, Administration :17, AccessControl :20/:191/:19/:12, Photos :19/:21/:16, Devices :17/:18/:14/:154/:17, Security :57/:84/:95/:98/:160/:186/:271/:279, Host FeatureEndpoints :14). Two semantic traps: (1) actor-bearing handlers (`VisitEndpoints.cs:50-53,63-64` reads `tenantContext.ProfileId`) need the staff-ROLE policy, not bare auth; (2) `/auth/change-password` (:57) and `/auth/session` (:279) need OR-semantics (`StaffPolicies.StaffOrResident` single custom requirement, not stacked requirements).

### `portal-access-modal.component.ts` (component, request-response)

**Analog:** `src/Web/ControlEasyReborn.Web/src/app/features/devices/components/device-form-modal.component.ts` — Phase 24 device-admin UI pattern, explicitly named in CONTEXT decisions.

**Component skeleton** (lines 46-57, 238-266):

```typescript
// device-form-modal.component.ts:46-50 + 238-266
@Component({
  selector: 'ce-device-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CeModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ce-modal [open]="open" [title]="..." size="md" (openChange)="onOpenChange($event)" (closed)="onCancelled()">
      <form [formGroup]="form" class="device-form" (ngSubmit)="onSubmit()">...</form>
    </ce-modal>`,
})
export class DeviceFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly devicesApi = inject(DevicesApiService);
  @Input() open = false;
  @Output() saved = new EventEmitter<DeviceDetail>();
  @Output() cancelled = new EventEmitter<void>();
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
```

**Submit + error pattern** (lines 356-414) — promise-wrapped API call, `getApiErrorMessage` for ProblemDetails bodies:

```typescript
// device-form-modal.component.ts:411-414
    } catch (err) {
      this.saving.set(false);
      this.errorMessage.set(getApiErrorMessage(err, 'Failed to save device.'));
    }
```

Modal import path: `../../../design-system/components/modal/modal.component` → `CeModalComponent` (line 22). The portal-access modal copies this shape (write-once password display in place of the JSON textarea; status/action buttons for suspend/reactivate/revoke).

### `residents-api.service.ts` (MODIFY — client service, request-response)

**Analog:** `src/Web/ControlEasyReborn.Web/src/app/features/residents/residents-api.service.ts` (self-extend) — handwritten `HttpClient` service, `providedIn: 'root'`:

```typescript
// residents-api.service.ts:41-70
@Injectable({ providedIn: 'root' })
export class ResidentsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/residents';
  create(request: CreateResidentRequest): Observable<ResidentResponse> {
    return this.http.post<ResidentResponse>(this.baseUrl, request);
  }
  update(id: string, request: UpdateResidentRequest): Observable<ResidentResponse> {
    return this.http.put<ResidentResponse>(`${this.baseUrl}/${id}`, request);
  }
```

Add portal-credential methods (provision/status/revoke/reset) in the same direct-HttpClient style — per `devices-api.service.ts:27-42` convention comment, handwritten services avoid the OpenAPI-generated internal services.

### Migration pair (migration, file-I/O)

**Analogs:** `docker/mysql/migrations/0022-gatehouse-lifecycle.sql` (idempotent live migration) + `docker/mysql/init/16-password-reset-requests.sql` (init CREATE TABLE with tenant column)

**Idempotent migration pattern** (0022, lines 4-14) — information_schema-guarded ALTER + index:

```sql
-- 0022-gatehouse-lifecycle.sql:4-7,11-14
SET @s = (SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Gatehouses' AND COLUMN_NAME = 'Active');
SET @sql = IF(@s IS NULL, 'ALTER TABLE Gatehouses ADD COLUMN ...', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx = (SELECT MAX(INDEX_NAME) FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Gatehouses' AND INDEX_NAME = 'IX_Gatehouses_tenant_active');
SET @sql = IF(@idx IS NULL, 'CREATE INDEX IX_Gatehouses_tenant_active ON Gatehouses (tenant_id, Active)', 'SELECT 1');
```

For a NEW table (ResidentCredentials) the init script is the primary pattern (16-....sql, lines 4-20):

```sql
-- 16-password-reset-requests.sql:4-20 — note the trailing `tenant_id CHAR(36) NOT NULL` column
CREATE TABLE IF NOT EXISTS PasswordResetRequests (
    Id CHAR(36) NOT NULL,
    TenantId CHAR(36) NOT NULL,
    NormalizedEmail VARCHAR(256) NOT NULL,
    HashedTempPassword VARCHAR(255) NOT NULL,     -- ← analogous column for PasswordHash
    DeliveryState VARCHAR(32) NOT NULL DEFAULT 'Pending',
    CreatedAtUtc DATETIME(6) NOT NULL,
    tenant_id CHAR(36) NOT NULL,
    PRIMARY KEY (Id),
    INDEX idx_pwreset_tenant_user (tenant_id, UserId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**MANDATORY same-commit companion:** add `ResidentCredentials` (and any `RefreshTokens.subject_kind`) to `docker/mysql/init/03-tenant-backfill.sql` as `-- ALTER TABLE ResidentCredentials ADD COLUMN tenant_id CHAR(36) NOT NULL;`-style entries (format at lines 7-21) — `SchemaBackfillSyncTests.cs:12-64` regex-scans every init `CREATE TABLE` and fails the build if the backfill entry is missing (only `Tenants`, `RefreshTokens`, `DemoMetadata`, `Migrations` are exempt).

### `ResidentSurfaceRulesTests.cs` (test, reflection)

**Analog:** `tests/ControlEasyReborn.ArchitectureTests/AccessControlTenantRulesTests.cs`

**Reflection + NetArchTest + FluentAssertions style** (lines 57-94, 105-112; helpers 24-55 assembly-load, 274-284 repo-root finder):

```csharp
// AccessControlTenantRulesTests.cs:60-94 — reflection rule with per-type failure collection
    var entityTypes = accessControlDomain!.GetTypes()
        .Where(t => t.Namespace?.EndsWith("Domain.Entities") == true && t.IsClass && !t.IsAbstract)
        .ToList();
    var failing = new List<string>();
    foreach (var type in entityTypes)
    {
        var tenantIdProp = type.GetProperty("TenantId", BindingFlags.Public | BindingFlags.Instance);
        if (tenantIdProp is null) { failing.Add($"{type.FullName}: missing TenantId property"); continue; }
        ...
    }
    failing.Should().BeEmpty($"every AccessControl entity must carry a non-nullable Guid TenantId property. Failures: {...}");

// :105-112 — NetArchTest rule
    var result = Types.InAssemblies(accessControlAssemblies)
        .ShouldNot().HaveDependencyOn("MySql.Data")
        .GetResult();
    result.IsSuccessful.Should().BeTrue(...);
```

Resident-surface rule 1 (RESEARCH Pattern 5): residents-module classes used by resident surfaces must depend on `ITenantAwareLinqFactory` — same per-type reflection over loaded Residents assemblies (reuse `EnsureAccessControlAssembliesLoaded` dll-walk, lines 24-55). Rule 2: unit test asserting `JwtTokenService` resident path emits no `apartment` claim.

### `ResidentPortalTests.cs` / `ResidentDenyMatrixTests.cs` (test, request-response)

**Analogs:** `tests/ControlEasyReborn.IntegrationTests/TenantAwareWebApplicationFactory.cs` + `JwtTestHelper.cs`

**Factory pattern** (TenantAwareWebApplicationFactory.cs, lines 8-17, 46-62, 95-114) — `WebApplicationFactory<Program>` base, pre-computed tenant Guids, Bearer-header client helpers, raw-SQL row seeding:

```csharp
// TenantAwareWebApplicationFactory.cs:46-62 — authed client helper (JWT via JwtTestHelper)
    _tenantAClient = CreateClient();
    var token = JwtTestHelper.GenerateTenantToken(..., TenantAId, roles: new[] { "Admin" }, permissions: TenantAdminPermissions);
    _tenantAClient.DefaultRequestHeaders.Authorization =
        new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
    return _tenantAClient;

// :95-114 — raw-SQL seed precedent (two-apartment fixture seeds Residents rows the same way)
    await using var cmd = new MySqlCommand(
        "INSERT INTO Apartments (Id, TenantId, Block, Unit, Active, CreatedAtUtc, tenant_id) VALUES (@id, @tid, @block, @unit, 1, UTC_TIMESTAMP(6), @tid)", conn);
```

**Token minting for tests** — `JwtTestHelper.GenerateToken` (lines 14-64) is claim-permissive (accepts arbitrary roles/permissions); extend it (or add a `GenerateResidentToken` overload mirroring `GenerateTenantToken`, lines 81-97) to emit `credential_id` + `profile_kind: "Resident"` claims so negative-suite and suspension-sequence tests can mint resident tokens **without re-login** (RESEARCH Pitfall 2: hold the HttpClient/token; suspend via a second TenantAdmin client; next request on the first client).

**Suspension sequence (RES-01) test shape:** provision → login → GET `/api/v1/auth/session` with resident token → suspend via TenantAdmin client → SAME token's next request must 403 with ProblemDetails body → reactivate → next request 200. Assert `application/problem+json` content type and no tenant-wide data in the body (locked decision).

---

## Shared Patterns

### Tenant-scoped data access (apply to repository, resolver, credential handlers)

**Source:** `ResidentRepository.cs:14-33` — `ITenantContext` (scoped) + `ITenantAwareLinqFactory` (singleton; DI lives at `src/BuildingBlocks/ControlEasyReborn.Infrastructure/Data/ServiceCollectionExtensions.cs:47-49`) → `_factory.Create(_ctx)` → parameterized `SelectAsync/InsertAsync/UpdateAsync`. Every `ResidentCredential` query routes through this; apartment predicates are hand-written — no interceptor net (RESEARCH Pattern 3).

### Uniform enumeration-safe credential denial (apply to login, refresh, forgot-password)

**Source:** `LoginHandler.cs:52` + `PasswordHasher.cs` (`WorkFactor = 11`) + decoy-hash precedent `ForgotPasswordHandler.cs:15,83-85`
**Rule:** ONE message `"Invalid email or password."` for unknown-email / wrong-password / inactive / suspended / revoked on the login flow (uniform 401, constant cost); `ForbiddenException`/403 ProblemDetails reserved for the per-request authorization pipeline.

### FluentValidation → aggregated ValidationException (apply to all new request handlers)

**Source:** `CreateResidentHandler.cs:28-34`
```csharp
if (!result.IsValid)
    throw new Errors.ValidationException(result.Errors
        .GroupBy(e => e.PropertyName)
        .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()));
```

### ProblemDetails RFC 7807 (apply to all new endpoints)

**Source:** `ResidentEndpoints.cs:102-113` module writer + `Program.cs:144-145` (`AddProblemDetails` + `AddExceptionHandler<GlobalExceptionHandler>`).
Resident-refusal assertions assert `type = "https://httpstatuses.io/403"`, `content-type: application/problem+json`, no data field.

### Policy registration + singleton IAuthorizationHandler (apply to Program.cs edits)

**Source:** `Program.cs:97-115`. Named policies in `AddAuthorization`; BOTH new handlers (`ResidentCredentialAuthorizationHandler`, and staff-role policies via `RequireRole`) registered here; the DB-reading handler MUST be `AddSingleton` and obtain scoped services via `context.Resource`'s `RequestServices` (RESEARCH Pitfall 1 — scoped registration kills integration tests at runtime).

### BCrypt ≥ 11 + refresh-token revocation on every credential mutation (apply to provisioning + reset + change-password)

**Sources:** `PasswordHasher.cs:8` (WorkFactor 11 const), `ResetUserPasswordHandler.cs:74-78,114` (generate/hash + `RevokeAllForUserAsync`).

---

## No Analog Found

| File | Role | Data Flow | Reason | Substitute Pattern |
|------|------|-----------|--------|--------------------|
| `ResidentCredentialRequirement.cs` / `ResidentCredentialAuthorizationHandler.cs` | authz middleware | request-response | No existing authorization handler reads the DB — both existing handlers are claim-only | Use `RequirePermissionAuthorizationHandler.cs` for shape; the `context.Resource is DefaultHttpContext http → http.RequestServices.GetRequiredService<ITenantContext>()` + per-request read shape comes from RESEARCH Pattern 2's recommended handler skeleton (singleton + request-scoped resolution) |
| `EndpointAuthorizationScanTests.cs` | test | endpoint-metadata reflection | No `EndpointDataSource`-based scan exists in `tests/ArchitectureTests` | Use RESEARCH Pattern 4's recommended scan code (factory `EndpointDataSource` → skip `IAllowAnonymous` endpoints → assert no `IAuthorizeData` with empty `Policy`); file-scan/assert-with-listing style from `SchemaBackfillSyncTests.cs:12-64` |
| `ResidentCredentialResolver` (cross-module seam consumed by Security handlers) | abstraction | request-response | No module-module login-time credential resolver exists | Interface in Residents `Application/Abstractions` + implementation over `IResidentCredentialRepository` + `ResidentRepository`; Security handlers get it injected via the abstraction (Clean-Architecture layering per `AccessControlTenantRulesTests.cs` owner-module port precedent, `IResidentDirectory`) |

---

## Metadata

**Analog search scope:** `src/Modules/{Residents,Security,Visits,Reports,Vehicles,Apartments,ServiceProviders,Administration,AccessControl,Photos,Devices,Tenants}`, `src/Host/ControlEasyReborn.Api`, `src/BuildingBlocks/*/**/Data`, `src/Web/ControlEasyReborn.Web/src/app/features/{devices,residents}`, `tests/ControlEasyReborn.{Architecture,Integration}Tests`, `docker/mysql/{init,migrations}`
**Files scanned:** 14 read in full or targeted slices; 12 additional inventoried via glob/grep (bare-auth sites per RESEARCH Pattern 4 table)
**Tracked-source gate:** all named analogs verified under `git ls-files` (134 tracked hits across the analog trees)
**Pattern extraction date:** 2026-10-15