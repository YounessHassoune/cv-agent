import {
  ArrowRightIcon,
  ClipboardPasteIcon,
  FileCheck2Icon,
  GaugeIcon,
  LanguagesIcon,
  type LucideIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserRoundIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { planFor } from "@/agent/lib/billing.ts";
import { getCurrentUser } from "@/app/lib/current-user";
import { getPriceCatalog } from "@/app/lib/stripe";
import { PricingCards } from "@/components/pricing-cards";
import { buttonVariants } from "@/components/ui/button";
import { entitlements } from "@/lib/entitlements";
import { cn } from "@/lib/utils";
import { HeroVisual } from "./_components/hero-visual";

export const metadata: Metadata = {
  title: "Wellsuited — a CV tailored to the job, without the fiction",
  description:
    "Paste a job description and get a CV rewritten for it from your own master profile. Every claim checked against what you have actually done, scored against the screen it has to pass.",
};

export const dynamic = "force-dynamic";

const steps: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: UserRoundIcon,
    title: "Fill your profile once",
    body: "Every role, skill and project you have, in one place. Upload an existing CV and it fills itself in. This is the only thing a tailored CV is ever allowed to draw on.",
  },
  {
    icon: ClipboardPasteIcon,
    title: "Paste the job description",
    body: "The agent reads the ad the way a screener does: the real title, the seniority, and which keywords carry weight versus which are noise.",
  },
  {
    icon: FileCheck2Icon,
    title: "Get a CV written for that job",
    body: "Your experience, reframed for the role, compiled to a single-column ATS-safe PDF and scored against the ad — with the gaps named, not hidden.",
  },
];

const features: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ShieldCheckIcon,
    title: "It cannot invent your experience",
    body: "Every skill, employer and tool on a draft is checked against your profile before a PDF exists. A draft that claims something you never wrote down is rejected and written again.",
  },
  {
    icon: GaugeIcon,
    title: "A score with reasons attached",
    body: "Keyword coverage, title alignment and semantic fit, each with its own number and the one sentence that says what would move it.",
  },
  {
    icon: LanguagesIcon,
    title: "One job, several languages",
    body: "Ask for English and French and you get both, tailored separately rather than translated, each scored on its own.",
  },
  {
    icon: SparklesIcon,
    title: "Ask for changes in plain words",
    body: "The CV stays on screen while you ask for a stronger summary or a rewritten bullet, so you watch the document change instead of hunting for what moved.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  const [plan, prices] = await Promise.all([user ? planFor(user.userId) : null, getPriceCatalog()]);
  const free = entitlements("free");

  const primaryHref = user ? "/dashboard" : "/signup";
  const primaryLabel = user ? "Open the app" : "Start free";

  return (
    <>
      {/* The same two layers the sign-in panel uses, so the front door and the
          door behind it are recognisably one product. The grid is masked to
          fade downward — cut off at a hard edge it reads as a rendering bug. */}
      <section className="brand-glow relative overflow-hidden [--glow-a:12%] [--glow-b:9%]">
        {/* Stronger ink and wider spacing than the auth panel's defaults: that
            grid sits in a narrow column behind body text, this one has a whole
            viewport to cross, and at 6% under a 40% opacity it was a texture you
            had to be told was there.

            Masked radially rather than straight down, so it fades out at the
            sides too — a grid that runs into the left and right edges of the
            screen reads as an unfinished background, not a deliberate one. */}
        <div className="grid-texture pointer-events-none absolute inset-0 [--grid-line:13%] [--grid-size:56px] mask-[radial-gradient(115%_85%_at_50%_0%,black_35%,transparent_78%)]" />

        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-16 pb-20 md:px-8 md:pt-24 lg:grid-cols-[1.05fr_1fr] lg:gap-8">
          {/* Left-aligned rather than centred: it sits beside a picture now, and
              a centred column next to an image reads as two things that were
              laid out separately. */}
          <div className="space-y-6 text-center lg:text-left">
            <p className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-muted-foreground text-xs">
              <SparklesIcon className="size-3.5" />
              {free.applications} free application, no card
            </p>

            <h1 className="text-balance font-semibold text-4xl tracking-tight md:text-5xl md:leading-[1.1]">
              A CV tailored to the job, without the fiction
            </h1>

            <p className="mx-auto max-w-xl text-balance text-lg text-muted-foreground leading-relaxed lg:mx-0">
              Paste a job description. Get your own experience rewritten for that role, checked line
              by line against what you have actually done, and scored against the screen it has to
              get past.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 lg:justify-start">
              <Link className={cn(buttonVariants({ size: "lg" }))} href={primaryHref}>
                {primaryLabel}
                <ArrowRightIcon className="size-4" />
              </Link>
              <Link
                className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
                href="/pricing"
              >
                See pricing
              </Link>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <HeroVisual />
          </div>
        </div>
      </section>

      <section className="border-t bg-card/40" id="how">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-8 md:py-20">
          <div className="mx-auto max-w-2xl space-y-2 pb-12 text-center">
            <h2 className="font-semibold text-2xl tracking-tight">How it works</h2>
            <p className="text-muted-foreground leading-relaxed">
              Three steps, and the first one only happens once.
            </p>
          </div>

          <ol className="grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <li className="space-y-3 rounded-xl border bg-card p-6" key={step.title}>
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-secondary">
                    <step.icon className="size-4.5" />
                  </span>
                  <span className="font-medium text-muted-foreground text-xs tabular-nums">
                    Step {index + 1}
                  </span>
                </div>
                <h3 className="font-medium">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-8 md:py-20">
          <div className="mx-auto max-w-2xl space-y-2 pb-12 text-center">
            <h2 className="font-semibold text-2xl tracking-tight">
              What makes it different from asking a chatbot
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              A general-purpose model will happily give you a CV that says whatever the job ad
              wanted to hear. That CV fails the first interview question about it.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((feature) => (
              <div className="space-y-3 rounded-xl border bg-card p-6" key={feature.title}>
                <span className="flex size-9 items-center justify-center rounded-lg bg-secondary">
                  <feature.icon className="size-4.5" />
                </span>
                <h3 className="font-medium">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The prices on the landing page itself, not one click behind it: a
          visitor who has to hunt for the cost assumes the worst. */}
      <section className="border-t bg-card/40" id="pricing">
        <div className="mx-auto w-full max-w-5xl px-4 py-16 md:px-8 md:py-20">
          <div className="mx-auto max-w-2xl space-y-2 pb-12 text-center">
            <h2 className="font-semibold text-2xl tracking-tight">Simple plans</h2>
            <p className="text-muted-foreground leading-relaxed">
              Start free, with no card. Upgrade when you are actually applying to things.
            </p>
          </div>

          <PricingCards currentPlan={plan} prices={prices} />
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-20 text-center md:px-8">
          <h2 className="text-balance font-semibold text-2xl tracking-tight">
            Your next application deserves better than a template
          </h2>
          <p className="text-balance text-muted-foreground leading-relaxed">
            Fill in your profile once, paste one job description, and see what comes back. The first
            one is free.
          </p>
          <div className="flex justify-center">
            <Link className={cn(buttonVariants({ size: "lg" }))} href={primaryHref}>
              {primaryLabel}
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
