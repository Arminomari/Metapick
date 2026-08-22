using System.Net;

namespace CreatorPay.Application.Common;

/// <summary>
/// Branded HTML email shell (VYRLE warm-ivory/peach design). Table-based with
/// inline styles so it renders in Gmail/Outlook; the star mark is text-based
/// because most email clients strip SVG.
/// </summary>
public static class EmailTemplates
{
    public static string Branded(string title, string bodyHtml, string? ctaText = null, string? ctaUrl = null)
    {
        var cta = ctaText != null && ctaUrl != null
            ? $"""
               <tr><td align="center" style="padding:28px 0 6px">
                 <a href="{WebUtility.HtmlEncode(ctaUrl)}"
                    style="display:inline-block;background:#0B0F17;color:#FFF4EC;text-decoration:none;
                           font-weight:600;font-size:15px;padding:14px 34px;border-radius:980px">
                   {WebUtility.HtmlEncode(ctaText)}</a>
               </td></tr>
               """
            : "";

        return $"""
            <!DOCTYPE html>
            <html lang="sv"><body style="margin:0;padding:0;background:#FFF4EC">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF4EC;padding:32px 12px">
              <tr><td align="center">
                <table role="presentation" width="520" cellpadding="0" cellspacing="0"
                       style="max-width:520px;width:100%;background:#FFFFFF;border-radius:24px;padding:40px 36px;
                              font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#0B0F17">
                  <tr><td align="center" style="padding-bottom:26px">
                    <span style="font-size:26px;font-weight:700;letter-spacing:-0.5px;color:#0B0F17">
                      <span style="color:#F1A88F">&#10022;</span>&nbsp;VYRLE</span>
                  </td></tr>
                  <tr><td align="center" style="font-size:22px;font-weight:700;letter-spacing:-0.3px;padding-bottom:14px">
                    {WebUtility.HtmlEncode(title)}</td></tr>
                  <tr><td style="font-size:15px;line-height:1.6;color:#2C333F">{bodyHtml}</td></tr>
                  {cta}
                  <tr><td align="center" style="padding-top:30px;font-size:12px;color:#B7BCC8">
                    VYRLE &middot; <a href="https://www.vyrle.co" style="color:#C26A4A;text-decoration:none">www.vyrle.co</a><br>
                    Du får det här mejlet för att du har ett konto hos VYRLE.</td></tr>
                </table>
              </td></tr>
            </table>
            </body></html>
            """;
    }
}
