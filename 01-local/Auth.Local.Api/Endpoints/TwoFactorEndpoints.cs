using System.Security.Claims;
using Auth.Local.Api.Auth;
using Auth.Local.Api.Contracts;
using Auth.Local.Api.Data;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Auth.Local.Api.Endpoints;

public static class TwoFactorEndpoints
{
    public static IEndpointRouteBuilder MapTwoFactorEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth/2fa");

        // setup y enable exigen una sesión completa (política por defecto).
        group.MapPost("/setup", Setup).RequireAuthorization();
        group.MapPost("/enable", Enable).RequireAuthorization();

        // verify es anónimo: quien llega aquí aún NO tiene access token, solo el tempToken.
        group.MapPost("/verify", Verify)
            .RequireRateLimiting(RateLimitPolicies.TwoFactor);

        return app;
    }

    // POST /api/auth/2fa/setup  -> genera el secreto y la URI para el QR
    private static async Task<IResult> Setup(ClaimsPrincipal principal, AppDbContext db)
    {
        var user = await db.Users.FindAsync(GetUserId(principal));
        if (user is null)
            return Results.Unauthorized();
        if (user.TwoFactorEnabled)
            return Results.Conflict(new { message = "El 2FA ya está activado." });

        // IMPORTANTE: en producción el TotpSecret debe guardarse CIFRADO
        // (p. ej. con la Data Protection API: IDataProtector.Protect/Unprotect).
        // Si alguien roba la BD con los secretos en claro, puede generar los códigos.
        // Aquí lo dejamos en Base32 legible para poder mostrarlo en clase.
        user.TotpSecret = TotpHelper.GenerateSecret();
        await db.SaveChangesAsync();

        return Results.Ok(new
        {
            secret = user.TotpSecret,
            otpauthUri = TotpHelper.BuildOtpAuthUri(user.Email, user.TotpSecret),
        });
    }

    // POST /api/auth/2fa/enable  -> confirma que la app autenticadora quedó bien configurada
    private static async Task<IResult> Enable(TwoFactorCodeRequest request, ClaimsPrincipal principal, AppDbContext db)
    {
        var user = await db.Users.FindAsync(GetUserId(principal));
        if (user is null)
            return Results.Unauthorized();
        if (user.TotpSecret is null)
            return Results.BadRequest(new { message = "Primero llama a /api/auth/2fa/setup." });

        // Solo activamos el 2FA si el usuario demuestra que su app genera códigos válidos;
        // así evitamos dejarlo fuera de su cuenta por un QR mal escaneado.
        if (!TotpHelper.VerifyCode(user.TotpSecret, request.Code))
            return Results.BadRequest(new { message = "Código inválido." });

        user.TwoFactorEnabled = true;
        await db.SaveChangesAsync();

        return Results.Ok(new { twoFactorEnabled = true });
    }

    // POST /api/auth/2fa/verify  -> segundo paso del login: tempToken + código = accessToken + refreshToken
    private static async Task<IResult> Verify(TwoFactorVerifyRequest request, AppDbContext db, TokenService tokens)
    {
        var userId = await tokens.ValidateTwoFactorTokenAsync(request.TempToken);
        var user = userId is null ? null : await db.Users.FindAsync(userId.Value);

        if (user is null || !user.TwoFactorEnabled || user.TotpSecret is null ||
            !TotpHelper.VerifyCode(user.TotpSecret, request.Code))
        {
            return Results.Json(
                new { message = "Token temporal o código inválido." },
                statusCode: StatusCodes.Status401Unauthorized);
        }

        // Ahora sí: ambos factores verificados (algo que sabes + algo que tienes).
        var accessToken = tokens.CreateAccessToken(user);
        var (rawRefreshToken, refreshTokenEntity) = tokens.CreateRefreshToken(user.Id);

        db.RefreshTokens.Add(refreshTokenEntity);
        await db.SaveChangesAsync();

        return Results.Ok(new
        {
            accessToken,
            refreshToken = rawRefreshToken
        });
    }

    private static int GetUserId(ClaimsPrincipal principal) =>
        int.Parse(principal.FindFirstValue(JwtRegisteredClaimNames.Sub)!);
}
