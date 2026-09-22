using System.Security.Claims;
using CreatorPay.Application.Common;
using Microsoft.AspNetCore.Mvc;

namespace CreatorPay.Api.Controllers;

[ApiController]
public abstract class BaseController : ControllerBase
{
    protected Guid GetUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");
        return Guid.TryParse(sub, out var id) ? id : Guid.Empty;
    }

    protected string GetUserRole() =>
        User.FindFirstValue(ClaimTypes.Role) ?? "";

    /// <summary>Clamps page/pageSize to safe bounds.</summary>
    protected static (int page, int pageSize) ClampPagination(int page, int pageSize, int maxPageSize = 100)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 1;
        if (pageSize > maxPageSize) pageSize = maxPageSize;
        return (page, pageSize);
    }

    protected IActionResult ToActionResult<T>(Result<T> result)
    {
        if (result.IsSuccess)
        {
            return result.Value == null ? NoContent() : Ok(ApiResponse<T>.Ok(result.Value));
        }

        // Every Error carries the status it means (Errors.Conflict, AlreadyApplied,
        // CampaignFull, InsufficientBudget …). Mapping on the code string alone
        // turned every named 409 into a 500, so the status wins here; the code is
        // only a fallback for errors built without one.
        var error = result.Error!;
        var status = error.HttpStatus is >= 400 and < 600
            ? error.HttpStatus
            : error.Code.EndsWith("_NOT_FOUND") ? 404
            : error.Code switch
            {
                "VALIDATION_ERROR" => 400,
                "CONFLICT" => 409,
                "FORBIDDEN" => 403,
                "UNAUTHORIZED" => 401,
                _ => 500,
            };
        return StatusCode(status, new { error });
    }
}
