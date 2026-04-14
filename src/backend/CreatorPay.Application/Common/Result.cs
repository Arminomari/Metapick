namespace CreatorPay.Application.Common;

public class Result<T>
{
    public bool IsSuccess { get; }
    public T? Value { get; }
    public Error? Error { get; }

    private Result(T value) { IsSuccess = true; Value = value; }
    private Result(Error error) { IsSuccess = false; Error = error; }

    public static Result<T> Success(T value) => new(value);
    public static Result<T> Failure(Error error) => new(error);

    public static implicit operator Result<T>(T value) => Success(value);
    public static implicit operator Result<T>(Error error) => Failure(error);
}

public record Error(string Code, string Message, int HttpStatus = 400);

public static class Errors
{
    public static Error NotFound(string entity, Guid id) =>
        new($"{entity.ToUpper()}_NOT_FOUND", $"{entity} with id {id} not found", 404);
    public static Error NotFound(string entity) =>
        new($"{entity.ToUpper()}_NOT_FOUND", $"{entity} not found", 404);
    public static Error Validation(string message) =>
        new("VALIDATION_ERROR", message, 400);
    public static Error Conflict(string message) =>
        new("CONFLICT", message, 409);
    public static Error Forbidden(string message) =>
        new("FORBIDDEN", message, 403);
    public static Error Unauthorized(string message) =>
        new("UNAUTHORIZED", message, 401);
    public static Error InsufficientBudget =>
        new("INSUFFICIENT_BUDGET", "Not enough budget available", 409);
    public static Error CampaignFull =>
        new("CAMPAIGN_FULL", "Campaign has reached maximum number of creators", 409);
    public static Error AlreadyApplied =>
        new("ALREADY_APPLIED", "You have already applied to this campaign", 409);
    public static Error AlreadyReviewed =>
        new("ALREADY_REVIEWED", "This entity has already been reviewed", 409);
    public static Error PayoutAlreadyRequested =>
        new("ALREADY_REQUESTED", "A payout request already exists for this calculation", 409);
}

public class PagedResult<T>
{
    public List<T> Data { get; set; } = new();
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalCount { get; set; }
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
}

public class ApiResponse<T>
{
    public T? Data { get; set; }
    public object? Meta { get; set; }

    public static ApiResponse<T> Ok(T data) => new() { Data = data };
    public static ApiResponse<T> Ok(T data, object meta) => new() { Data = data, Meta = meta };
}

public class ApiError
{
    public string Code { get; set; } = null!;
    public string Message { get; set; } = null!;
    public List<string>? Details { get; set; }

    public ApiError() { }
    public ApiError(string code, string message) { Code = code; Message = message; }
}
