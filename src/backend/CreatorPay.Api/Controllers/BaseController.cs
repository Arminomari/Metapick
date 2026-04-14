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

        // Error codes end with _NOT_FOUND, VALIDATION_ERROR, CONFLICT, FORBIDDEN, UNAUTHORIZED
        var code = result.Error!.Code;
        if (code.EndsWith("_NOT_FOUND")) return NotFound(new { error = result.Error });
        return code switch
        {
            "VALIDATION_ERROR" => BadRequest(new { error = result.Error }),
            "CONFLICT"         => Conflict(new { error = result.Error }),
            "FORBIDDEN"        => StatusCode(403, new { error = result.Error }),
            "UNAUTHORIZED"     => Unauthorized(new { error = result.Error }),
            _                  => StatusCode(500, new { error = result.Error })
        };
    }
}
