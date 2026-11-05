namespace Auth.Local.Api.Auth;

public static class AuthPolicies
{
    // Sesión completa: usuario autenticado con un access token "normal".
    // Es también la política por defecto de RequireAuthorization().
    public const string FullSession = "FullSession";
}

public static class AuthClaims
{
    // Claim que marca tokens de propósito limitado (p. ej. el tempToken del 2FA).
    public const string Purpose = "purpose";
    public const string TwoFactorPurpose = "2fa";
}
