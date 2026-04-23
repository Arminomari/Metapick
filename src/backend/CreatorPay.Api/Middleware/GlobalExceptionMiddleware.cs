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
    private readonly IHostEnvironment _environment;

    public GlobalExceptionMiddleware(
        RequestDelegate next,
        ILogger<GlobalExceptionMiddleware> logger,
        IHostEnvironment environment)
    {
        _next = next;
        _logger = logger;
        _environment = environment;
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
            var traceId = context.TraceIdentifier;
            _logger.LogError(ex, "Unhandled exception: {Message}", ex.Message);

            var error = new ApiError("INTERNAL_ERROR", $"An unexpected error occurred (ref: {traceId})");
            if (_environment.IsDevelopment())
            {
                error.Details =
                [
                    $"Type: {ex.GetType().Name}",
                    $"Message: {ex.Message}",
                    $"TraceId: {traceId}"
                ];
            }

            await WriteResponse(context, HttpStatusCode.InternalServerError, error);
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

public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;

    public SecurityHeadersMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers.TryAdd("X-Content-Type-Options", "nosniff");
            headers.TryAdd("X-Frame-Options", "DENY");
            headers.TryAdd("Referrer-Policy", "strict-origin-when-cross-origin");
            headers.TryAdd("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

            if (!context.Request.Path.StartsWithSegments("/swagger") &&
                !context.Request.Path.StartsWithSegments("/hangfire"))
            {
                headers.TryAdd(
                    "Content-Security-Policy",
                    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data:;"
                );
            }

            return Task.CompletedTask;
        });

        await _next(context);
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
