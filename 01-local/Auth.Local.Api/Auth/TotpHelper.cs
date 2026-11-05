using OtpNet;

namespace Auth.Local.Api.Auth;

/// <summary>
/// TOTP (RFC 6238): servidor y app autenticadora comparten un secreto y, con la hora
/// actual dividida en ventanas de 30 s, ambos calculan el mismo código de 6 dígitos.
/// </summary>
public static class TotpHelper
{
    public const string Issuer = "DemoAuth";

    // 20 bytes = 160 bits, el tamaño recomendado para HMAC-SHA1 (RFC 4226).
    public static string GenerateSecret() =>
        Base32Encoding.ToString(KeyGeneration.GenerateRandomKey(20));

    // URI estándar que entienden Google Authenticator, Microsoft Authenticator, Authy, etc.
    // El frontend la convierte en código QR.
    public static string BuildOtpAuthUri(string email, string base32Secret) =>
        $"otpauth://totp/{Issuer}:{Uri.EscapeDataString(email)}" +
        $"?secret={base32Secret}&issuer={Issuer}&digits=6&period=30";

    public static bool VerifyCode(string base32Secret, string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
            return false;

        var totp = new Totp(Base32Encoding.ToBytes(base32Secret)); // SHA1, 30 s, 6 dígitos

        // RfcSpecifiedNetworkDelay acepta la ventana actual, la anterior y la siguiente
        // (±30 s) para tolerar relojes desfasados o que el usuario tarde en escribir.
        // Nota: en producción también guardaríamos el último "timeStepMatched" usado
        // para impedir reutilizar el mismo código dos veces (ataque de repetición).
        return totp.VerifyTotp(code.Trim(), out _, VerificationWindow.RfcSpecifiedNetworkDelay);
    }
}
