using System.Threading.RateLimiting;
using Auth.Local.Api.Auth;
using Auth.Local.Api.Data;
using Auth.Local.Api.Endpoints;
using Auth.Local.Api.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------
// Servicios
// ---------------------------------------------------------------
builder.Services.AddOpenApi();

// EF Core + SQLite: la base de datos es un archivo local (auth.db).
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Default")));

// PasswordHasher<User> viene de ASP.NET Core Identity (incluido en el framework).
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();

// Opciones JWT tipadas. ValidateOnStart hace que la API NO arranque si falta
// la llave (Jwt:Key) en user-secrets: mejor fallar temprano que emitir tokens inseguros.
builder.Services.AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddSingleton<TokenService>();

// Autenticación con JWT Bearer: lee "Authorization: Bearer <token>" y valida
// issuer, audience, expiración y firma. La configuración está en JwtBearerSetup.
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer();
builder.Services.ConfigureOptions<JwtBearerSetup>();

// Política por defecto (la que usa RequireAuthorization()): además de estar autenticado,
// el token NO debe tener el claim "purpose". Así el tempToken del 2FA (purpose = "2fa"),
// aunque esté bien firmado, no sirve para /api/profile ni otros endpoints normales -> 403.
var fullSessionPolicy = new AuthorizationPolicyBuilder()
    .RequireAuthenticatedUser()
    .RequireAssertion(context => !context.User.HasClaim(c => c.Type == AuthClaims.Purpose))
    .Build();

builder.Services.AddAuthorizationBuilder()
    .AddPolicy(AuthPolicies.FullSession, fullSessionPolicy)
    .SetDefaultPolicy(fullSessionPolicy);

// CORS: el navegador bloquea llamadas desde otro origen (puerto distinto = otro origen).
// Solo permitimos a NUESTRO frontend; nunca AllowAnyOrigin en una API con credenciales.
// Ojo: CORS protege a los usuarios del navegador, no a la API (curl lo ignora).
builder.Services.AddCors(options =>
{
    options.AddPolicy("web", policy => policy
        .WithOrigins("http://localhost:5173")
        .AllowAnyHeader()   // necesitamos "Authorization" y "Content-Type"
        .AllowAnyMethod());
});

// Rate limiting nativo: frena ataques de fuerza bruta contra el login.
// Ventana fija: máximo 5 intentos por minuto POR IP; el 6.º recibe 429.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy(RateLimitPolicies.Login, FiveAttemptsPerMinutePerIp);

    // El código de 6 dígitos también se puede adivinar por fuerza bruta (1 en 1 000 000),
    // así que /2fa/verify tiene su propio límite (contador independiente del login).
    options.AddPolicy(RateLimitPolicies.TwoFactor, FiveAttemptsPerMinutePerIp);

    options.OnRejected = async (context, cancellationToken) =>
    {
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            context.HttpContext.Response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString();

        await context.HttpContext.Response.WriteAsJsonAsync(
            new { message = "Demasiados intentos. Espera un minuto e inténtalo de nuevo." },
            cancellationToken);
    };

    static RateLimitPartition<string> FiveAttemptsPerMinutePerIp(HttpContext httpContext) =>
        // Cada IP tiene su propio contador (partición).
        // Detrás de un proxy/load balancer habría que usar ForwardedHeaders para ver la IP real.
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "desconocida",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0, // no encolamos: rechazamos de inmediato
            });
});

var app = builder.Build();

// Para la demo usamos EnsureCreated: crea auth.db con el esquema si no existe.
// (En un proyecto real usaríamos migraciones: dotnet ef migrations add ...)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

// ---------------------------------------------------------------
// Pipeline HTTP
// ---------------------------------------------------------------
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// CORS va antes de la autenticación para que las peticiones preflight (OPTIONS)
// reciban sus cabeceras aunque no traigan token.
app.UseCors("web");

// El orden importa: primero averiguamos QUIÉN es (autenticación)
// y después decidimos QUÉ puede hacer (autorización).
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// ---------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------
app.MapGet("/api/health", () => Results.Ok(new { status = "ok", time = DateTime.UtcNow }));

app.MapAuthEndpoints();
app.MapProfileEndpoints();
app.MapTwoFactorEndpoints();

app.Run();
