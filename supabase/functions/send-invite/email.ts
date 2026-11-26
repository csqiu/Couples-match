// The partner-invite email, in the Technical / Sage & Plum look (docs/design-spec.md).
// Matches supabase/templates/*.html: inline styles and tables so it renders in every
// mail client. Web fonts load in Apple Mail / iOS; elsewhere the system fallbacks apply.

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const DISPLAY = "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const SANS = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const SAGE = '#5f7d5a';
const PLUM = '#6b4a7a';

export interface InviteEmail {
  /** The inviting partner's display name (plain text; escaped here). */
  inviterName: string;
  /** The invited address. */
  email: string;
  /** The /invite/<token> link. */
  link: string;
  /** Site root, e.g. https://getpairwise.app */
  appUrl: string;
}

export function inviteSubject(inviterName: string): string {
  return `${inviterName} invited you to plan your Couples Match list`;
}

export function inviteText({ inviterName, email, link }: InviteEmail): string {
  return [
    `${inviterName} invited you to build your NRMP Couples Match rank list together on Pairwise.`,
    '',
    `Accept the invite: ${link}`,
    '',
    `Sign in with ${email}. The link works once and expires in 7 days.`,
    '',
    "Not expecting this? You can ignore this email. Nothing happens unless you accept.",
    'Pairwise is a planning tool and is not affiliated with the NRMP.',
  ].join('\n');
}

const dot = (color: string) =>
  `<span style="display:inline-block; width:12px; height:12px; border-radius:50%; background-color:${color}; vertical-align:middle;"></span>`;

const detailRow = (label: string, value: string) => `
                        <tr>
                          <td style="color:#585d51; text-transform:uppercase; letter-spacing:0.08em; font-size:11px;">${label}</td>
                          <td align="right" style="font-weight:500;">${value}</td>
                        </tr>`;

export function inviteHtml({ inviterName, email, link, appUrl }: InviteEmail): string {
  const inviter = escapeHtml(inviterName);
  const to = escapeHtml(email);
  const href = escapeHtml(link);
  const site = escapeHtml(appUrl);
  const siteLabel = escapeHtml(appUrl.replace(/^https?:\/\//, ''));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${inviter} invited you to Pairwise</title>
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;600&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet" />
  </head>
  <body style="margin:0; padding:0; background-color:#f4f5f0; -webkit-text-size-adjust:100%;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:#f4f5f0;">
      ${inviter} wants to build your Couples Match list with you. The invite expires in 7 days.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f5f0" style="background-color:#f4f5f0; background-image:linear-gradient(120deg, #dfe7d6 0%, #e9ece2 45%, #ebe3ee 100%);">
      <tr>
        <td align="center" style="padding:44px 16px 40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
            <tr>
              <td style="padding:0 6px 22px 6px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td valign="middle" style="padding-right:10px; line-height:0; font-size:0;">
                      <span style="display:inline-block; width:20px; height:20px; border-radius:50%; background-color:${SAGE};"></span><span style="display:inline-block; width:20px; height:20px; border-radius:50%; background-color:${PLUM}; margin-left:-10px; opacity:0.92;"></span>
                    </td>
                    <td valign="middle" style="font-family:${DISPLAY}; font-size:21px; line-height:24px; font-weight:700; letter-spacing:-0.02em; color:#232620;">
                      Pairwise
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td bgcolor="#fdfdfa" style="background-color:#fdfdfa; border:1px solid #dcdfd2; border-radius:24px; padding:34px 30px 30px 30px; box-shadow:0 14px 36px -18px rgba(35,38,32,0.32), 0 2px 6px -2px rgba(35,38,32,0.08);">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-family:${MONO}; font-size:11.5px; line-height:14px; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; color:#585d51; padding-bottom:14px;">
                      Partner invite
                    </td>
                  </tr>
                  <tr>
                    <td style="font-family:${DISPLAY}; font-size:28px; line-height:32px; font-weight:600; letter-spacing:-0.025em; color:#232620; padding-bottom:12px;">
                      ${inviter} invited you to plan together
                    </td>
                  </tr>
                  <tr>
                    <td style="font-family:${SANS}; font-size:15px; line-height:23px; color:#585d51; padding-bottom:22px;">
                      Build your NRMP Couples Match rank list side by side. Each of you adds programs and preferences, and Pairwise turns them into one ordered list of program pairs.
                    </td>
                  </tr>
                  <!-- The couple: sage = partner 1 (inviter), plum = partner 2 (you) -->
                  <tr>
                    <td style="padding-bottom:26px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td bgcolor="#e6eee3" style="background-color:#e6eee3; border-radius:16px 0 0 16px; padding:12px 14px; font-family:${SANS}; font-size:14px; line-height:20px; color:#232620; width:50%;">
                            ${dot(SAGE)}&nbsp;&nbsp;<strong style="font-weight:600;">${inviter}</strong>
                          </td>
                          <td bgcolor="#efe7f2" style="background-color:#efe7f2; border-radius:0 16px 16px 0; padding:12px 14px; font-family:${SANS}; font-size:14px; line-height:20px; color:#232620; width:50%;">
                            ${dot(PLUM)}&nbsp;&nbsp;<strong style="font-weight:600;">You</strong>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="left" style="padding-bottom:26px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td align="center" bgcolor="#2b3529" style="border-radius:999px; background-color:#2b3529;">
                            <a href="${href}" target="_blank" style="display:inline-block; padding:14px 28px; font-family:${SANS}; font-size:15px; font-weight:600; line-height:18px; color:#f7f8f2; text-decoration:none; border-radius:999px;">
                              Accept the invite &rarr;
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td bgcolor="#eef0e8" style="background-color:#eef0e8; border-radius:16px; padding:14px 16px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family:${MONO}; font-size:12.5px; line-height:22px; color:#232620;">${detailRow('Sign in as', to)}${detailRow('Expires', '7 days')}${detailRow('Uses', '1')}
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:22px; font-family:${SANS}; font-size:13px; line-height:20px; color:#585d51;">
                      Button not working? Copy and paste this link into your browser:<br />
                      <a href="${href}" style="font-family:${MONO}; font-size:12px; color:#3d6838; word-break:break-all;">${href}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 6px 0 6px; font-family:${SANS}; font-size:12.5px; line-height:19px; color:#585d51;">
                Not expecting this? You can safely ignore this email. Nothing happens unless you accept. Pairwise is a planning tool and is not affiliated with the NRMP.
              </td>
            </tr>
            <tr>
              <td style="padding:14px 6px 0 6px; font-family:${MONO}; font-size:11px; line-height:16px; letter-spacing:0.08em; text-transform:uppercase; color:#585d51;">
                Pairwise &middot; <a href="${site}" style="color:#585d51; text-decoration:underline;">${siteLabel}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
