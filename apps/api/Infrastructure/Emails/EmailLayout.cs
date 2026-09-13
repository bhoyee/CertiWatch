namespace CertiWatch.Api.Infrastructure.Emails;

// Shared visual shell for every transactional email CertiWatch sends - a consistent branded
// header, card, and footer around whatever body content a specific email supplies, instead of
// each call site hand-rolling its own bare, unstyled HTML fragment. Uses table layout and inline
// styles throughout (no <style> block) since that's what actually renders consistently across
// email clients, Outlook desktop in particular.
public static class EmailLayout
{
    public static string Wrap(string title, string bodyHtml)
    {
        return $"""
            <!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>{title}</title>
              </head>
              <body style="margin:0; padding:0; background-color:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;">
                  <tr>
                    <td align="center" style="padding:32px 16px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
                        <tr>
                          <td style="padding-bottom:20px;">
                            <table role="presentation" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="width:32px; height:32px; background-color:#4f46e5; border-radius:8px; text-align:center; vertical-align:middle;">
                                  <span style="color:#ffffff; font-size:16px; font-weight:700; line-height:32px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">C</span>
                                </td>
                                <td style="padding-left:10px; font-size:17px; font-weight:700; color:#0f172a;">CertiWatch</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td style="background-color:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:32px;">
                            <div style="color:#1e293b; font-size:14px; line-height:1.65;">
                              {bodyHtml}
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding-top:24px; text-align:center;">
                            <p style="margin:0; font-size:12px; color:#94a3b8;">This is an automated message from CertiWatch — please don't reply directly to this email.</p>
                            <p style="margin:6px 0 0; font-size:12px; color:#94a3b8;">&copy; {DateTime.UtcNow.Year} CertiWatch. All rights reserved.</p>
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
        $"""<h2 style="margin:0 0 16px; font-size:19px; font-weight:700; color:#0f172a;">{text}</h2>""";

    public static string Paragraph(string html) =>
        $"""<p style="margin:0 0 14px; color:#334155;">{html}</p>""";

    public static string Button(string href, string label) => $"""
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
          <tr>
            <td style="border-radius:8px; background-color:#4f46e5;">
              <a href="{href}" style="display:inline-block; padding:12px 22px; font-size:14px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">{label}</a>
            </td>
          </tr>
        </table>
        """;

    // A muted key/value panel - used for "here's what changed" style summaries (assignment,
    // status, plan details) so those facts read as structured data, not another run-on sentence.
    public static string InfoBox(string innerHtml) => $"""
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; border-radius:8px; margin:4px 0 20px;">
          <tr>
            <td style="padding:14px 16px; font-size:13px; color:#334155; line-height:1.9;">
              {innerHtml}
            </td>
          </tr>
        </table>
        """;

    public static string InfoRow(string label, string value) =>
        $"""<strong style="color:#0f172a;">{label}:</strong> {value}<br/>""";

    public static string Badge(string text, string textColor, string backgroundColor) =>
        $"""<span style="display:inline-block; padding:2px 10px; border-radius:999px; background-color:{backgroundColor}; color:{textColor}; font-size:12px; font-weight:600;">{text}</span>""";

    public static string MutedText(string html) =>
        $"""<p style="margin:0 0 8px; font-size:13px; color:#64748b;">{html}</p>""";
}
