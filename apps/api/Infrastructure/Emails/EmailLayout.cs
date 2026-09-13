namespace CertiWatch.Api.Infrastructure.Emails;

// Shared visual shell for every transactional email CertiWatch sends - a full-bleed branded
// header band, a white content card with a colored accent stripe and real shadow, and a footer
// with a divider - around whatever body content a specific email supplies, instead of each call
// site hand-rolling its own bare, unstyled HTML fragment. Table layout with inline styles
// throughout (no <style> block, no SVG) since that's what actually renders consistently across
// email clients, Outlook desktop in particular.
public static class EmailLayout
{
    private const string Ink = "#0f172a";
    private const string Body = "#334155";
    private const string Muted = "#64748b";
    private const string Brand = "#4f46e5";
    private const string BrandDark = "#4338ca";
    private const string Canvas = "#eef0f4";
    private const string FontStack = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

    public static string Wrap(string title, string bodyHtml)
    {
        return $"""
            <!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="color-scheme" content="light" />
                <title>{title}</title>
              </head>
              <body style="margin:0; padding:0; background-color:{Canvas}; font-family:{FontStack};">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:{Canvas};">
                  <tr>
                    <td align="center">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

                        <!-- Brand band -->
                        <tr>
                          <td style="background-color:{Brand}; border-radius:14px 14px 0 0; padding:26px 32px;" align="center">
                            <span style="display:inline-block; width:26px; height:26px; border:1.5px solid #ffffff; border-radius:7px; vertical-align:middle; line-height:24px; text-align:center; color:#ffffff; font-size:14px; font-weight:700; font-family:{FontStack};">C</span>
                            <span style="display:inline-block; vertical-align:middle; padding-left:10px; color:#ffffff; font-size:17px; font-weight:700; letter-spacing:0.01em;">CertiWatch</span>
                          </td>
                        </tr>

                        <!-- Card -->
                        <tr>
                          <td style="background-color:#ffffff; border:1px solid #e5e7eb; border-top:none; border-radius:0 0 14px 14px; box-shadow:0 1px 2px rgba(15,23,42,0.04);">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="height:4px; line-height:4px; font-size:0; background-color:{Brand};">&nbsp;</td>
                              </tr>
                              <tr>
                                <td style="padding:40px 36px;">
                                  <div style="color:{Body}; font-size:15px; line-height:1.7;">
                                    {bodyHtml}
                                  </div>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                          <td style="padding:28px 24px 8px;" align="center">
                            <table role="presentation" cellpadding="0" cellspacing="0">
                              <tr><td style="height:1px; line-height:1px; font-size:0; background-color:#dde1e7; width:80px;">&nbsp;</td></tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:0 24px 40px; text-align:center;">
                            <p style="margin:0; font-size:12px; color:{Muted}; line-height:1.6;">This is an automated message from CertiWatch — please don't reply directly to this email.</p>
                            <p style="margin:10px 0 0; font-size:12px; color:#9ca3af;">&copy; {DateTime.UtcNow.Year} CertiWatch. All rights reserved.</p>
                          </td>
                        </tr>

                      </table>
                    </td>
                  </tr>
                </table>
              </body>
            </html>
            """;
    }

    public static string Heading(string text) =>
        $"""<h2 style="margin:0 0 16px; font-size:21px; font-weight:700; letter-spacing:-0.01em; color:{Ink}; line-height:1.3;">{text}</h2>""";

    public static string Paragraph(string html) =>
        $"""<p style="margin:0 0 16px; color:{Body};">{html}</p>""";

    public static string Button(string href, string label) => $"""
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0 24px;">
          <tr>
            <td style="border-radius:8px; background-color:{Brand};">
              <a href="{href}" style="display:inline-block; padding:13px 26px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px; font-family:{FontStack};">{label}</a>
            </td>
          </tr>
        </table>
        """;

    // A left-accented panel - used for "here's what changed" style summaries (assignment,
    // status, plan details) so those facts read as a distinct, structured block rather than
    // blending into the surrounding prose.
    public static string InfoBox(string innerHtml) => $"""
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 24px; background-color:#f8fafc; border-radius:8px; border-left:3px solid {Brand};">
          <tr>
            <td style="padding:16px 18px; font-size:14px; color:{Body}; line-height:2;">
              {innerHtml}
            </td>
          </tr>
        </table>
        """;

    public static string InfoRow(string label, string value) =>
        $"""<strong style="color:{Ink};">{label}:</strong> {value}<br/>""";

    public static string Badge(string text, string textColor, string backgroundColor) =>
        $"""<span style="display:inline-block; padding:3px 11px; border-radius:999px; background-color:{backgroundColor}; color:{textColor}; font-size:12px; font-weight:600;">{text}</span>""";

    public static string MutedText(string html) =>
        $"""<p style="margin:0 0 8px; font-size:13px; color:{Muted};">{html}</p>""";

    public static string Divider() =>
        $"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="height:1px; line-height:1px; font-size:0; background-color:#e5e7eb;">&nbsp;</td></tr></table>""";
}
