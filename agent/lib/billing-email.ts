import { entitlements, type PlanId } from "../../lib/entitlements.ts";
import { db } from "./db.ts";
import { emailConfigured, logo, renderEmail, sendEmail } from "./email.ts";

/**
 * Every email the billing system sends.
 *
 * All of them are best-effort. A webhook that fails because Resend had a bad
 * second gets retried by Stripe, and the retry would re-run a database write
 * that already succeeded — so a bounced email must never be the reason a
 * payment fails to register. `send()` swallows everything and logs.
 *
 * Without `RESEND_API_KEY` nothing here does anything, which is the same
 * contract the rest of the app's email has.
 */

function appUrl(path: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return new URL(path, base).toString();
}

type Recipient = { email: string; name: string | null };

/** The address for a user id, or null when there is nobody to write to. */
export async function recipientFor(userId: string): Promise<Recipient | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, emailVerified: true },
  });
  // An unverified address is one we have no permission to mail beyond the
  // verification link itself.
  if (!user?.emailVerified) return null;
  return { email: user.email, name: user.name };
}

async function send(options: {
  to: Recipient;
  subject: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  cta?: { label: string; href: string };
  footnote?: string;
  text: string;
}): Promise<void> {
  if (!emailConfigured()) return;

  try {
    const mark = await logo();
    await sendEmail({
      to: options.to.email,
      subject: options.subject,
      html: renderEmail({
        preheader: options.preheader,
        heading: options.heading,
        name: options.to.name,
        paragraphs: options.paragraphs,
        cta: options.cta,
        footnote: options.footnote,
        outro: "You are receiving this because you have a Wellsuited account.",
        withLogo: mark !== null,
      }),
      text: options.text,
      attachments: mark ? [mark] : undefined,
    });
  } catch (cause) {
    // Never fatal. A missing email is a worse day than a failed webhook is.
    console.warn(`billing-email: "${options.subject}" was not sent`, cause);
  }
}

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format(
    amount,
  );
}

function longDate(value: Date | null): string | null {
  return value
    ? value.toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" })
    : null;
}

/** 1. The subscription just started. */
export async function sendSubscriptionStarted(
  to: Recipient,
  plan: PlanId,
  periodEnd: Date | null,
): Promise<void> {
  const limits = entitlements(plan);
  const renews = longDate(periodEnd);

  await send({
    to,
    subject: `You're on ${limits.label} · Wellsuited`,
    preheader: `${limits.applications} tailored applications a month, chat, and your ATS score.`,
    heading: `Welcome to ${limits.label}`,
    paragraphs: [
      `Your payment went through and everything is unlocked: ${limits.applications} tailored applications a month, follow-up chat on every CV, your ATS score with the gaps named, and all six layouts.`,
      renews ? `Your plan renews on ${renews}. You can cancel any time before then.` : "",
      "Paste a job description and see what it does.",
    ].filter(Boolean),
    cta: { label: "Open Wellsuited", href: appUrl("/dashboard") },
    footnote: "Invoices and receipts live on your billing page.",
    text: `Welcome to ${limits.label}. Your payment went through and everything is unlocked: ${limits.applications} tailored applications a month, follow-up chat, your ATS score and all six layouts.${renews ? ` Your plan renews on ${renews}.` : ""}\n\n${appUrl("/dashboard")}`,
  });
}

/** 2. Moved between paid plans. */
export async function sendPlanChanged(
  to: Recipient,
  from: PlanId,
  plan: PlanId,
  periodEnd: Date | null,
): Promise<void> {
  const limits = entitlements(plan);
  const previous = entitlements(from);
  const up = limits.applications > previous.applications;
  const renews = longDate(periodEnd);

  await send({
    to,
    subject: `Your plan is now ${limits.label} · Wellsuited`,
    preheader: `${previous.label} → ${limits.label}. ${limits.applications} applications a month.`,
    heading: `You moved to ${limits.label}`,
    paragraphs: [
      `${previous.label} → ${limits.label}. That is ${limits.applications} tailored applications a month${up ? ", up from" : ", down from"} ${previous.applications}.`,
      renews ? `Your next payment is on ${renews}.` : "",
      "Stripe has charged or credited the difference for the rest of this period, so you have only paid for what you used.",
    ].filter(Boolean),
    cta: { label: "See your plan", href: appUrl("/dashboard/billing") },
    text: `Your plan is now ${limits.label} (was ${previous.label}): ${limits.applications} tailored applications a month.${renews ? ` Next payment ${renews}.` : ""}\n\n${appUrl("/dashboard/billing")}`,
  });
}

