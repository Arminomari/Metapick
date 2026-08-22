using CreatorPay.Application.DTOs;
using FluentValidation;

namespace CreatorPay.Application.Validators;

public static class DobRules
{
    public static bool Reasonable(DateOnly? d) =>
        d == null || (d <= DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-13))
                   && d >= new DateOnly(1900, 1, 1));
}

public class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.DateOfBirth).Must(DobRules.Reasonable)
            .WithMessage("Ange ett rimligt födelsedatum — du måste vara minst 13 år.");
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
            // TikTok connection is mandatory at sign-up (handle now, OAuth verification after approval).
            RuleFor(x => x.TikTokUsername).NotEmpty()
                .WithMessage("TikTok-användarnamn krävs vid registrering")
                .MaximumLength(100);
            RuleFor(x => x.InstagramUsername).MaximumLength(100);
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

public class ChangeEmailRequestValidator : AbstractValidator<ChangeEmailRequest>
{
    public ChangeEmailRequestValidator()
    {
        RuleFor(x => x.NewEmail).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.CurrentPassword).NotEmpty();
    }
}

public class VerifyEmailRequestValidator : AbstractValidator<VerifyEmailRequest>
{
    public VerifyEmailRequestValidator() => RuleFor(x => x.Token).NotEmpty().MaximumLength(300);
}

public class CreateBrandPostRequestValidator : AbstractValidator<CreateBrandPostRequest>
{
    public CreateBrandPostRequestValidator()
    {
        RuleFor(x => x.Body).NotEmpty().MaximumLength(2000);
        RuleFor(x => x.ImageUrl).Must(CreatorPay.Application.Common.MediaValidation.IsValidImageRef)
            .WithMessage("Ogiltig bild");
    }
}

public class CheckEmailRequestValidator : AbstractValidator<CheckEmailRequest>
{
    public CheckEmailRequestValidator() => RuleFor(x => x.Email).NotEmpty().EmailAddress();
}

public class CheckTikTokRequestValidator : AbstractValidator<CheckTikTokRequest>
{
    public CheckTikTokRequestValidator() => RuleFor(x => x.Username).NotEmpty().MaximumLength(100);
}

public class ResendVerificationRequestValidator : AbstractValidator<ResendVerificationRequest>
{
    public ResendVerificationRequestValidator() => RuleFor(x => x.Email).NotEmpty().EmailAddress();
}

public class BroadcastRequestValidator : AbstractValidator<BroadcastRequest>
{
    public BroadcastRequestValidator()
    {
        RuleFor(x => x.Audience).Must(a => a is "All" or "Creators" or "Brands")
            .WithMessage("Målgrupp måste vara All, Creators eller Brands");
        RuleFor(x => x.Subject).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Message).NotEmpty().MaximumLength(4000);
    }
}

public class CreateAdminRequestValidator : AbstractValidator<CreateAdminRequest>
{
    public CreateAdminRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.FirstName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.LastName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Password).NotEmpty().MinimumLength(12).MaximumLength(128)
            .Matches(@"[A-Z]").WithMessage("Lösenord måste innehålla minst en versal")
            .Matches(@"[a-z]").WithMessage("Lösenord måste innehålla minst en gemen")
            .Matches(@"[0-9]").WithMessage("Lösenord måste innehålla minst en siffra");
    }
}

public class ForgotPasswordRequestValidator : AbstractValidator<ForgotPasswordRequest>
{
    public ForgotPasswordRequestValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
    }
}

public class ResetPasswordRequestValidator : AbstractValidator<ResetPasswordRequest>
{
    public ResetPasswordRequestValidator()
    {
        RuleFor(x => x.Token).NotEmpty();
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
    /// <summary>Locked business rule: CPM compensation may never be below 20 SEK per 1000 views.</summary>
    public const decimal MinCpmSek = 20m;

    public PayoutRuleValidator()
    {
        RuleFor(x => x.PayoutType).NotEmpty();
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.Amount).GreaterThanOrEqualTo(MinCpmSek)
            .When(x => string.Equals(x.PayoutType, "CPM", StringComparison.OrdinalIgnoreCase))
            .WithMessage("Priset måste vara minst 20 kr per 1 000 visningar");
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
