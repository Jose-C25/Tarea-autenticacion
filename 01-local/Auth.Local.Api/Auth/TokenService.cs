using System.Text;
using Auth.Local.Api.Models;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Auth.Local.Api.Auth;

/// <summary>
/// Emite los JWT de la aplicación usando JsonWebTokenHandler (el handler moderno,
/// más rápido que el antiguo JwtSecurityTokenHandler).
/// </summary>
public class TokenService(IOptions<JwtOptions> options)
{
    private readonly JwtOptions _jwt = options.Value;
    private readonly JsonWebTokenHandler _handler = new();

    public string CreateAccessToken(User user) =>
        CreateToken(user, TimeSpan.FromMinutes(_jwt.AccessTokenMinutes));

    // Token temporal entre "contraseña correcta" y "código 2FA correcto".
    // El claim purpose = "2fa" hace que la política por defecto lo rechace (403)
    // en cualquier endpoint normal: solo sirve para /api/auth/2fa/verify.
    public string CreateTwoFactorToken(User user) =>
        CreateToken(
            user,
            TimeSpan.FromMinutes(_jwt.TwoFactorTokenMinutes),
            new Dictionary<string, object> { [AuthClaims.Purpose] = AuthClaims.TwoFactorPurpose });

    /// <summary>
    /// Valida un tempToken del 2FA (firma, issuer, audience, expiración y purpose).
    /// Devuelve el id del usuario ("sub") o null si el token no es válido.
    /// </summary>
    public async Task<int?> ValidateTwoFactorTokenAsync(string? token)
    {
        if (string.IsNullOrWhiteSpace(token))
            return null;

        var result = await _handler.ValidateTokenAsync(token, JwtBearerSetup.CreateValidationParameters(_jwt));
        if (!result.IsValid)
            return null;

        // Un access token normal NO puede usarse aquí: exigimos purpose = "2fa".
        if (!result.Claims.TryGetValue(AuthClaims.Purpose, out var purpose) ||
            purpose?.ToString() != AuthClaims.TwoFactorPurpose)
            return null;

        return result.Claims.TryGetValue(JwtRegisteredClaimNames.Sub, out var sub) &&
               int.TryParse(sub?.ToString(), out var userId)
            ? userId
            : null;
    }

    private string CreateToken(User user, TimeSpan lifetime, IDictionary<string, object>? extraClaims = null)
    {
        // HS256 = HMAC con SHA-256: la MISMA llave firma y verifica.
        // Por eso la llave nunca debe salir del servidor.
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Key)),
            SecurityAlgorithms.HmacSha256);

        var claims = new Dictionary<string, object>
        {
            // "sub" (subject): identificador estable del usuario.
            [JwtRegisteredClaimNames.Sub] = user.Id.ToString(),
            [JwtRegisteredClaimNames.Email] = user.Email,
            // "jti": id único del token (útil para listas de revocación).
            [JwtRegisteredClaimNames.Jti] = Guid.NewGuid().ToString(),
        };
        if (extraClaims is not null)
            foreach (var (key, value) in extraClaims)
                claims[key] = value;

        var now = DateTime.UtcNow;
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = _jwt.Issuer,
            Audience = _jwt.Audience,
            Claims = claims,
            IssuedAt = now,
            NotBefore = now,
            Expires = now.Add(lifetime), // claim "exp"
            SigningCredentials = credentials,
        };

        // El resultado es header.payload.firma en Base64Url.
        // OJO: el payload NO está cifrado, cualquiera puede leerlo. Solo está firmado.
        return _handler.CreateToken(descriptor);
    }
}
