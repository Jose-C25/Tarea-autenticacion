using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Auth.Local.Api.Endpoints;

public static class ProfileEndpoints
{
    public static IEndpointRouteBuilder MapProfileEndpoints(this IEndpointRouteBuilder app)
    {
        // RequireAuthorization(): sin un JWT válido en "Authorization: Bearer ..." -> 401.
        app.MapGet("/api/profile", GetProfile)
            .RequireAuthorization();

        return app;
    }

    // GET /api/profile
    // No consultamos la BD: los datos salen de los claims del token ya validado.
    private static IResult GetProfile(ClaimsPrincipal user) =>
        Results.Ok(new
        {
            id = user.FindFirstValue(JwtRegisteredClaimNames.Sub),
            email = user.FindFirstValue(JwtRegisteredClaimNames.Email),
        });
}
