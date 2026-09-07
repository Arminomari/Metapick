using CreatorPay.Domain.Ugc;
using Microsoft.Extensions.Configuration;

namespace CreatorPay.Application.Ugc;

/// <summary>
/// Every knob the marketplace exposes, read once from the "Ugc" configuration
/// section with sane defaults. Registered as a singleton.
/// </summary>
public sealed class UgcSettings
{
    /// <summary>Vyrle's cut, as a percentage of the creator's amount. Brand pays it on top.</summary>
    public decimal PlatformFeePercent { get; init; } = UgcFeeCalculator.DefaultFeePercent;

    /// <summary>Days after submission before a silent brand approves by default.</summary>
    public int AutoApproveDays { get; init; } = UgcSchedule.DefaultAutoApproveDays;

    /// <summary>The shorter clock a creator gets for each revision round.</summary>
    public int RevisionDeadlineDays { get; init; } = UgcSchedule.DefaultRevisionDeadlineDays;

    public int MaxRevisions { get; init; } = 2;

    /// <summary>No-shows before a creator is suspended.</summary>
    public int StrikesToSuspend { get; init; } = 3;

    /// <summary>Automatic-verification bar.</summary>
    public int AutoVerifyMinFollowers { get; init; } = 1_000;
    public decimal AutoVerifyMinLikeFollowerRatio { get; init; } = 0.05m;

    /// <summary>Block paid jobs for creators without F-skatt. Off by default until the tax setup is decided.</summary>
    public bool RequireFTaxForPaid { get; init; } = false;

    /// <summary>Contract template set. Bump when the legal text changes so old collabs keep their version.</summary>
    public string ContractTemplateVersion { get; init; } = "2026-09-draft-1";

    public UgcVerificationThresholds Thresholds => new(AutoVerifyMinFollowers, AutoVerifyMinLikeFollowerRatio, StrikesToSuspend);

    public static UgcSettings From(IConfiguration config)
    {
        var s = config.GetSection("Ugc");
        return new UgcSettings
        {
            PlatformFeePercent = Dec(s["PlatformFeePercent"], UgcFeeCalculator.DefaultFeePercent),
            AutoApproveDays = Int(s["AutoApproveDays"], UgcSchedule.DefaultAutoApproveDays),
            RevisionDeadlineDays = Int(s["RevisionDeadlineDays"], UgcSchedule.DefaultRevisionDeadlineDays),
            MaxRevisions = Int(s["MaxRevisions"], 2),
            StrikesToSuspend = Int(s["StrikesToSuspend"], 3),
            AutoVerifyMinFollowers = Int(s["AutoVerifyMinFollowers"], 1_000),
            AutoVerifyMinLikeFollowerRatio = Dec(s["AutoVerifyMinLikeFollowerRatio"], 0.05m),
            RequireFTaxForPaid = Bool(s["RequireFTaxForPaid"], false),
            ContractTemplateVersion = s["ContractTemplateVersion"] ?? "2026-09-draft-1",
        };
    }

    private static int Int(string? v, int d) => int.TryParse(v, out var x) ? x : d;
    private static bool Bool(string? v, bool d) => bool.TryParse(v, out var x) ? x : d;
    private static decimal Dec(string? v, decimal d)
        => decimal.TryParse(v, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var x) ? x : d;
}
