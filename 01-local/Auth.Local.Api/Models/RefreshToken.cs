namespace Auth.Local.Api.Models;

/// <summary>
/// Representa un refresh token para la renovación rotativa de sesiones.
/// Por seguridad, nunca guardamos el token original en la base de datos:
/// solo su hash criptográfico SHA-256.
/// </summary>
public class RefreshToken
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public required string TokenHash { get; set; }

    public DateTime ExpiresAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? RevokedAt { get; set; }

    public int? ReplacedByTokenId { get; set; }

    // Propiedades de navegación de EF Core
    public User? User { get; set; }

    public RefreshToken? ReplacedByToken { get; set; }
}
