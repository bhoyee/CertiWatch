using CertiWatch.Api.Infrastructure.Persistence;
using CertiWatch.Api.Infrastructure.Services;
using CertiWatch.Contracts.Requests;
using CertiWatch.Contracts.Responses;
using Microsoft.EntityFrameworkCore;

namespace CertiWatch.Api.Features.Auth;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/auth");
        group.MapPost("/login", LoginAsync);
        group.MapPost("/magic", AcceptMagicLinkAsync);
        group.MapGet("/callback", CallbackAsync);
        return group;
    }

    private static async Task<IResult> LoginAsync(
        AuthLoginRequest request,
        AppDbContext db,
        IMagicLinkService magicLinks,
        IDateTimeProvider clock,
        CancellationToken token)
    {
        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Name == request.Tenant, token);
        if (tenant is null)
        {
            tenant = new Domain.Entities.Tenant
            {
                Id = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
                Name = request.Tenant,
                Plan = "trial",
                CreatedAtUtc = clock.UtcNow
            };
            db.Tenants.Add(tenant);
            await db.SaveChangesAsync(token);
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == request.Email && u.TenantId == tenant.Id, token);
        if (user is null)
        {
            user = new Domain.Entities.User
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                Email = request.Email,
                Role = "admin",
                CreatedAt = clock.UtcNow
            };
            db.Users.Add(user);
            await db.SaveChangesAsync(token);
        }

        var link = magicLinks.CreateLink(tenant.Id, Guid.Empty, "login");
        return Results.Ok(new { message = "Magic link sent", link });
    }

    private static IResult AcceptMagicLinkAsync(MagicLinkRequest request, IMagicLinkService magicLinks)
    {
        var response = magicLinks.Validate(request);
        return response.Accepted ? Results.Ok(response) : Results.BadRequest(response);
    }

    private static IResult CallbackAsync(string token, string payload, string? action, IMagicLinkService magicLinks)
    {
        var request = new MagicLinkRequest { Token = token, Payload = payload, Action = action };
        var result = magicLinks.Validate(request);
        return result.Accepted ? Results.Ok(result) : Results.BadRequest(result);
    }
}