/** 3. A cancellation is scheduled for the end of the period. */
export async function sendCancellationScheduled(
  to: Recipient,
  plan: PlanId,
  periodEnd: Date | null,
): Promise<void> {
  const limits = entitlements(plan);
  const ends = longDate(periodEnd);

  await send({
    to,
    subject: `Your ${limits.label} plan ends${ends ? ` on ${ends}` : " soon"} · Wellsuited`,
    preheader: "Nothing is deleted, and you can undo this any time before then.",
    heading: "Your plan is set to end",
    paragraphs: [
      ends
        ? `${limits.label} stays exactly as it is until ${ends}, which you have already paid for. After that the account goes back to Free.`
        : `${limits.label} stays as it is until the end of the period you have paid for. After that the account goes back to Free.`,
      "Every CV and application you have made stays where it is, still readable and still downloadable. Your master profile is untouched.",
      "If this was not what you meant, one click puts it back.",
    ],
    cta: { label: "Keep my plan", href: appUrl("/dashboard/billing") },
    text: `Your ${limits.label} plan is set to end${ends ? ` on ${ends}` : ""}. Everything you have made stays. Undo it at ${appUrl("/dashboard/billing")}`,
  });
}

/** 4. The subscription has actually ended. */
export async function sendSubscriptionEnded(to: Recipient, plan: PlanId): Promise<void> {
  const previous = entitlements(plan);
  const free = entitlements("free");

  await send({
    to,
    subject: "Your plan has ended · Wellsuited",
    preheader: "Your CVs are still here. You are on the Free plan now.",
    heading: `${previous.label} has ended`,
    paragraphs: [
      `Your account is on the Free plan from today: ${free.applications} application, two layouts, and no follow-up chat or ATS score.`,
      "Nothing was deleted. Every CV, application and PDF you made on a paid plan is still in your account, and your master profile is exactly as you left it.",
      "If you start applying to things again, picking the plan back up takes a minute.",
    ],
    cta: { label: "See plans", href: appUrl("/dashboard/pricing") },
    text: `Your ${previous.label} plan has ended and your account is on Free. Nothing was deleted — every CV you made is still there. ${appUrl("/dashboard/pricing")}`,
  });
}

/** 5. A scheduled cancellation was taken back. */
export async function sendCancellationReverted(
  to: Recipient,
  plan: PlanId,
  periodEnd: Date | null,
): Promise<void> {
  const limits = entitlements(plan);
  const renews = longDate(periodEnd);

  await send({
    to,
    subject: `Your ${limits.label} plan is staying · Wellsuited`,
    preheader: "The cancellation is off. Nothing changes.",
    heading: "Your plan is staying",
    paragraphs: [
      `${limits.label} is no longer set to end.${renews ? ` It renews as usual on ${renews}.` : ""}`,
      "Nothing about your account changed in the meantime.",
    ],
    cta: { label: "Open Wellsuited", href: appUrl("/dashboard") },
    text: `Your ${limits.label} plan is no longer set to end.${renews ? ` It renews on ${renews}.` : ""}`,
  });
}

