/**
 * What each plan is allowed to do, and how much of it.
 *
 * The only place these numbers exist. Server gates, agent tools and the UI all
 * read them from here — the pricing page prints `entitlements("pro").applications`
 * rather than the literal 30, so tuning an allowance is one edit and never
 * leaves a stale number on a marketing card.
 *
 * Client-safe on purpose: no database, no env, no server-only imports. The
 * upgrade dialog and the pricing cards import this file directly.
 */

export const PLAN_IDS = ["free", "pro", "max"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Every gate in the app, named. */
export type Capability =
  | "cvImport"
  | "applicationChat"
  | "atsScore"
  | "allTemplates"
  | "customThemeColor";

export type PlanLimits = {
  readonly label: string;
  readonly tagline: string;
  /**
   * Shown only when Stripe cannot be reached, and when the plan is free and
   * therefore has no Price at all.
   *
   * What a card is actually charged is the Stripe Price with the matching
   * lookup key, and the pricing page prints that. These exist so a marketing
   * page still renders during an outage — not as a second place to change a
   * price. Change one of these without changing Stripe and the page lies.
   */
  readonly fallbackPriceMonthly: number;
  readonly fallbackPriceYearly: number;
  /**
   * Applications the plan includes. On `free` this is counted over the
   * lifetime of the account; on paid plans, over the Stripe billing period.
   */
  readonly applications: number;
  readonly applicationWindow: "lifetime" | "period";
  /**
   * Agent turns allowed in the same window. This is the real cost ceiling:
   * every turn resends the whole conversation, so an unmetered chat is the one
   * thing in this product that can cost ten times its estimate.
   */
  readonly agentTurns: number;
  /** Target languages one application may be tailored into. */
  readonly languages: number;
  /** Layout ids this plan may compile, or "all". */
  readonly templates: readonly string[] | "all";
  /** Colour theme ids this plan may compile, or "all". */
  readonly themes: readonly string[] | "all";
  /**
   * Whether every layout is unlocked. Redundant with `templates` on purpose:
   * `Capability` has to index a plain boolean so that one `can()` answers every
   * gate, and a union of "a list or the word all" does not.
   */
  readonly allTemplates: boolean;
  /**
   * Whether the plan allows importing a CV at all. Every plan does now — what
   * separates them is `cvImports`, so this stays only because `Capability`
   * has to index a boolean and the upgrade dialog keys its copy off it.
   */
  readonly cvImport: boolean;
  /**
   * Successful CV imports allowed per window. A failed parse costs the user
   * nothing: the gate counts what actually filled a profile, because charging
   * somebody an allowance for a PDF the model could not read is indefensible.
   */
  readonly cvImports: number;
  /** Follow-up chat inside an application workspace. */
  readonly applicationChat: boolean;
  /** Seeing the ATS number and the keyword gaps behind it. */
  readonly atsScore: boolean;
  readonly customThemeColor: boolean;
};

/**
 * Plan limits by version.
 *
 * Versioned because Stripe prices are immutable and fairness is not optional:
 * when Pro drops from 30 applications to 20, everyone already subscribed keeps
 * the 30 they bought. `Billing.planVersion` is stamped at checkout and never
 * moves on its own, so old subscribers keep resolving to their old row.
 *
 * To change an allowance: add a new version entry, bump CURRENT_PLAN_VERSION,
 * leave the old entry exactly as it is. Never edit a published version.
 */
const PLAN_HISTORY: Record<PlanId, Record<number, PlanLimits>> = {
  free: {
    1: {
      label: "Free",
      tagline: "Tailor one CV and see how it works.",
      fallbackPriceMonthly: 0,
      fallbackPriceYearly: 0,
      applications: 1,
      applicationWindow: "lifetime",
      // Enough to get through one create-an-application conversation with room
      // for the agent's own questions, and no more.
      agentTurns: 15,
      languages: 1,
      templates: ["modern", "classic"],
      themes: ["mono"],
      allTemplates: false,
      cvImport: true,
      // One, so somebody can see the best thing the product does before paying:
      // a whole profile filled from a file they already have.
      cvImports: 1,
      applicationChat: false,
      atsScore: false,
      customThemeColor: false,
    },
  },
  pro: {
    1: {
      label: "Pro",
      tagline: "For an active job search.",
      fallbackPriceMonthly: 12,
      fallbackPriceYearly: 120,
      applications: 30,
      applicationWindow: "period",
      agentTurns: 800,
      languages: 3,
      templates: "all",
      themes: "all",
      allTemplates: true,
      cvImport: true,
      cvImports: 50,
      applicationChat: true,
      atsScore: true,
      customThemeColor: true,
    },
  },
  max: {
    1: {
      label: "Max",
      tagline: "For recruiters, coaches and career switchers.",
      fallbackPriceMonthly: 29,
      fallbackPriceYearly: 290,
      applications: 100,
      applicationWindow: "period",
      agentTurns: 2500,
      languages: 6,
      templates: "all",
      themes: "all",
      allTemplates: true,
      cvImport: true,
      cvImports: 200,
      applicationChat: true,
      atsScore: true,
      customThemeColor: true,
    },
  },
};

/** The version new checkouts are stamped with. */
export const CURRENT_PLAN_VERSION = 1;

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

/**
 * The limits for a plan at the version the subscriber bought. An unknown
 * version — a row written by a newer deploy that was rolled back, say — falls
 * back to the current one rather than throwing: a billing lookup must never be
 * the reason the app 500s.
 */
export function entitlements(plan: PlanId, version = CURRENT_PLAN_VERSION): PlanLimits {
  const history = PLAN_HISTORY[plan];
  return history[version] ?? history[CURRENT_PLAN_VERSION] ?? PLAN_HISTORY.free[1];
}

/** Every plan at its current version, cheapest first — what the pricing page lists. */
export const PLAN_LIST: readonly { id: PlanId; limits: PlanLimits }[] = PLAN_IDS.map((id) => ({
  id,
  limits: entitlements(id),
}));

export function can(plan: PlanId, capability: Capability, version?: number): boolean {
  return entitlements(plan, version)[capability];
}

/** Whether a layout id is compilable on this plan. */
export function templateAllowed(plan: PlanId, template: string, version?: number): boolean {
  const allowed = entitlements(plan, version).templates;
  return allowed === "all" || allowed.includes(template);
}

/**
 * Whether a theme id is allowed. A `#rrggbb` is a custom colour rather than a
 * preset, so it is gated by `customThemeColor` instead of the preset list.
 */
export function themeAllowed(plan: PlanId, theme: string, version?: number): boolean {
  const limits = entitlements(plan, version);
  if (theme.startsWith("#")) return limits.customThemeColor;
  return limits.themes === "all" || limits.themes.includes(theme);
}

/** Copy for the upgrade dialog, per gate. Kept beside the limits it describes. */
export const CAPABILITY_COPY: Record<Capability, { title: string; body: string }> = {
  cvImport: {
    title: "Import another CV with Pro",
    body: "You have used the upload included with Free. Pro lets you rebuild your profile from a file whenever your CV changes, instead of editing it by hand.",
  },
  applicationChat: {
    title: "Refine this CV in chat",
    body: "Ask for a stronger summary, a different emphasis, or a rewritten bullet — and watch the document change beside you.",
  },
  atsScore: {
    title: "See how to raise your score",
    body: "Every plan shows the score. Pro shows which keywords this job screens for that your CV is missing, which of them your profile can back up, and the one change that moves each number.",
  },
  allTemplates: {
    title: "Every layout, unlocked",
    body: "Six ATS-safe layouts and every colour theme, so your CV does not look like the other forty on the desk.",
  },
  customThemeColor: {
    title: "Pick your own colour",
    body: "Match your CV to your portfolio, your deck, or whatever you already use.",
  },
};

/** The sell, shown in the upgrade dialog under whichever gate was hit. */
export function proHighlights(): string[] {
  const pro = entitlements("pro");
  return [
    `${pro.applications} tailored applications a month`,
    "Unlimited follow-up chat on every CV",
    "Keyword gaps and the one change that closes each",
    "Rebuild your profile from a CV file any time",
    "All six layouts, every theme, your own colour",
  ];
}
