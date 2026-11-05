using System.ComponentModel.DataAnnotations;

namespace Auth.Local.Api.Auth;

/// <summary>
/// Opciones tipadas para emitir y validar JWT. Se leen de la sección "Jwt".
/// Issuer/Audience/minutos viven en appsettings.json; la llave (Key) NO:
/// va en dotnet user-secrets (desarrollo) o en un gestor de secretos (producción).
/// </summary>
public class JwtOptions
{
    public const string SectionName = "Jwt";

    // Quién emite el token (claim "iss").
    [Required]
    public string Issuer { get; set; } = "";

    // Para quién es el token (claim "aud"). La API rechaza tokens de otra audiencia.
    [Required]
    public string Audience { get; set; } = "";

    // Llave simétrica para HS256. Debe tener al menos 32 bytes (256 bits).
    [Required, MinLength(32, ErrorMessage = "Jwt:Key debe tener al menos 32 caracteres. Configúrala con dotnet user-secrets.")]
    public string Key { get; set; } = "";

    // Vida corta del access token: si se filtra, sirve poco tiempo.
    [Range(1, 1440)]
    public int AccessTokenMinutes { get; set; } = 15;

    // Vida del tempToken entre "contraseña correcta" y "código 2FA correcto".
    [Range(1, 60)]
    public int TwoFactorTokenMinutes { get; set; } = 5;
}
