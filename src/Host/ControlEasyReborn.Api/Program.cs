using ControlEasyReborn.Api.Hosting;
using ControlEasyReborn.Infrastructure.Data;
using ControlEasyReborn.Infrastructure.Storage;
using ControlEasyReborn.Infrastructure.Bootstrap;
using ControlEasyReborn.Infrastructure.Demo;
using ControlEasyReborn.Infrastructure.Email;
using ControlEasyReborn.Infrastructure.MultiTenancy;
using ControlEasyReborn.Modules.Apartments.Api.Endpoints;
using ControlEasyReborn.Modules.Apartments.Infrastructure.DI;
using ControlEasyReborn.Modules.Administration.Api.Endpoints;
using ControlEasyReborn.Modules.Administration.Api.DI;
using ControlEasyReborn.Modules.Administration.Infrastructure.DI;
using ControlEasyReborn.Modules.Residents.Api.Endpoints;
using ControlEasyReborn.Modules.Residents.Infrastructure.DI;
using ControlEasyReborn.Modules.Security.Api.Auth;
using ControlEasyReborn.Modules.Security.Api.DI;
using ControlEasyReborn.Modules.Security.Api.Endpoints;
using ControlEasyReborn.Modules.Security.Infrastructure.DI;
using ControlEasyReborn.Modules.ServiceProviders.Api.DI;
using ControlEasyReborn.Modules.ServiceProviders.Api.Endpoints;
using ControlEasyReborn.Modules.ServiceProviders.Infrastructure.DI;
using ControlEasyReborn.Modules.Tenants.Api.Auth;
using ControlEasyReborn.Modules.Tenants.Api.Endpoints;
using ControlEasyReborn.Modules.Tenants.Infrastructure.DI;
using ControlEasyReborn.Modules.Vehicles.Api.DI;
using ControlEasyReborn.Modules.Vehicles.Api.Endpoints;
using ControlEasyReborn.Modules.Vehicles.Infrastructure.DI;
using ControlEasyReborn.Modules.Reports.Api.DI;
using ControlEasyReborn.Modules.Reports.Infrastructure.DI;
using ControlEasyReborn.Modules.Visits.Api.Endpoints;
using ControlEasyReborn.Modules.Visits.Api.DI;
using ControlEasyReborn.Modules.Visits.Infrastructure.DI;
using ControlEasyReborn.Modules.Photos.Api.DI;
using ControlEasyReborn.Modules.Photos.Api.Endpoints;
using ControlEasyReborn.Modules.Photos.Infrastructure.DI;
using ControlEasyReborn.Modules.AccessControl.Api.Endpoints;
using ControlEasyReborn.Modules.AccessControl.Infrastructure.DI;
using ControlEasyReborn.Modules.Devices.Api.Endpoints;
using ControlEasyReborn.Modules.Devices.Infrastructure.DI;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Microsoft.FeatureManagement;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(new ConfigurationBuilder()
        .SetBasePath(Directory.GetCurrentDirectory())
        .AddJsonFile("appsettings.json", optional: true, reloadOnChange: true)
        .AddJsonFile($"appsettings.{Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production"}.json", optional: true, reloadOnChange: true)
        .Build())
    .Enrich.FromLogContext()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    builder.WebHost.ConfigureKestrel(options =>
    {
        options.Limits.MaxRequestBodySize = PhotosEndpoints.MaxRequestSizeBytes;
    });
    builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
    {
        options.MultipartBodyLengthLimit = PhotosEndpoints.MaxRequestSizeBytes;
    });
    builder.Services.ConfigureHttpJsonOptions(options =>
    {
        options.SerializerOptions.Converters.Add(new UtcDateTimeJsonConverter());
    });

    builder.Host.UseSerilog((context, services, loggerConfig) =>
    {
        loggerConfig.ReadFrom.Configuration(context.Configuration);
    });

    builder.Services.AddControlEasyDbTools(builder.Configuration);
    builder.Services.AddControlEasyStorage(builder.Configuration);
    builder.Services.AddEmailInfrastructure(builder.Configuration);

    builder.Services.AddAuthentication()
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = builder.Configuration["Jwt:Issuer"],
                ValidAudience = builder.Configuration["Jwt:Audience"],
                IssuerSigningKey = new Microsoft.IdentityModel.Tokens.SymmetricSecurityKey(
                    System.Text.Encoding.UTF8.GetBytes(builder.Configuration["Jwt:SigningKey"] ?? throw new InvalidOperationException("Jwt:SigningKey is not configured.")))
            };
        });

    builder.Services.AddAuthorization(options =>
    {
        options.AddPolicy(PlatformAdminRequirement.PolicyName, policy =>
            policy.Requirements.Add(new PlatformAdminRequirement()));

        foreach (var permission in ControlEasyReborn.Modules.Security.Application.Permissions.All)
        {
            options.AddPolicy("Permission_" + permission, policy =>
                policy.Requirements.Add(new RequirePermissionRequirement(permission)));
        }

        foreach (var permission in ControlEasyReborn.Modules.Devices.Application.Permissions.DevicePermissions.All)
        {
            options.AddPolicy("Permission_" + permission, policy =>
                policy.Requirements.Add(new RequirePermissionRequirement(permission)));
        }
    });
    builder.Services.AddSingleton<Microsoft.AspNetCore.Authorization.IAuthorizationHandler, PlatformAdminAuthorizationHandler>();
    builder.Services.AddSingleton<Microsoft.AspNetCore.Authorization.IAuthorizationHandler, RequirePermissionAuthorizationHandler>();

    builder.Services.AddEndpointsApiExplorer();
    builder.Services.AddSwaggerGen(options =>
    {
        options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
        {
            Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
            Name = "Authorization",
            In = Microsoft.OpenApi.Models.ParameterLocation.Header,
            Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
            Scheme = "Bearer"
        });
        options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
        {
            {
                new Microsoft.OpenApi.Models.OpenApiSecurityScheme
                {
                    Reference = new Microsoft.OpenApi.Models.OpenApiReference
                    {
                        Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                        Id = "Bearer"
                    }
                },
                Array.Empty<string>()
            }
        });
    });

    builder.Services.AddProblemDetails();
    builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

    builder.Services.AddHealthChecks()
        .AddCheck<DbToolsHealthCheck>("database");

    builder.Services.AddFeatureManagement();

    builder.Services.AddTenantsModule();
    builder.Services.AddApartmentsModule();
    builder.Services.AddResidentsModule();
    builder.Services.AddSecurityModule();
    builder.Services.AddAdministrationModule();
    builder.Services.AddServiceProvidersModule();
    builder.Services.AddVehiclesModule();
    builder.Services.AddVisitsModule();
    builder.Services.AddReportsModule();
    builder.Services.AddPhotosModule();
    builder.Services.AddAccessControlModule();
    builder.Services.AddDevicesModule();
    builder.Services.AddDevicesSimulatorInspector();

    builder.Services.AddControlEasyDemo(builder.Configuration);
    builder.Services.AddControlEasyBootstrap(builder.Configuration);
    if (DemoHostingExtensions.ShouldRegisterPlatformAdminBootstrap(builder.Configuration)
        && BootstrapHostingExtensions.ShouldRunPlatformAdminBootstrap(builder.Configuration))
    {
        builder.Services.AddHostedService<PlatformAdminBootstrapService>();
    }

    builder.Services.AddCors(options =>
    {
        options.AddPolicy("AngularDev", policy =>
        {
            policy.WithOrigins("http://localhost:4200", "https://localhost:8443")
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials()
                .WithExposedHeaders("X-Total-Count");
        });
    });

    builder.Services.AddRateLimiter(options =>
    {
        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
        options.AddPolicy("forgot-password", httpContext =>
        {
            string partitionKey;
            if (httpContext.Items.TryGetValue("ForgotPasswordEmail", out var val) && val is string email && !string.IsNullOrWhiteSpace(email))
            {
                partitionKey = email;
            }
            else if (httpContext.Request.Headers.TryGetValue("X-Reset-Email", out var headerEmail) && !string.IsNullOrWhiteSpace(headerEmail))
            {
                partitionKey = headerEmail.ToString().Trim().ToUpperInvariant();
            }
            else
            {
                partitionKey = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            }

            return RateLimitPartition.GetFixedWindowLimiter(
                partitionKey,
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 3,
                    Window = TimeSpan.FromMinutes(15),
                    QueueLimit = 0
                });
        });
    });

    var app = builder.Build();

    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();
    }

    app.UseExceptionHandler();
    app.UseSerilogRequestLogging();

    app.UseCors("AngularDev");

    app.Use(async (context, next) =>
    {
        if (context.Request.Path.StartsWithSegments("/api/v1/security/auth/forgot-password", StringComparison.OrdinalIgnoreCase)
            && HttpMethods.IsPost(context.Request.Method))
        {
            context.Request.EnableBuffering();
            using var reader = new System.IO.StreamReader(context.Request.Body, System.Text.Encoding.UTF8, leaveOpen: true);
            var body = await reader.ReadToEndAsync();
            context.Request.Body.Position = 0;
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(body);
                if (doc.RootElement.TryGetProperty("email", out var emailProp))
                {
                    var email = emailProp.GetString();
                    if (!string.IsNullOrWhiteSpace(email))
                    {
                        context.Items["ForgotPasswordEmail"] = email.Trim().ToUpperInvariant();
                    }
                }
            }
            catch { }
        }
        await next();
    });

    app.UseRateLimiter();

    app.UseAuthentication();
    app.UseMiddleware<TenantResolutionMiddleware>();
    app.UseAuthorization();

    app.MapHealthChecks("/health");
    app.MapHealthChecks("/api/v1/health");
    app.MapDemoEndpoints();
    app.MapBootstrapEndpoints();
    app.MapFeatureEndpoints();
    app.MapTenantEndpoints();
    app.MapTenantBackupEndpoints();
    app.MapApartmentEndpoints();
    app.MapResidentEndpoints();
    app.MapSecurityApi();
    app.MapServiceProvidersApi();
    app.MapVehiclesApi();
    app.MapVisitsApi();
    app.MapReportsApi();
    app.MapAdministrationApi();
    app.MapPhotosApi();
    app.MapAccessControlApi();
    app.MapDevicesEndpoints();
    app.MapTenantDoorIntegrationEndpoints();
    app.MapSimulatorInspectorEndpoints();
    app.MapDeviceEventEndpoints();

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly.");
    throw;
}
finally
{
    Log.CloseAndFlush();
}

