using CreatorPay.Application.DTOs;
using CreatorPay.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CreatorPay.Api.Controllers;

// ── Creator portfolio (managed by the creator) ─────────────────────
[Route("api/creator/portfolio")]
[Authorize(Policy = "CreatorOnly")]
public class PortfolioController : BaseController
{
    private readonly IPortfolioService _portfolio;
    public PortfolioController(IPortfolioService portfolio) => _portfolio = portfolio;

    /// <summary>Hämta min portfölj</summary>
    [HttpGet]
    public async Task<IActionResult> GetMine(CancellationToken ct)
        => ToActionResult(await _portfolio.GetMyPortfolioAsync(GetUserId(), ct));

    /// <summary>Lägg till ett portföljobjekt</summary>
    [HttpPost]
    public async Task<IActionResult> Add([FromBody] CreatePortfolioItemRequest request, CancellationToken ct)
        => ToActionResult(await _portfolio.AddItemAsync(GetUserId(), request, ct));

    /// <summary>Uppdatera ett portföljobjekt</summary>
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdatePortfolioItemRequest request, CancellationToken ct)
        => ToActionResult(await _portfolio.UpdateItemAsync(id, GetUserId(), request, ct));

    /// <summary>Ta bort ett portföljobjekt</summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => ToActionResult(await _portfolio.DeleteItemAsync(id, GetUserId(), ct));
}

// ── Creator discovery (brands search & view full profiles) ─────────
[Route("api/creators")]
[Authorize]
public class CreatorDiscoveryController : BaseController
{
    private readonly ICreatorDiscoveryService _discovery;
    public CreatorDiscoveryController(ICreatorDiscoveryService discovery) => _discovery = discovery;

    /// <summary>Sök kreatörer (för företag)</summary>
    [HttpGet("search")]
    [Authorize(Policy = "BrandOrAdmin")]
    public async Task<IActionResult> Search(
        [FromQuery] string? search, [FromQuery] string? category, [FromQuery] string? country,
        [FromQuery] int? minFollowers, [FromQuery] string? tag, [FromQuery] bool? openToPrOffers,
        [FromQuery] string? sort, [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        (page, pageSize) = ClampPagination(page, pageSize);
        return ToActionResult(await _discovery.SearchAsync(
            search, category, country, minFollowers, tag, openToPrOffers, sort, page, pageSize, ct));
    }

    /// <summary>Hämta en kreatörs fullständiga publika profil (inkl. portfölj &amp; omdömen)</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetPublicProfile(Guid id, CancellationToken ct)
        => ToActionResult(await _discovery.GetPublicProfileAsync(id, ct));
}

// ── PR Hub (direct brand → creator offers) ─────────────────────────
[Route("api/pr-offers")]
[Authorize]
public class PrOfferController : BaseController
{
    private readonly IPrOfferService _offers;
    public PrOfferController(IPrOfferService offers) => _offers = offers;

    /// <summary>Skicka ett PR-erbjudande till en kreatör</summary>
    [HttpPost]
    [Authorize(Policy = "BrandOnly")]
    public async Task<IActionResult> Create([FromBody] CreatePrOfferRequest request, CancellationToken ct)
        => ToActionResult(await _offers.CreateAsync(GetUserId(), request, ct));

    /// <summary>Lista PR-erbjudanden jag skickat (företag)</summary>
    [HttpGet("sent")]
    [Authorize(Policy = "BrandOnly")]
    public async Task<IActionResult> GetSent(
        [FromQuery] string? status, [FromQuery] string? category,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        (page, pageSize) = ClampPagination(page, pageSize);
        return ToActionResult(await _offers.GetSentAsync(GetUserId(), status, category, page, pageSize, ct));
    }

    /// <summary>Statistik över skickade PR-erbjudanden (antal, status, kategori)</summary>
    [HttpGet("sent/stats")]
    [Authorize(Policy = "BrandOnly")]
    public async Task<IActionResult> GetStats(CancellationToken ct)
        => ToActionResult(await _offers.GetBrandStatsAsync(GetUserId(), ct));

    /// <summary>Lista PR-erbjudanden jag fått (kreatör)</summary>
    [HttpGet("received")]
    [Authorize(Policy = "CreatorOnly")]
    public async Task<IActionResult> GetReceived(
        [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        (page, pageSize) = ClampPagination(page, pageSize);
        return ToActionResult(await _offers.GetReceivedAsync(GetUserId(), status, page, pageSize, ct));
    }

    /// <summary>Antal nya (osedda) PR-erbjudanden (kreatör)</summary>
    [HttpGet("received/unread-count")]
    [Authorize(Policy = "CreatorOnly")]
    public async Task<IActionResult> GetUnreadCount(CancellationToken ct)
        => ToActionResult(await _offers.GetCreatorUnreadCountAsync(GetUserId(), ct));

    /// <summary>Hämta ett enskilt PR-erbjudande</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
        => ToActionResult(await _offers.GetAsync(id, GetUserId(), ct));

    /// <summary>Markera ett PR-erbjudande som sett (kreatör)</summary>
    [HttpPost("{id:guid}/view")]
    [Authorize(Policy = "CreatorOnly")]
    public async Task<IActionResult> MarkViewed(Guid id, CancellationToken ct)
        => ToActionResult(await _offers.MarkViewedAsync(id, GetUserId(), ct));

    /// <summary>Tacka ja eller nej till ett PR-erbjudande (kreatör)</summary>
    [HttpPost("{id:guid}/respond")]
    [Authorize(Policy = "CreatorOnly")]
    public async Task<IActionResult> Respond(Guid id, [FromBody] RespondPrOfferRequest request, CancellationToken ct)
        => ToActionResult(await _offers.RespondAsync(id, GetUserId(), request, ct));

    /// <summary>Dra tillbaka ett skickat PR-erbjudande (företag)</summary>
    [HttpPost("{id:guid}/withdraw")]
    [Authorize(Policy = "BrandOnly")]
    public async Task<IActionResult> Withdraw(Guid id, CancellationToken ct)
        => ToActionResult(await _offers.WithdrawAsync(id, GetUserId(), ct));
}
