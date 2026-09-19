using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.Security.Application.Abstractions;
using ControlEasyReborn.Modules.Security.Application.Contracts;
using ControlEasyReborn.Modules.Security.Application.Handlers;
using ControlEasyReborn.Modules.Security.Application.Validators;
using ControlEasyReborn.Modules.Security.Infrastructure.Persistence;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace ControlEasyReborn.Modules.Security.Infrastructure.DI;

public static class SecurityModuleServiceCollectionExtensions
{
    public static IServiceCollection AddSecurityModule(this IServiceCollection services)
    {
        services.TryAddScoped<ITenantContext, HttpTenantContext>();
        services.AddSingleton<TenantAwareLinqFactory>();
        services.AddSingleton<ITenantAwareLinqFactory>(sp => sp.GetRequiredService<TenantAwareLinqFactory>());

        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IAttendantProfileRepository, AttendantProfileRepository>();
        services.AddScoped<IShiftRepository, ShiftRepository>();
        services.AddScoped<IGatehouseRepository, GatehouseRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();
        services.AddScoped<IPasswordHasher, PasswordHasher>();
        services.AddScoped<ITempPasswordGenerator, TempPasswordGenerator>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();
        services.AddScoped<IPasswordResetRequestRepository, PasswordResetRequestRepository>();

        services.AddScoped<LoginHandler>();
        services.AddScoped<ResetUserPasswordHandler>();
        services.AddScoped<RefreshHandler>();
        services.AddScoped<ChangePasswordHandler>();
        services.AddScoped<CreateUserHandler>();
        services.AddScoped<CreateAttendantProfileHandler>();
        services.AddScoped<GetAttendantProfileHandler>();
        services.AddScoped<ListAttendantProfilesHandler>();
        services.AddScoped<UpdateAttendantProfileHandler>();
        services.AddScoped<DeactivateAttendantProfileHandler>();
        services.AddScoped<GetMyProfileHandler>();
        services.AddScoped<CreateShiftHandler>();
        services.AddScoped<ListShiftsHandler>();
        services.AddScoped<CreateGatehouseHandler>();
        services.AddScoped<ListGatehousesHandler>();
        services.AddScoped<TenantLookupHandler>();
        services.AddScoped<TenantSwitchHandler>();
        services.AddScoped<GetSessionHandler>();

        services.AddScoped<IValidator<CreateUserRequest>, CreateUserRequestValidator>();
        services.AddScoped<IValidator<LoginRequest>, LoginRequestValidator>();
        services.AddScoped<IValidator<ChangePasswordRequest>, ChangePasswordRequestValidator>();
        services.AddScoped<IValidator<CreateAttendantProfileRequest>, CreateAttendantProfileRequestValidator>();
        services.AddScoped<IValidator<UpdateAttendantProfileRequest>, UpdateAttendantProfileRequestValidator>();
        services.AddScoped<IValidator<CreateShiftRequest>, CreateShiftRequestValidator>();
        services.AddScoped<IValidator<CreateGatehouseRequest>, CreateGatehouseRequestValidator>();
        services.AddScoped<IValidator<RefreshRequest>, RefreshRequestValidator>();

        return services;
    }
}