public sealed class GlobalExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        Microsoft.AspNetCore.Http.HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var (status, title) = exception switch
        {
            ControlEasyReborn.Modules.Tenants.Application.Errors.NotFoundException => (StatusCodes.Status404NotFound, "Not found"),
            ControlEasyReborn.Modules.Tenants.Application.Errors.ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
            ControlEasyReborn.Modules.Tenants.Application.Errors.ValidationException => (StatusCodes.Status400BadRequest, "Validation failed"),
            ControlEasyReborn.Modules.Apartments.Application.Errors.NotFoundException => (StatusCodes.Status404NotFound, "Not found"),
            ControlEasyReborn.Modules.Apartments.Application.Errors.ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
            ControlEasyReborn.Modules.Apartments.Application.Errors.ValidationException => (StatusCodes.Status400BadRequest, "Validation failed"),
            ControlEasyReborn.Modules.Residents.Application.Errors.NotFoundException => (StatusCodes.Status404NotFound, "Not found"),
            ControlEasyReborn.Modules.Residents.Application.Errors.ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
            ControlEasyReborn.Modules.Residents.Application.Errors.ValidationException => (StatusCodes.Status400BadRequest, "Validation failed"),
            ControlEasyReborn.Modules.Security.Application.Errors.NotFoundException => (StatusCodes.Status404NotFound, "Not found"),
            ControlEasyReborn.Modules.Security.Application.Errors.ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
            ControlEasyReborn.Modules.Security.Application.Errors.ValidationException => (StatusCodes.Status400BadRequest, "Validation failed"),
            ControlEasyReborn.Modules.Security.Application.Errors.UnauthorizedException => (StatusCodes.Status401Unauthorized, "Unauthorized"),
            ControlEasyReborn.Modules.Security.Application.Errors.ForbiddenException => (StatusCodes.Status403Forbidden, "Forbidden"),
            ControlEasyReborn.Modules.ServiceProviders.Application.Errors.NotFoundException => (StatusCodes.Status404NotFound, "Not found"),
            ControlEasyReborn.Modules.ServiceProviders.Application.Errors.ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
            ControlEasyReborn.Modules.ServiceProviders.Application.Errors.ValidationException => (StatusCodes.Status400BadRequest, "Validation failed"),
            ControlEasyReborn.Modules.Vehicles.Application.Errors.NotFoundException => (StatusCodes.Status404NotFound, "Not found"),
            ControlEasyReborn.Modules.Vehicles.Application.Errors.ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
            ControlEasyReborn.Modules.Vehicles.Application.Errors.ValidationException => (StatusCodes.Status400BadRequest, "Validation failed"),
            ControlEasyReborn.Modules.Visits.Application.Errors.NotFoundException => (StatusCodes.Status404NotFound, "Not found"),
            ControlEasyReborn.Modules.Visits.Application.Errors.ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
            ControlEasyReborn.Modules.Visits.Application.Errors.ValidationException => (StatusCodes.Status400BadRequest, "Validation failed"),
            ControlEasyReborn.Modules.Photos.Application.Errors.NotFoundException => (StatusCodes.Status404NotFound, "Not found"),
            ControlEasyReborn.Modules.Photos.Application.Errors.ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
            ControlEasyReborn.Modules.Photos.Application.Errors.ValidationException => (StatusCodes.Status400BadRequest, "Validation failed"),
            ControlEasyReborn.Modules.Administration.Application.Errors.NotFoundException => (StatusCodes.Status404NotFound, "Not found"),
            ControlEasyReborn.Modules.Administration.Application.Errors.ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
            ControlEasyReborn.Modules.Administration.Application.Errors.ValidationException => (StatusCodes.Status400BadRequest, "Validation failed"),
            ControlEasyReborn.Modules.AccessControl.Application.Errors.NotFoundException => (StatusCodes.Status404NotFound, "Not found"),
            ControlEasyReborn.Modules.AccessControl.Application.Errors.ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
            ControlEasyReborn.Modules.AccessControl.Application.Errors.ValidationException => (StatusCodes.Status400BadRequest, "Validation failed"),
            ControlEasyReborn.Modules.AccessControl.Domain.Errors.CredentialAlreadyActiveException => (StatusCodes.Status409Conflict, "Credential already active"),
            ControlEasyReborn.Modules.AccessControl.Domain.Errors.CredentialLifecycleConflictException => (StatusCodes.Status409Conflict, "Credential lifecycle conflict"),
            ControlEasyReborn.Modules.Devices.Application.Errors.NotFoundException => (StatusCodes.Status404NotFound, "Not found"),
            ControlEasyReborn.Modules.Devices.Application.Errors.ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
            ControlEasyReborn.Modules.Devices.Application.Errors.ValidationException => (StatusCodes.Status400BadRequest, "Validation failed"),
            _ => (StatusCodes.Status500InternalServerError, "An unexpected error occurred")
        };

        if (status == StatusCodes.Status500InternalServerError)
            return false;

        var problemDetails = new Microsoft.AspNetCore.Mvc.ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = exception.Message,
            Type = "https://httpstatuses.io/" + status
        };

        if (exception is ControlEasyReborn.Modules.Tenants.Application.Errors.ValidationException tenValEx)
        {
            problemDetails.Extensions["errors"] = tenValEx.Errors;
        }
        else if (exception is ControlEasyReborn.Modules.Apartments.Application.Errors.ValidationException aptValEx)
        {
            problemDetails.Extensions["errors"] = aptValEx.Errors;
        }
        else if (exception is ControlEasyReborn.Modules.Residents.Application.Errors.ValidationException resValEx)
        {
            problemDetails.Extensions["errors"] = resValEx.Errors;
        }
        else if (exception is ControlEasyReborn.Modules.Security.Application.Errors.ValidationException secValEx)
        {
            problemDetails.Extensions["errors"] = secValEx.Errors;
        }
        else if (exception is ControlEasyReborn.Modules.Administration.Application.Errors.ValidationException admValEx)
        {
            problemDetails.Extensions["errors"] = admValEx.Errors;
        }
        else if (exception is ControlEasyReborn.Modules.ServiceProviders.Application.Errors.ValidationException spValEx)
        {
            problemDetails.Extensions["errors"] = spValEx.Errors;
        }
        else if (exception is ControlEasyReborn.Modules.Vehicles.Application.Errors.ValidationException vehValEx)
        {
            problemDetails.Extensions["errors"] = vehValEx.Errors;
        }
        else if (exception is ControlEasyReborn.Modules.Visits.Application.Errors.ValidationException visValEx)
        {
            problemDetails.Extensions["errors"] = visValEx.Errors;
        }
        else if (exception is ControlEasyReborn.Modules.Photos.Application.Errors.ValidationException phoValEx)
        {
            problemDetails.Extensions["errors"] = phoValEx.Errors;
        }
        else if (exception is ControlEasyReborn.Modules.AccessControl.Application.Errors.ValidationException acValEx)
        {
            problemDetails.Extensions["errors"] = acValEx.Errors;
        }
        else if (exception is ControlEasyReborn.Modules.Devices.Application.Errors.ValidationException devValEx)
        {
            problemDetails.Extensions["errors"] = devValEx.Errors;
        }

        httpContext.Response.StatusCode = status;
        await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);
        return true;
    }
}
