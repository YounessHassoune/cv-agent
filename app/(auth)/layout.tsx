import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2Icon, FileTextIcon, SparklesIcon, TargetIcon } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";

const highlights = [
  {
    icon: TargetIcon,
    title: "Tailored to the job, not generic",
    body: "Paste a job description and get a CV rewritten around the keywords that posting actually screens for.",
  },
  {
    icon: CheckCircle2Icon,
    title: "Never invents experience",
    body: "Your master profile is the only source of facts. If it isn't written there, it can't appear on the CV.",
  },
  {
    icon: SparklesIcon,
    title: "Scored before you send it",
    body: "Every draft comes back with an ATS score, matched keywords and the gaps still worth closing.",
  },
];

export default function AuthLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel — hidden on small screens where the form is the whole page. */}
      <aside className="brand-glow relative hidden overflow-hidden border-r bg-card lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="grid-texture pointer-events-none absolute inset-0 opacity-40" />

        <Link className="relative flex items-center gap-2.5" href="/">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <FileTextIcon className="size-4.5" />
          </span>
          <span className="font-medium text-[0.95rem] tracking-tight">ApplyFlow</span>
        </Link>

        <div className="relative max-w-md space-y-10">
          <div className="space-y-4">
            <h2 className="font-medium text-4xl leading-[1.1] tracking-tighter">
              Every application deserves its own CV.
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Keep one master profile. Let the agent tailor, score and compile a new PDF for each
              role you go after.
            </p>
          </div>

          <ul className="space-y-6">
            {highlights.map((item) => (
              <li className="flex gap-4" key={item.title}>
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background/60 text-primary">
                  <item.icon className="size-4" />
                </span>
                <div className="space-y-1">
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-muted-foreground text-xs">
          Your profile data stays in your own database.
        </p>
      </aside>

      <main className="relative flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <Link className="flex items-center gap-2.5 lg:invisible" href="/">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileTextIcon className="size-4" />
            </span>
            <span className="font-medium text-sm tracking-tight">ApplyFlow</span>
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-6">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}
