import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type Attachment, Resend } from "resend";

/**
 * Transactional email through Resend. Like Google sign-in, it stays optional:
 * without an API key the app still runs, and the callers decide what that
 * means (see `agent/lib/verification.ts`, which auto-verifies instead of
 * dead-ending a sign-up behind an email that will never arrive).
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function client(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY must be set to send email.");
  return new Resend(key);
}

/** The From address must belong to a domain verified in the Resend dashboard. */
function from(): string {
  return process.env.EMAIL_FROM ?? "Wellsuited <noreply@younesshassoune.dev>";
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Attachment[];
}): Promise<void> {
  const { error } = await client().emails.send({
    from: from(),
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    attachments: options.attachments,
  });
  if (error) throw new Error(`Resend rejected the message: ${error.message}`);
}

const LOGO_CID = "wellsuited-logo";
let logoAttachment: Attachment | null | undefined;

/**
 * The logo rides along as an inline attachment rather than an `<img src>` to a
 * public URL. A hosted image needs a reachable origin — which a local or
 * preview deploy does not have — and mail clients block remote images by
 * default anyway. `cid:` renders without either problem.
 *
 * Read once: the file never changes while the process lives. A miss is cached
 * as null so a broken install does not stat the disk on every send.
 */
async function logo(): Promise<Attachment | null> {
  if (logoAttachment !== undefined) return logoAttachment;
  try {
    const content = await readFile(join(process.cwd(), "public", "logo-mark.png"));
    logoAttachment = {
      content,
      filename: "logo.png",
      contentType: "image/png",
      contentId: LOGO_CID,
    };
  } catch {
    logoAttachment = null;
  }
  return logoAttachment;
}

/**
 * Plain-table HTML, because that is what mail clients render consistently —
 * flexbox and modern CSS are not reliable here. Widths and colours are inline
 * for the same reason: Gmail strips a `<style>` block.
 */
export function verificationHtml(link: string, name: string | null, withLogo: boolean): string {
  const greeting = name ? `Hi ${escapeHtml(name.split(" ")[0] ?? name)},` : "Hi,";
  const mark = withLogo
    ? `<img src="cid:${LOGO_CID}" width="40" height="40" alt="Wellsuited" style="display:block;border:0;outline:none;text-decoration:none;" />`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="color-scheme" content="light" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Confirm your email address to finish setting up Wellsuited.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">

            <tr>
              <td align="center" style="padding-bottom:24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    ${mark ? `<td style="padding-right:10px;vertical-align:middle;">${mark}</td>` : ""}
                    <td style="vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:19px;font-weight:600;letter-spacing:-0.02em;color:#18181b;">Wellsuited</td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="background:#ffffff;border:1px solid #e4e4e7;border-radius:14px;padding:40px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                <h1 style="margin:0 0 20px;font-size:22px;line-height:28px;font-weight:600;letter-spacing:-0.02em;color:#18181b;">Confirm your email</h1>

                <p style="margin:0 0 14px;font-size:15px;line-height:24px;color:#3f3f46;">${greeting}</p>
                <p style="margin:0 0 28px;font-size:15px;line-height:24px;color:#3f3f46;">
                  One click and your Wellsuited account is ready. You'll be signed in straight away no password to type again.
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td align="center" style="border-radius:10px;background:#18181b;">
                      <a href="${link}" style="display:block;padding:14px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:500;color:#ffffff;text-decoration:none;">Confirm email address</a>
                    </td>
                  </tr>
                </table>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding-top:28px;border-top:1px solid #f4f4f5;margin-top:28px;"></td>
                  </tr>
                </table>

                <p style="margin:0;font-size:13px;line-height:20px;color:#71717a;">
                  This link expires in 24 hours and can be used once.
                </p>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding-top:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:20px;color:#a1a1aa;">
                Didn't create a Wellsuited account? Ignore this email.
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendVerificationEmail(options: {
  to: string;
  name: string | null;
  link: string;
}): Promise<void> {
  const mark = await logo();

  await sendEmail({
    to: options.to,
    subject: "Confirm your email · Wellsuited",
    html: verificationHtml(options.link, options.name, mark !== null),
    // The plain-text part has no button to carry the link, so it keeps the URL.
    text: `Confirm your email address to finish setting up your Wellsuited account:\n\n${options.link}\n\nThis link expires in 24 hours and can be used once. If you didn't create a Wellsuited account, ignore this email.`,
    attachments: mark ? [mark] : undefined,
  });
}
