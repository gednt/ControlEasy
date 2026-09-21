using ControlEasyReborn.Modules.Security.Application.Abstractions;
using ControlEasyReborn.Modules.Security.Application.Contracts;
using ControlEasyReborn.Modules.Security.Application.Errors;
using ControlEasyReborn.Modules.Security.Domain.Entities;
using ControlEasyReborn.SharedKernel.Email;
using FluentValidation;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using SecurityValidationException = ControlEasyReborn.Modules.Security.Application.Errors.ValidationException;

namespace ControlEasyReborn.Modules.Security.Application.Handlers;

public sealed class ForgotPasswordHandler
{
    private static readonly string DecoyHash = BCrypt.Net.BCrypt.HashPassword("DecoyDummyPassword123!", workFactor: 11);
    private const string UniformResponseMessage = "If an account matches that email, instructions have been sent.";

    private readonly IUserRepository _users;
    private readonly IPasswordResetRequestRepository _passwordResetRequests;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ITempPasswordGenerator _tempPasswordGenerator;
    private readonly IEmailSender _emailSender;
    private readonly IMemoryCache _memoryCache;
    private readonly IValidator<ForgotPasswordRequest> _validator;
    private readonly ILogger<ForgotPasswordHandler> _logger;

    public ForgotPasswordHandler(
        IUserRepository users,
        IPasswordResetRequestRepository passwordResetRequests,
        IRefreshTokenRepository refreshTokenRepository,
        IPasswordHasher passwordHasher,
        ITempPasswordGenerator tempPasswordGenerator,
        IEmailSender emailSender,
        IMemoryCache memoryCache,
        IValidator<ForgotPasswordRequest> validator,
        ILogger<ForgotPasswordHandler> logger)
    {
        _users = users;
        _passwordResetRequests = passwordResetRequests;
        _refreshTokenRepository = refreshTokenRepository;
        _passwordHasher = passwordHasher;
        _tempPasswordGenerator = tempPasswordGenerator;
        _emailSender = emailSender;
        _memoryCache = memoryCache;
        _validator = validator;
        _logger = logger;
    }

    public async Task<ForgotPasswordResponse> HandleAsync(ForgotPasswordRequest request, CancellationToken ct)
    {
        var validationResult = await _validator.ValidateAsync(request, ct);
        if (!validationResult.IsValid)
        {
            throw new SecurityValidationException(validationResult.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()));
        }

        var normalizedEmail = request.Email.Trim().ToUpperInvariant();

        // PASS-04: Accounts are never locked out in response to reset floods.
        // If requests exceed threshold within 15 minutes, suppress further password modification.
        var recentCount = await _passwordResetRequests.CountRecentRequestsAsync(normalizedEmail, DateTime.UtcNow.AddMinutes(-15), ct);
        if (recentCount >= 5)
        {
            _logger.LogWarning("Password reset flood detected for {Email}. Suppressing further reset operations.", normalizedEmail);
            return new ForgotPasswordResponse(UniformResponseMessage);
        }

        var user = await _users.FindByEmailAsync(normalizedEmail, ct);

        var isEligibleAdmin = false;
        if (user != null && user.Active)
        {
            var roles = user.Roles.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
            isEligibleAdmin = roles.Contains("PlatformAdmin", StringComparer.OrdinalIgnoreCase) ||
                              roles.Contains("TenantAdmin", StringComparer.OrdinalIgnoreCase);
        }

        if (!isEligibleAdmin || user == null)
        {
            // PASS-01: Constant-time decoy verification on email miss or non-admin account to prevent timing attacks
            _passwordHasher.Verify("DecoyDummyPassword123!", DecoyHash);
            return new ForgotPasswordResponse(UniformResponseMessage);
        }

        var cacheKey = $"temp_pwd:{normalizedEmail}";

        // PASS-04: Idempotent resend re-delivers same active temporary password if requested within 15 minutes
        if (_memoryCache.TryGetValue<string>(cacheKey, out var existingTempPassword) && !string.IsNullOrEmpty(existingTempPassword))
        {
            try
            {
                await _emailSender.SendEmailAsync(
                    toEmail: user.Email,
                    toName: user.DisplayName ?? user.Email,
                    subject: "ControlEasy - Recuperação de Senha",
                    bodyHtml: $"<p>Olá, {user.DisplayName ?? user.Email}.</p><p>Sua senha temporária de acesso é: <strong>{existingTempPassword}</strong></p><p>Ela expira em 24 horas. Ao acessar, você será solicitado a definir uma nova senha.</p>",
                    ct: ct);

                var resendRecord = new PasswordResetRequest(
                    id: Guid.NewGuid(),
                    tenantId: user.TenantId,
                    userId: user.Id,
                    normalizedEmail: normalizedEmail,
                    hashedTempPassword: user.PasswordHash,
                    deliveryState: "Sent",
                    failureReason: null,
                    requestedByUserId: null,
                    createdAtUtc: DateTime.UtcNow,
                    deliveredAtUtc: DateTime.UtcNow,
                    expiresAtUtc: DateTime.UtcNow.AddHours(24));

                await _passwordResetRequests.AddAsync(resendRecord, ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to resend temporary password email to {Email}", normalizedEmail);
            }

            return new ForgotPasswordResponse(UniformResponseMessage);
        }

        // Generate new temporary password (unambiguous charset, >= 12 chars)
        var tempPassword = _tempPasswordGenerator.Generate(12);
        _memoryCache.Set(cacheKey, tempPassword, TimeSpan.FromMinutes(15));

        var hashedTempPassword = _passwordHasher.Hash(tempPassword);
        user.ResetPassword(hashedTempPassword);
        await _users.UpdateAsync(user, ct);

        await _refreshTokenRepository.RevokeAllForUserAsync(user.Id, ct);

        var resetRequest = new PasswordResetRequest(
            id: Guid.NewGuid(),
            tenantId: user.TenantId,
            userId: user.Id,
            normalizedEmail: normalizedEmail,
            hashedTempPassword: hashedTempPassword,
            deliveryState: "Pending",
            failureReason: null,
            requestedByUserId: null,
            createdAtUtc: DateTime.UtcNow,
            deliveredAtUtc: null,
            expiresAtUtc: DateTime.UtcNow.AddHours(24));

        await _passwordResetRequests.AddAsync(resetRequest, ct);

        try
        {
            await _emailSender.SendEmailAsync(
                toEmail: user.Email,
                toName: user.DisplayName ?? user.Email,
                subject: "ControlEasy - Recuperação de Senha",
                bodyHtml: $"<p>Olá, {user.DisplayName ?? user.Email}.</p><p>Sua senha temporária de acesso é: <strong>{tempPassword}</strong></p><p>Ela expira em 24 horas. Ao acessar, você será solicitado a definir uma nova senha.</p>",
                ct: ct);

            resetRequest.MarkSent();
            await _passwordResetRequests.UpdateAsync(resetRequest, ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to deliver temporary password email to {Email}", normalizedEmail);
            resetRequest.MarkFailed(ex.Message);
            await _passwordResetRequests.UpdateAsync(resetRequest, ct);
        }

        return new ForgotPasswordResponse(UniformResponseMessage);
    }
}
