using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// ---------------------------------------------------------------
// Configuración de Auth0
// Domain   -> dotnet user-secrets set "Auth0:Domain" "tu-tenant.us.auth0.com"
// Audience -> appsettings.json (identifier de la API creada en Auth0)
// ---------------------------------------------------------------
var auth0Domain = builder.Configuration["Auth0:Domain"]?
    .Replace("https://", "").TrimEnd('/');
var auth0Audience = builder.Configuration["Auth0:Audience"];

if (string.IsNullOrWhiteSpace(auth0Domain) || string.IsNullOrWhiteSpace(auth0Audience))
{
    // Fallar temprano con un mensaje claro es mejor que un 401 misterioso.
    throw new InvalidOperationException(
        "Falta configurar Auth0. Ejecuta: dotnet user-secrets set \"Auth0:Domain\" \"tu-tenant.us.auth0.com\"");
}

// ---------------------------------------------------------------
// Servicios
// ---------------------------------------------------------------
builder.Services.AddOpenApi();

// CORS: solo nuestro frontend (React en el puerto 5173) puede llamar a la API desde el navegador.
builder.Services.AddCors(options =>
{
    options.AddPolicy("web", policy => policy
        .WithOrigins("http://localhost:5173")
        .AllowAnyHeader()   // necesitamos "Authorization"
        .AllowAnyMethod());
});

// Autenticación con JWT Bearer emitidos por Auth0.
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = $"https://{auth0Domain}/";
        options.Audience = auth0Audience;
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            NameClaimType = "sub",
        };
    });

// Políticas basadas en PERMISOS (RBAC de Auth0).
// Con "Enable RBAC" + "Add Permissions in the Access Token" activos en Auth0:
// - Lector tiene: "read:messages"
// - Administrador tiene: "read:messages" y "delete:messages"
builder.Services.AddAuthorizationBuilder()
    .AddPolicy("read:messages", policy => policy
        .RequireAuthenticatedUser()
        .RequireClaim("permissions", "read:messages"))
    .AddPolicy("delete:messages", policy => policy
        .RequireAuthenticatedUser()
        .RequireClaim("permissions", "delete:messages"));

var app = builder.Build();

// ---------------------------------------------------------------
// Pipeline HTTP
// ---------------------------------------------------------------
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("web");
app.UseAuthentication();
app.UseAuthorization();

// ---------------------------------------------------------------
// Recurso en memoria: Mensajes (Parte 2)
// ---------------------------------------------------------------
var messages = new List<Message>
{
    new(1, "¡Bienvenidos al sistema seguro de mensajería con Auth0!", "auth0|sistema"),
    new(2, "Este mensaje contiene avisos generales para todos los lectores.", "auth0|sistema"),
    new(3, "Operación administrativa sensible: solo eliminable por Administradores.", "auth0|admin")
};

// ---------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------
app.MapGet("/api/health", () => Results.Ok(new { status = "ok", time = DateTime.UtcNow }));

// Anónimo: cualquiera puede llamarlo -> 200
app.MapGet("/api/public", () => Results.Ok(new
{
    message = "Endpoint público: no necesitas token para ver esto.",
}));

// Requiere un access token válido de Auth0 -> 200 / 401
app.MapGet("/api/private", (ClaimsPrincipal user) => Results.Ok(new
{
    message = "Endpoint privado: tu token de Auth0 es válido.",
    sub = user.FindFirstValue("sub"),
    permissions = GetPermissions(user),
}))
.RequireAuthorization();

// Requiere token válido Y el permiso read:messages -> 200 / 401 / 403
app.MapGet("/api/private-scoped", (ClaimsPrincipal user) => Results.Ok(new
{
    message = "Endpoint con permiso: tienes 'read:messages'.",
    sub = user.FindFirstValue("sub"),
    permissions = GetPermissions(user),
}))
.RequireAuthorization("read:messages");

// GET /api/messages -> requiere read:messages
app.MapGet("/api/messages", () => Results.Ok(messages))
    .RequireAuthorization("read:messages");

// DELETE /api/messages/{id} -> requiere delete:messages
// Al borrar, registra en el log el sub del usuario que hizo la operación
app.MapDelete("/api/messages/{id:int}", (int id, ClaimsPrincipal user, ILogger<Program> logger) =>
{
    var sub = user.FindFirstValue("sub") ?? "desconocido";
    var msg = messages.FirstOrDefault(m => m.Id == id);
    if (msg is null)
    {
        return Results.NotFound(new { message = $"No se encontró el mensaje con id {id}." });
    }

    messages.Remove(msg);
    logger.LogInformation("MENSAJE ELIMINADO - Id: {MessageId}, Texto: '{Text}', Usuario Sub: {Sub}", id, msg.Text, sub);

    return Results.Ok(new
    {
        message = $"Mensaje {id} eliminado correctamente.",
        deletedBy = sub
    });
})
.RequireAuthorization("delete:messages");

app.Run();

// El arreglo "permissions" del JWT llega como varios claims con el mismo nombre.
static string[] GetPermissions(ClaimsPrincipal user) =>
    user.FindAll("permissions").Select(c => c.Value).ToArray();

public record Message(int Id, string Text, string CreatedBy);