/** 6. A payment failed. */
export async function sendPaymentFailed(
  to: Recipient,
  plan: PlanId,
  amount: number | null,
  currency: string,
): Promise<void> {
  const limits = entitlements(plan);

  await send({
    to,
    subject: "Your payment did not go through · Wellsuited",
    preheader: "Nothing is locked yet. Updating your card fixes it.",
    heading: "Your payment did not go through",
    paragraphs: [
      amount !== null
        ? `We could not take ${money(amount, currency)} for your ${limits.label} plan.`
        : `We could not take this month's payment for your ${limits.label} plan.`,
      "Nothing is locked. Your plan keeps working while Stripe retries over the next few days, and updating your card settles it straight away.",
      "The usual cause is an expired card or a bank that declined an unfamiliar charge.",
    ],
    cta: { label: "Update your card", href: appUrl("/dashboard/billing") },
    footnote: "If the retries run out, the account goes back to the Free plan. Nothing is deleted.",
    text: `Your payment for ${limits.label} did not go through. Nothing is locked yet — update your card at ${appUrl("/dashboard/billing")}`,
  });
}

/** 7. A payment succeeded. */
export async function sendPaymentReceipt(options: {
  to: Recipient;
  plan: PlanId;
  amount: number;
  currency: string;
  invoiceNumber: string | null;
  hostedUrl: string | null;
  periodEnd: Date | null;
}): Promise<void> {
  const limits = entitlements(options.plan);
  const renews = longDate(options.periodEnd);

  await send({
    to: options.to,
    subject: `Receipt for ${money(options.amount, options.currency)} · Wellsuited`,
    preheader: `${limits.label}${options.invoiceNumber ? ` · ${options.invoiceNumber}` : ""}`,
    heading: "Payment received",
    paragraphs: [
      `${money(options.amount, options.currency)} for Wellsuited ${limits.label}${options.invoiceNumber ? `, invoice ${options.invoiceNumber}` : ""}.`,
      renews ? `Your next payment is on ${renews}.` : "",
      "The full invoice, with tax details, is on Stripe.",
    ].filter(Boolean),
    cta: options.hostedUrl
      ? { label: "View invoice", href: options.hostedUrl }
      : { label: "See your invoices", href: appUrl("/dashboard/billing") },
    text: `Payment received: ${money(options.amount, options.currency)} for Wellsuited ${limits.label}.${renews ? ` Next payment ${renews}.` : ""}${options.hostedUrl ? `\n\n${options.hostedUrl}` : ""}`,
  });
}

/** 8. Most of the allowance is gone. */
export async function sendQuotaWarning(
  to: Recipient,
  plan: PlanId,
  used: number,
): Promise<void> {
  const limits = entitlements(plan);
  const left = Math.max(0, limits.applications - used);

  await send({
    to,
    subject: `${left} ${left === 1 ? "application" : "applications"} left on your plan · Wellsuited`,
    preheader: `${used} of ${limits.applications} used.`,
    heading: `${left} ${left === 1 ? "application" : "applications"} left`,
    paragraphs: [
      `You have used ${used} of the ${limits.applications} tailored applications on ${limits.label}.`,
      limits.applicationWindow === "period"
        ? "The count resets when your plan renews. A larger plan starts it again today."
        : "A paid plan gives you a monthly allowance instead of a one-off.",
    ],
    cta: { label: "See plans", href: appUrl("/dashboard/pricing") },
    text: `You have used ${used} of ${limits.applications} applications on ${limits.label}. ${appUrl("/dashboard/pricing")}`,
  });
}

/** 9. The allowance is gone. */
export async function sendQuotaExhausted(to: Recipient, plan: PlanId): Promise<void> {
  const limits = entitlements(plan);
  const pro = entitlements("pro");

  await send({
    to,
    subject: "You are out of applications · Wellsuited",
    preheader: `${limits.label} includes ${limits.applications}. Everything you made is still here.`,
    heading: "You are out of applications",
    paragraphs: [
      `That was the ${limits.applications === 1 ? "one application" : `${limits.applications} applications`} included with ${limits.label}.`,
      `Pro tailors ${pro.applications} a month, with follow-up chat on every CV, your ATS score, and all six layouts.`,
      "Everything you have already made stays exactly where it is.",
    ],
    cta: { label: "See plans", href: appUrl("/dashboard/pricing") },
    text: `You have used all ${limits.applications} applications included with ${limits.label}. Pro tailors ${pro.applications} a month. ${appUrl("/dashboard/pricing")}`,
  });
}
