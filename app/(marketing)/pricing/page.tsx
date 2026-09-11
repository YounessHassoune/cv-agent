import type { Metadata } from "next";

import { planFor } from "@/agent/lib/billing.ts";
import { getCurrentUser } from "@/app/lib/current-user";
import { getPriceCatalog } from "@/app/lib/stripe";
import { PricingCards } from "@/components/pricing-cards";

export const metadata: Metadata = {
  title: "Pricing · Wellsuited",
  description:
    "Tailor your CV to a job description with an agent that only ever writes what your profile can back up. Free to start.",
};

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  // Public. A visitor sees the prices; a signed-in one also sees which card is
  // already theirs, which is the difference between a price list and a billing
  // page.
  const user = await getCurrentUser();
  const [plan, prices] = await Promise.all([
    user ? planFor(user.userId) : null,
    getPriceCatalog(),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-14 md:px-8">
      <div className="space-y-2 pb-10 text-center">
        <h1 className="font-semibold text-3xl tracking-tight">Pricing</h1>
        <p className="mx-auto max-w-lg text-muted-foreground leading-relaxed">
          Every plan writes from the same master profile and compiles the same ATS-safe PDF. What
          changes is how many jobs you can go after, and how much help you get on each one.
        </p>
      </div>

      <PricingCards currentPlan={plan} prices={prices} />

      <div className="mx-auto mt-16 max-w-2xl space-y-8">
        <h2 className="text-center font-semibold text-xl tracking-tight">Questions</h2>
        {[
          {
            q: "What counts as one application?",
            a: "One job. Pasting a job description and getting a tailored CV back — including the revisions, the ATS scoring and every language you asked for — is one application, not several.",
          },
          {
            q: "Will it invent experience I do not have?",
            a: "No. Every skill, employer and tool on a tailored CV is checked against your master profile before the PDF is compiled, and a draft that claims something unsupported is rejected and rewritten.",
          },
          {
            q: "What happens to my CVs if I cancel?",
            a: "They stay. Cancelling stops new applications at the end of the period you paid for; everything already tailored stays readable and downloadable.",
          },
          {
            q: "Can I change plans later?",
            a: "Yes, in both directions, from Settings. Stripe handles the proration, so switching mid-month costs the difference rather than a fresh month.",
          },
        ].map((item) => (
          <div className="space-y-1.5 border-t pt-6" key={item.q}>
            <h3 className="font-medium">{item.q}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{item.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
