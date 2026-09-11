import { DEFAULT_TEMPLATE, DEFAULT_THEME } from "../../lib/cv-templates.ts";
import {
  type Capability,
  type PlanId,
  type PlanLimits,
  CURRENT_PLAN_VERSION,
  entitlements,
  isPlanId,
  templateAllowed,
  themeAllowed,
} from "../../lib/entitlements.ts";
import { db } from "./db.ts";

/**
 * Plan resolution and quota accounting.
 *
 * Lives under `agent/lib` rather than `app/lib` because the tools need it too:
 * `analyze_jd` is where an application is actually created, so that is where
 * the quota has to hold. The Next routes reach it through
 * `@/agent/lib/billing.ts`.
 *
 * Nothing here writes `plan`. The Stripe webhook is the only writer — a
 * `success_url` can be typed into the address bar, so a redirect is never
 * evidence that money moved.
 */

export type BillingRow = {
  userId: string;
  plan: string;
  planVersion: number;
  status: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  credits: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
};

/** The defaults a user with no `Billing` row resolves to. */
function freeRow(userId: string): BillingRow {
  return {
    userId,
    plan: "free",
    planVersion: CURRENT_PLAN_VERSION,
    status: null,
    periodStart: null,
    periodEnd: null,
    cancelAtPeriodEnd: false,
    credits: 0,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
  };
}

/**
 * Read-only. Deliberately does not create the row: a page view is not a reason
 * to write, and every existing account already behaves correctly as free. The
 * row appears the first time checkout needs a Stripe customer id.
 */
export async function getBilling(userId: string): Promise<BillingRow> {
  const row = await db.billing.findUnique({ where: { userId } });
  return row ?? freeRow(userId);
}

/**
 * Statuses that keep a paid plan alive.
 *
 * `past_due` is in the list on purpose: a card that failed its first retry is
 * a payment problem, not a reason to lock someone out of the CV they are
 * editing. Stripe keeps retrying and moves the subscription to `canceled` when
 * it gives up, which is when access actually ends.
 */
const LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

/**
 * The plan this user is on right now.
 *
 * A canceled subscription keeps its plan until the period the user paid for
 * runs out — `cancel_at_period_end` is a scheduled ending, not an immediate
 * one, and taking access away the moment somebody clicks cancel is how a
 * lapsed subscriber becomes a chargeback.
 */
export function planOf(billing: BillingRow): PlanId {
  if (!isPlanId(billing.plan) || billing.plan === "free") return "free";
  if (billing.status !== null && LIVE_STATUSES.has(billing.status)) return billing.plan;
  if (billing.periodEnd !== null && billing.periodEnd.getTime() > Date.now()) return billing.plan;
  return "free";
}

/**
 * Start of the window the allowance is counted over.
 *
 * Stripe's own period, never the calendar month: someone who subscribes on the
 * 28th and resets on the 1st would otherwise get two full allowances in four
 * days. Free plans count over the lifetime of the account, so the window opens
 * at the epoch.
 */
