using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Auth.Local.Api.Auth;

/// <summary>
/// Configura cómo la API VALIDA los JWT que recibe. Usa las mismas JwtOptions
/// con las que TokenService los emite (mismo issuer, audience y llave).
/// </summary>
public class JwtBearerSetup(IOptions<JwtOptions> jwtOptions) : IConfigureNamedOptions<JwtBearerOptions>
{
    public void Configure(string? name, JwtBearerOptions options)
    {
        // Conservamos los nombres originales de los claims ("sub", "email")
        // en lugar de traducirlos a las URIs largas de Microsoft.
        options.MapInboundClaims = false;

        options.TokenValidationParameters = CreateValidationParameters(jwtOptions.Value);
    }

    public void Configure(JwtBearerOptions options) => Configure(Options.DefaultName, options);

    // También lo usa TokenService para validar a mano el tempToken del 2FA.
    public static TokenValidationParameters CreateValidationParameters(JwtOptions jwt) => new()
    {
        // ¿Lo emitió quien esperamos?
        ValidateIssuer = true,
        ValidIssuer = jwt.Issuer,

        // ¿Es un token para ESTA aplicación?
        ValidateAudience = true,
        ValidAudience = jwt.Audience,

        // ¿Está vigente? (exp / nbf)
        ValidateLifetime = true,

        // ¿La firma es correcta? Si alguien cambia UN solo carácter del payload,
        // la firma ya no coincide y el token se rechaza.
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
        ValidAlgorithms = [SecurityAlgorithms.HmacSha256],

        // Por defecto .NET tolera 5 minutos de diferencia de reloj.
        // Lo bajamos a 30 s para que en la demo la expiración se note enseguida.
        ClockSkew = TimeSpan.FromSeconds(30),

        NameClaimType = JwtRegisteredClaimNames.Email,
    };
}
