namespace Auth.Local.Api.Models;

/// <summary>
/// Usuario de la aplicación. Nunca guardamos la contraseña en texto plano:
/// solo su hash (con sal incluida) generado por PasswordHasher.
/// </summary>
public class User
{
    public int Id { get; set; }

    public required string Email { get; set; }

    public required string PasswordHash { get; set; }

    // Indica si el usuario ya confirmó su app autenticadora (2FA con TOTP).
    public bool TwoFactorEnabled { get; set; }

    // Secreto TOTP en Base32. Es null hasta que el usuario inicia la configuración de 2FA.
    public string? TotpSecret { get; set; }
}