export function windowStart(billing: BillingRow, limits: PlanLimits): Date {
  if (limits.applicationWindow === "lifetime") return new Date(0);
  if (billing.periodStart !== null) return billing.periodStart;
  // A paid plan with no period recorded yet (the webhook has not landed).
  // Falling back to the last 30 days is the conservative read.
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

export type BillingState = {
  billing: BillingRow;
  plan: PlanId;
  limits: PlanLimits;
  windowStart: Date;
  usage: { applications: number; agentTurns: number; cvImports: number };
  /** Applications left before credits are touched. Never negative. */
  remaining: number;
  /** Successful CV imports left in this window. Never negative. */
  cvImportsLeft: number;
  credits: number;
};

/** Everything a gate or a meter needs, in one round trip. */
export async function billingState(userId: string): Promise<BillingState> {
  const billing = await getBilling(userId);
  const plan = planOf(billing);
  const limits = entitlements(plan, billing.planVersion);
  const since = windowStart(billing, limits);

  const [applications, agentTurns, cvImports] = await Promise.all([
    db.usageEvent.count({ where: { userId, kind: "application", createdAt: { gte: since } } }),
    db.usageEvent.count({ where: { userId, kind: "chat_turn", createdAt: { gte: since } } }),
    db.usageEvent.count({ where: { userId, kind: "cv_import", createdAt: { gte: since } } }),
  ]);

  return {
    billing,
    plan,
    limits,
    windowStart: since,
    usage: { applications, agentTurns, cvImports },
    remaining: Math.max(0, limits.applications - applications),
    cvImportsLeft: Math.max(0, limits.cvImports - cvImports),
    credits: billing.credits,
  };
}

/**
 * Whether this user may still import a CV.
 *
 * Separate from `userCan(userId, "cvImport")`, which only says the plan allows
 * imports in principle. Every plan does; what runs out is the count.
 */
export async function canImportCv(userId: string): Promise<boolean> {
  const state = await billingState(userId);
  return state.limits.cvImport && state.cvImportsLeft > 0;
}

/**
 * Records one *successful* import.
 *
 * Called after the parse lands, never when it starts. A PDF the model could
 * not read costs the user nothing — spending somebody's single free import on
 * a failed parse is the kind of thing that ends in a refund request, and the
 * work is already done by then anyway.
 */
export async function recordCvImport(userId: string): Promise<void> {
  await db.usageEvent.create({ data: { userId, kind: "cv_import" } });
}

export async function planFor(userId: string): Promise<PlanId> {
  return planOf(await getBilling(userId));
}

/** Whether this user may do `capability` right now. */
export async function userCan(userId: string, capability: Capability): Promise<boolean> {
  const billing = await getBilling(userId);
  return entitlements(planOf(billing), billing.planVersion)[capability];
}

/**
 * Forces a layout and colour down to what this plan may actually render.
 *
 * Every surface that compiles a PDF calls it — the tool, the save route, the
 * preview route — because the template is a string on the wire and a locked
 * layout is one hand-written request away otherwise. A refusal would be the
 * wrong answer: the user asked for a document, so they get the document, in
 * the layout their plan includes.
 */
export async function clampSkin(
  userId: string,
  template: string | null | undefined,
  theme: string | null | undefined,
): Promise<{ template: string; theme: string }> {
  const plan = await planFor(userId);
  return {
    template:
      template && templateAllowed(plan, template) ? template : DEFAULT_TEMPLATE,
    theme: theme && themeAllowed(plan, theme) ? theme : DEFAULT_THEME,
  };
}

/** Thrown by the `require*` helpers. Routes turn it into a 402. */
export class PaywallError extends Error {
  readonly capability: Capability | "applications" | "agentTurns";

  constructor(capability: Capability | "applications" | "agentTurns", message: string) {
    super(message);
    this.name = "PaywallError";
    this.capability = capability;
  }
}

export async function requireCapability(userId: string, capability: Capability): Promise<void> {
  if (!(await userCan(userId, capability))) {
    throw new PaywallError(capability, `Your plan does not include ${capability}.`);
  }
}

export type QuotaVerdict =
  | { ok: true; source: "allowance" | "credit"; eventId: string }
  | { ok: false; used: number; limit: number; plan: PlanId; window: "lifetime" | "period" };

/**
 * Spends one application against the allowance, or against a purchased credit
 * once the allowance is gone.
 *
 * The `UsageEvent` row — not the `Application` row — is the receipt. An
 * application the user deletes still cost a model call, and counting rows
 * would hand anybody a free-tier reset button.
 *
 * Two simultaneous creates can both pass the count and spend one allowance
 * slot twice. The credit decrement is guarded (`credits: { gt: 0 }`) so money
 * can never go negative, and one extra application on a race is a far smaller
 * problem than a transaction held open across a model call.
 */
export async function consumeApplication(
  userId: string,
  applicationId?: string,
): Promise<QuotaVerdict> {
  const state = await billingState(userId);
  const withinAllowance = state.usage.applications < state.limits.applications;

  if (!withinAllowance) {
    const spent = await db.billing.updateMany({
      where: { userId, credits: { gt: 0 } },
      data: { credits: { decrement: 1 } },
    });
    if (spent.count === 0) {
      await notifyQuota(userId, state, "exhausted");
      return {
        ok: false,
        used: state.usage.applications,
        limit: state.limits.applications,
        plan: state.plan,
        window: state.limits.applicationWindow,
      };
    }
  }

  const event = await db.usageEvent.create({
    data: { userId, kind: "application", applicationId: applicationId ?? null },
    select: { id: true },
  });

  // Counted after the write, so "you have used 24 of 30" is true when it is sent.
  await notifyQuota(userId, state, "spent");

  return { ok: true, source: withinAllowance ? "allowance" : "credit", eventId: event.id };
}

/**
 * Gives back an application that was charged for but never created.
 *
 * `consumeApplication` spends the quota before the row exists, because the
 * quota is what decides whether the row may exist at all. When the insert is
 * then refused — the unique constraint catching a duplicate dispatch — the
 * user must not be billed for an application they did not get.
 */
export async function refundApplication(userId: string, quota: QuotaVerdict): Promise<void> {
  if (!quota.ok) return;

  await db.usageEvent.deleteMany({ where: { id: quota.eventId, userId } });
  if (quota.source === "credit") {
    await db.billing.updateMany({ where: { userId }, data: { credits: { increment: 1 } } });
  }
}

/** Fraction of the allowance that triggers the heads-up email. */
const QUOTA_WARNING_AT = 0.8;

/**
 * Emails 8 and 9: nearly out, and out.
 *
 * Sent at most once per window per kind, and the receipt for that is a
 * `UsageEvent` — the same table the quota itself counts, so the "have we said
 * this already" question is answered by the window that is already being
 * queried rather than by a column that would need resetting on renewal.
 *
 * Best-effort throughout: a mail failure must never be the reason an
 * application is refused, or granted.
 */
async function notifyQuota(
  userId: string,
  state: BillingState,
  moment: "spent" | "exhausted",
): Promise<void> {
  try {
    const used = moment === "spent" ? state.usage.applications + 1 : state.usage.applications;
    const limit = state.limits.applications;

    const kind = moment === "exhausted" ? "quota_email_full" : "quota_email_warning";
    if (moment === "spent" && used < Math.ceil(limit * QUOTA_WARNING_AT)) return;
    // The warning has nothing to say once the allowance is actually gone; that
    // is the other email's job.
    if (moment === "spent" && used >= limit) return;

    const already = await db.usageEvent.count({
      where: { userId, kind, createdAt: { gte: state.windowStart } },
    });
    if (already > 0) return;

    const { recipientFor, sendQuotaExhausted, sendQuotaWarning } = await import(
      "./billing-email.ts"
    );
    const to = await recipientFor(userId);
    if (!to) return;

    await db.usageEvent.create({ data: { userId, kind } });

    if (moment === "exhausted") await sendQuotaExhausted(to, state.plan);
    else await sendQuotaWarning(to, state.plan, used);
  } catch (cause) {
    console.warn("billing: quota email failed", cause);
  }
}

/**
 * Records one agent turn and says whether it was within budget.
 *
 * Called before the turn runs, so a user who is already over does not get to
 * start another one. The turn budget is the real cost ceiling in this product:
 * every turn resends the whole conversation, so cost grows with the square of
 * a thread's length, not with its length.
 */
export async function consumeAgentTurn(
  userId: string,
): Promise<{ ok: boolean; used: number; limit: number; plan: PlanId }> {
  const state = await billingState(userId);
  if (state.usage.agentTurns >= state.limits.agentTurns) {
    return {
      ok: false,
      used: state.usage.agentTurns,
      limit: state.limits.agentTurns,
      plan: state.plan,
    };
  }

  await db.usageEvent.create({ data: { userId, kind: "chat_turn" } });
  return {
    ok: true,
    used: state.usage.agentTurns + 1,
    limit: state.limits.agentTurns,
    plan: state.plan,
  };
}
