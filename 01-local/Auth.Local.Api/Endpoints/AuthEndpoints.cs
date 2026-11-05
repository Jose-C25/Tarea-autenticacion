using System.Net.Mail;
using Auth.Local.Api.Auth;
using Auth.Local.Api.Contracts;
using Auth.Local.Api.Data;
using Auth.Local.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Auth.Local.Api.Endpoints;

public static class AuthEndpoints
{
    private const int MinPasswordLength = 8;

    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");

        group.MapPost("/register", Register);
        // Solo el login tiene límite de intentos (ver AddRateLimiter en Program.cs).
        group.MapPost("/login", Login)
            .RequireRateLimiting(RateLimitPolicies.Login);

        return app;
    }

    // POST /api/auth/register
    private static async Task<IResult> Register(
        RegisterRequest request,
        AppDbContext db,
        IPasswordHasher<User> hasher)
    {
        var email = NormalizeEmail(request.Email);

        // 1) Validación de entrada: nunca confiamos en lo que manda el cliente.
        var errors = new Dictionary<string, string[]>();
        if (email is null || !MailAddress.TryCreate(email, out _))
            errors["email"] = ["El correo no es válido."];
        if (string.IsNullOrEmpty(request.Password) || request.Password.Length < MinPasswordLength)
            errors["password"] = [$"La contraseña debe tener al menos {MinPasswordLength} caracteres."];
        if (errors.Count > 0)
            return Results.ValidationProblem(errors); // 400

        // 2) El correo debe ser único.
        if (await db.Users.AnyAsync(u => u.Email == email))
            return Results.Conflict(new { message = "El correo ya está registrado." }); // 409

        // 3) Guardamos SOLO el hash. PasswordHasher usa PBKDF2 con sal aleatoria
        //    y muchas iteraciones: aunque roben la BD, no pueden revertir el hash
        //    y dos usuarios con la misma contraseña tendrán hashes distintos.
        var user = new User { Email = email!, PasswordHash = "" };
        user.PasswordHash = hasher.HashPassword(user, request.Password);

        db.Users.Add(user);
        await db.SaveChangesAsync();

        return Results.Created($"/api/users/{user.Id}", new { user.Id, user.Email }); // 201
    }

    // POST /api/auth/login
    private static async Task<IResult> Login(
        LoginRequest request,
        AppDbContext db,
        IPasswordHasher<User> hasher,
        TokenService tokens)
    {
        var email = NormalizeEmail(request.Email);
        var user = email is null ? null : await db.Users.SingleOrDefaultAsync(u => u.Email == email);

        if (user is null)
        {
            // Aunque el usuario no exista, calculamos un hash igual para que la respuesta
            // tarde lo mismo: así un atacante no puede adivinar qué correos existen
            // midiendo tiempos (enumeración de usuarios).
            hasher.VerifyHashedPassword(DummyUser, DummyUser.PasswordHash, request.Password ?? "");
            return InvalidCredentials();
        }

        var result = hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password ?? "");
        if (result == PasswordVerificationResult.Failed)
            return InvalidCredentials();

        // Si el algoritmo/iteraciones del hash cambiaron, lo actualizamos en este momento.
        if (result == PasswordVerificationResult.SuccessRehashNeeded)
        {
            user.PasswordHash = hasher.HashPassword(user, request.Password!);
            await db.SaveChangesAsync();
        }

        // Con 2FA activo, la contraseña sola NO basta: devolvemos un token temporal
        // que solo sirve para el segundo paso (/api/auth/2fa/verify).
        if (user.TwoFactorEnabled)
            return Results.Ok(new { requires2fa = true, tempToken = tokens.CreateTwoFactorToken(user) });

        return Results.Ok(new { accessToken = tokens.CreateAccessToken(user) });
    }

    // Mensaje GENÉRICO: no decimos si falló el correo o la contraseña,
    // para no regalarle información a quien intenta adivinar cuentas.
    private static IResult InvalidCredentials() =>
        Results.Json(new { message = "Correo o contraseña incorrectos." }, statusCode: StatusCodes.Status401Unauthorized);

    // Usuario ficticio con un hash real, usado solo para igualar tiempos de respuesta.
    private static readonly User DummyUser = CreateDummyUser();

    private static User CreateDummyUser()
    {
        var user = new User { Email = "dummy@localhost", PasswordHash = "" };
        user.PasswordHash = new PasswordHasher<User>().HashPassword(user, Guid.NewGuid().ToString());
        return user;
    }

    // Comparamos correos sin importar mayúsculas ni espacios.
    private static string? NormalizeEmail(string? email) =>
        string.IsNullOrWhiteSpace(email) ? null : email.Trim().ToLowerInvariant();
}
