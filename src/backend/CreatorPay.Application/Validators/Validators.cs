using CreatorPay.Application.DTOs;
using FluentValidation;

namespace CreatorPay.Application.Validators;

public class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8).MaximumLength(128)
            .Matches(@"[A-Z]").WithMessage("Lösenord måste innehålla minst en versal")
            .Matches(@"[a-z]").WithMessage("Lösenord måste innehålla minst en gemen")
            .Matches(@"[0-9]").WithMessage("Lösenord måste innehålla minst en siffra");
        RuleFor(x => x.Role).NotEmpty().Must(r => r == "Brand" || r == "Creator")
            .WithMessage("Role must be Brand or Creator");
        When(x => x.Role == "Brand", () =>
        {
            RuleFor(x => x.CompanyName).NotEmpty().MaximumLength(200);
            RuleFor(x => x.OrganizationNumber).NotEmpty().MaximumLength(50);
        });
        When(x => x.Role == "Creator", () =>
        {
            RuleFor(x => x.DisplayName).NotEmpty().MaximumLength(100);
        });
    }
}

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public class ChangePasswordRequestValidator : AbstractValidator<ChangePasswordRequest>
{
    public ChangePasswordRequestValidator()
    {
        RuleFor(x => x.CurrentPassword).NotEmpty();
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8).MaximumLength(128)
            .Matches(@"[A-Z]").WithMessage("Lösenord måste innehålla minst en versal")
            .Matches(@"[a-z]").WithMessage("Lösenord måste innehålla minst en gemen")
            .Matches(@"[0-9]").WithMessage("Lösenord måste innehålla minst en siffra");
    }
}

public class CreateCampaignRequestValidator : AbstractValidator<CreateCampaignRequest>
{
    private static readonly string[] ValidPayoutModels = ["Fixed", "Tiered", "CPM", "Hybrid"];

    public CreateCampaignRequestValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(5000);
        RuleFor(x => x.Category).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Country).NotEmpty().MaximumLength(2);
        RuleFor(x => x.RequiredHashtag).NotEmpty().MaximumLength(100);
        RuleFor(x => x.PayoutModel).NotEmpty()
            .Must(m => ValidPayoutModels.Contains(m)).WithMessage("Invalid payout model");
        RuleFor(x => x.Budget).GreaterThan(0);
        RuleFor(x => x.MaxCreators).GreaterThan(0).LessThanOrEqualTo(1000);
        RuleFor(x => x.StartDate).GreaterThanOrEqualTo(DateTime.UtcNow.Date);
        RuleFor(x => x.EndDate).GreaterThan(x => x.StartDate)
            .WithMessage("End date must be after start date");
        RuleFor(x => x.MinViews).GreaterThanOrEqualTo(0);

        RuleForEach(x => x.PayoutRules).SetValidator(new PayoutRuleValidator());
        RuleFor(x => x.PayoutRules).Must(r => r != null && r.Count > 0)
            .WithMessage("At least one payout rule required");
    }
}

public class PayoutRuleValidator : AbstractValidator<PayoutRuleDto>
{
    public PayoutRuleValidator()
    {
        RuleFor(x => x.PayoutType).NotEmpty();
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.MinViews).GreaterThanOrEqualTo(0);
        RuleFor(x => x.MaxViews).GreaterThan(x => x.MinViews)
            .When(x => x.MaxViews.HasValue);
    }
}

public class ApplyToCampaignRequestValidator : AbstractValidator<ApplyToCampaignRequest>
{
    public ApplyToCampaignRequestValidator()
    {
        RuleFor(x => x.CampaignId).NotEmpty();
        RuleFor(x => x.Message).MaximumLength(2000);
    }
}

public class SubmitVideoRequestValidator : AbstractValidator<SubmitVideoRequest>
{
    public SubmitVideoRequestValidator()
    {
        RuleFor(x => x.VideoUrl).NotEmpty().MaximumLength(500)
            .Must(IsValidTikTokUrl)
            .WithMessage("Must be a valid TikTok URL (https://www.tiktok.com/@user/video/...)");
    }

    private static bool IsValidTikTokUrl(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
            return false;
        if (uri.Scheme != "https")
            return false;
        return uri.Host is "www.tiktok.com" or "tiktok.com" or "vm.tiktok.com";
    }
}

public class RequestPayoutRequestValidator : AbstractValidator<RequestPayoutRequest>
{
    public RequestPayoutRequestValidator()
    {
        RuleFor(x => x.CalculationId).NotEmpty();
    }
}
