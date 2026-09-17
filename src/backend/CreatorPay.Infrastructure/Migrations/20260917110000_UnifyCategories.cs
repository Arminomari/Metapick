using CreatorPay.Infrastructure.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CreatorPay.Infrastructure.Migrations;

/// <summary>
/// Creator profiles, campaigns, video orders and brand industries each had their
/// own category list ("Mat" vs "Mat &amp; Dryck", "Sport" vs "Fitness"), so
/// matching across them silently failed. One vocabulary from here on
/// (frontend: lib/categories.ts); this maps what is already stored.
/// Data-only — the model is unchanged. Each statement is guarded so a naming
/// surprise can never stop the API from starting.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20260917110000_UnifyCategories")]
public class UnifyCategories : Migration
{
    private static readonly (string From, string To)[] Map =
    [
        ("Mat", "Mat & Dryck"), ("Food", "Mat & Dryck"), ("Food & Drink", "Mat & Dryck"),
        ("Sport", "Sport & Hälsa"), ("Sports", "Sport & Hälsa"), ("Fitness", "Sport & Hälsa"), ("Hälsa", "Sport & Hälsa"), ("Health", "Sport & Hälsa"),
        ("Humor", "Humor & Nöje"), ("Nöje", "Humor & Nöje"),
        ("Fashion", "Mode"), ("Beauty", "Skönhet"), ("Tech", "Teknik"), ("Technology", "Teknik"),
        ("Travel", "Resor"), ("Music", "Musik"), ("Lifestyle", "Livsstil"), ("Other", "Övrigt"),
    ];

    private static readonly (string Table, string Column)[] TextColumns =
    [
        ("creator_profiles", "Category"), ("campaigns", "Category"), ("brand_profiles", "Industry"), ("pr_offers", "Category"),
    ];

    // string[] stored as JSON text. The serializer escapes non-ASCII and '&', so match both spellings.
    private static readonly (string Table, string Column)[] JsonColumns =
    [
        ("ugc_creator_profiles", "Categories"), ("ugc_campaigns", "Categories"),
    ];

    private static string Q(string s) => s.Replace("'", "''");
    private static string Escaped(string s) =>
        string.Concat(s.Select(c => c > 127 || c == '&' ? $"\\u{(int)c:X4}" : c.ToString()));

    protected override void Up(MigrationBuilder migrationBuilder)
    {
        foreach (var (table, column) in TextColumns)
            foreach (var (from, to) in Map)
                Guarded(migrationBuilder, $"UPDATE public.{table} SET \"{column}\" = '{Q(to)}' WHERE \"{column}\" = '{Q(from)}';");

        foreach (var (table, column) in JsonColumns)
            foreach (var (from, to) in Map)
                foreach (var needle in new[] { from, Escaped(from) }.Distinct())
                    Guarded(migrationBuilder,
                        $"UPDATE public.{table} SET \"{column}\" = REPLACE(\"{column}\", '\"{Q(needle)}\"', '\"{Q(to)}\"') " +
                        $"WHERE \"{column}\" LIKE '%\"{Q(needle).Replace("\\", "\\\\")}\"%';");
    }

    private static void Guarded(MigrationBuilder b, string sql) =>
        b.Sql($"DO $m$ BEGIN {sql} EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'UnifyCategories skipped a statement: %', SQLERRM; END $m$;");

    protected override void Down(MigrationBuilder migrationBuilder) { }
}
