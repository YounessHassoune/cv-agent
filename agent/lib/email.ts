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
export async function logo(): Promise<Attachment | null> {
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

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export type EmailLayout = {
  /** The grey line under the subject in an inbox list. */
  preheader: string;
  heading: string;
  /** Recipient's name, for the greeting. Null falls back to "Hi,". */
  name?: string | null;
  /** Body paragraphs. Escaped for you — pass plain text. */
  paragraphs: string[];
  cta?: { label: string; href: string };
  /** Small print under a hairline inside the card. */
  footnote?: string;
  /** Grey line under the card, outside it. */
  outro?: string;
  withLogo: boolean;
};

/**
 * The one email shell.
 *
 * Plain-table HTML, because that is what mail clients render consistently —
 * flexbox and modern CSS are not reliable here. Widths and colours are inline
 * for the same reason: Gmail strips a `<style>` block.
 *
 * Every message goes through this. Two shells drift, and the drift shows up as
 * one email that looks like a phishing attempt of the other.
 */
export function renderEmail(layout: EmailLayout): string {
  const greeting = layout.name
    ? `Hi ${escapeHtml(layout.name.split(" ")[0] ?? layout.name)},`
    : "Hi,";

  const mark = layout.withLogo
    ? `<img src="cid:${LOGO_CID}" width="40" height="40" alt="Wellsuited" style="display:block;border:0;outline:none;text-decoration:none;" />`
    : "";

  const body = layout.paragraphs
    .map(
      (text, index) =>
        `<p style="margin:0 0 ${index === layout.paragraphs.length - 1 ? 28 : 14}px;font-size:15px;line-height:24px;color:#3f3f46;">${escapeHtml(text)}</p>`,
    )
    .join("\n                ");

  const button = layout.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td align="center" style="border-radius:10px;background:#18181b;">
                      <a href="${layout.cta.href}" style="display:block;padding:14px 24px;font-family:${FONT};font-size:15px;font-weight:500;color:#ffffff;text-decoration:none;">${escapeHtml(layout.cta.label)}</a>
                    </td>
                  </tr>
                </table>`
    : "";

  const footnote = layout.footnote
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding-top:28px;border-top:1px solid #f4f4f5;margin-top:28px;"></td>
                  </tr>
                </table>

                <p style="margin:0;font-size:13px;line-height:20px;color:#71717a;">
                  ${escapeHtml(layout.footnote)}
                </p>`
    : "";

  const outro = layout.outro
    ? `<tr>
              <td align="center" style="padding-top:24px;font-family:${FONT};font-size:13px;line-height:20px;color:#a1a1aa;">
                ${escapeHtml(layout.outro)}
              </td>
            </tr>`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="color-scheme" content="light" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(layout.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">

            <tr>
              <td align="center" style="padding-bottom:24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    ${mark ? `<td style="padding-right:10px;vertical-align:middle;">${mark}</td>` : ""}
                    <td style="vertical-align:middle;font-family:${FONT};font-size:19px;font-weight:600;letter-spacing:-0.02em;color:#18181b;">Wellsuited</td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="background:#ffffff;border:1px solid #e4e4e7;border-radius:14px;padding:40px 36px;font-family:${FONT};">
                <h1 style="margin:0 0 20px;font-size:22px;line-height:28px;font-weight:600;letter-spacing:-0.02em;color:#18181b;">${escapeHtml(layout.heading)}</h1>

                <p style="margin:0 0 14px;font-size:15px;line-height:24px;color:#3f3f46;">${greeting}</p>
                ${body}

                ${button}

                ${footnote}
              </td>
            </tr>

            ${outro}

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function verificationHtml(link: string, name: string | null, withLogo: boolean): string {
  return renderEmail({
    preheader: "Confirm your email address to finish setting up Wellsuited.",
    heading: "Confirm your email",
    name,
    paragraphs: [
      "One click and your Wellsuited account is ready. You'll be signed in straight away — no password to type again.",
    ],
    cta: { label: "Confirm email address", href: link },
    footnote: "This link expires in 24 hours and can be used once.",
    outro: "Didn't create a Wellsuited account? Ignore this email.",
    withLogo,
  });
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
