using System.Net;
using System.Text.Json;
using CreatorPay.Application.Common;
using Hangfire.Dashboard;
using Microsoft.EntityFrameworkCore;

namespace CreatorPay.Api.Middleware;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            _logger.LogWarning(ex, "Concurrency conflict");
            await WriteResponse(context, HttpStatusCode.Conflict,
                new ApiError("CONCURRENCY_CONFLICT", "Data was modified by another process. Please retry."));
        }
        catch (UnauthorizedAccessException ex)
        {
            _logger.LogWarning(ex, "Unauthorized access attempt");
            await WriteResponse(context, HttpStatusCode.Forbidden,
                new ApiError("FORBIDDEN", "Access denied"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception: {Message}", ex.Message);
            await WriteResponse(context, HttpStatusCode.InternalServerError,
                new ApiError("INTERNAL_ERROR", "An unexpected error occurred"));
        }
    }

    private static async Task WriteResponse(HttpContext context, HttpStatusCode statusCode, ApiError error)
    {
        context.Response.StatusCode = (int)statusCode;
        context.Response.ContentType = "application/json";
        var json = JsonSerializer.Serialize(new { error = error },
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        await context.Response.WriteAsync(json);
    }
}

/// <summary>
/// Hangfire dashboard authorization – only Admin role allowed.
/// </summary>
public class HangfireAuthFilter : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var httpContext = context.GetHttpContext();
        return httpContext.User.Identity?.IsAuthenticated == true
            && httpContext.User.IsInRole("Admin");
    }
}
