using ControlEasyReborn.Modules.Security.Application.Abstractions;
using ControlEasyReborn.Modules.Security.Application.Contracts;
using ControlEasyReborn.Modules.Security.Application.Errors;
using ControlEasyReborn.Modules.Security.Domain.Entities;
using ControlEasyReborn.SharedKernel.Email;
using ControlEasyReborn.SharedKernel.MultiTenancy;
using Microsoft.Extensions.Logging;

namespace ControlEasyReborn.Modules.Security.Application.Handlers;

public sealed class ResetUserPasswordHandler
{
    private readonly IUserRepository _users;
    private readonly IPasswordResetRequestRepository _passwordResetRequests;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITempPasswordGenerator _tempPasswordGenerator;
    private readonly IEmailSender _emailSender;
    private readonly ITenantContext _tenantContext;
    private readonly ILogger<ResetUserPasswordHandler> _logger;

    public ResetUserPasswordHandler(
        IUserRepository users,
        IPasswordResetRequestRepository passwordResetRequests,
        IRefreshTokenRepository refreshTokenRepository,
        IPasswordHasher passwordHasher,
        ITempPasswordGenerator tempPasswordGenerator,
        IEmailSender emailSender,
        ITenantContext tenantContext,
        ILogger<ResetUserPasswordHandler> logger)
    {
        _users = users;
        _passwordResetRequests = passwordResetRequests;
        _refreshTokenRepository = refreshTokenRepository;
        _passwordHasher = passwordHasher;
        _tempPasswordGenerator = tempPasswordGenerator;
        _emailSender = emailSender;
        _tenantContext = tenantContext;
        _logger = logger;
    }

    public async Task<ResetUserPasswordResponse> HandleAsync(Guid userId, CancellationToken ct)
    {
        var isPlatformAdmin = _tenantContext.IsPlatformAdmin || _tenantContext.Roles.Contains("PlatformAdmin");
        var isTenantAdmin = _tenantContext.Roles.Contains("TenantAdmin");

        if (!isPlatformAdmin && !isTenantAdmin)
        {
            throw new ForbiddenException("Insufficient permissions to reset user passwords.");
        }

        var targetUser = await _users.FindAsync(userId, ct);
        if (targetUser is null)
        {
            throw new NotFoundException($"User {userId} was not found.");
        }

        if (isTenantAdmin && !isPlatformAdmin)
        {
            if (targetUser.TenantId != _tenantContext.TenantId)
            {
                throw new ForbiddenException("Cannot reset user password for another condominium.");
            }

            var roles = targetUser.Roles.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            var isTargetStaff = roles.Contains("TenantAdmin", StringComparer.OrdinalIgnoreCase)
                                || roles.Contains("Porteiro", StringComparer.OrdinalIgnoreCase);
            if (!isTargetStaff)
            {
                throw new ForbiddenException("Tenant admins can only reset other staff passwords.");
            }
        }

        var tempPassword = _tempPasswordGenerator.Generate(12);
        var hashedTempPassword = _passwordHasher.Hash(tempPassword);

        targetUser.ResetPassword(hashedTempPassword);
        await _users.UpdateAsync(targetUser, ct);

        var resetRequest = new PasswordResetRequest(
            id: Guid.NewGuid(),
            tenantId: targetUser.TenantId,
            userId: targetUser.Id,
            normalizedEmail: targetUser.Email.ToUpperInvariant(),
            hashedTempPassword: hashedTempPassword,
            deliveryState: "Pending",
            failureReason: null,
            requestedByUserId: _tenantContext.ProfileId,
            createdAtUtc: DateTime.UtcNow,
            deliveredAtUtc: null,
            expiresAtUtc: DateTime.UtcNow.AddHours(24));

        await _passwordResetRequests.AddAsync(resetRequest, ct);

        try
        {
            await _emailSender.SendEmailAsync(
                toEmail: targetUser.Email,
                toName: targetUser.DisplayName ?? targetUser.Email,
                subject: "ControlEasy - Recuperação de Senha",
                bodyHtml: $"<p>Olá, {targetUser.DisplayName ?? targetUser.Email}.</p><p>Sua senha temporária de acesso é: <strong>{tempPassword}</strong></p><p>Ela expira em 24 horas. Ao acessar, você será solicitado a definir uma nova senha.</p>",
                ct: ct);

            resetRequest.MarkSent();
            await _passwordResetRequests.UpdateAsync(resetRequest, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to deliver temporary password email to {Email}", targetUser.Email);
            resetRequest.MarkFailed(ex.Message);
            await _passwordResetRequests.UpdateAsync(resetRequest, ct);
        }

        await _refreshTokenRepository.RevokeAllForUserAsync(targetUser.Id, ct);

        _logger.LogInformation(
            "Administrative password reset completed for user {UserId} in tenant {TenantId} by actor profile {ActorProfileId}; delivery state {DeliveryState}",
            targetUser.Id,
            targetUser.TenantId,
            _tenantContext.ProfileId,
            resetRequest.DeliveryState);

        return new ResetUserPasswordResponse(targetUser.Id, true, resetRequest.DeliveryState);
    }
}