"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SparklesIcon } from "lucide-react";

import { Progress } from "@/components/ui/progress";

/**
 * Sits above every page while the master profile is thin. It is not
 * dismissible: the tailored CVs stay weak until this is fixed, so a banner the
 * user can close would just hide the cause of bad output.
 *
 * The whole bar is the link to the builder. On the builder itself there is
 * nowhere to go, so it renders as a plain progress meter.
 */
export function ProfileNudge({
  percent,
  missing,
}: {
  readonly percent: number;
  readonly missing: string[];
}) {
  const onBuilder = usePathname() === "/profile";
  const gaps = missing.slice(0, 3);

  const body = (
    <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:gap-5 sm:px-6">
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm">
          <span className="font-medium">Your profile is {percent}% complete.</span>{" "}
          <span className="text-muted-foreground">
            {gaps.length > 0 ? `Still missing ${listed(gaps)}.` : "Fill in the rest for sharper CVs."}
          </span>
        </p>
        {/* The default `bg-muted` track all but disappears on this tinted
            background, so the unfilled part gets its own tone. */}
        <Progress
          className="h-1.5 bg-warning/25"
          indicatorClassName="bg-warning"
          max={100}
          value={percent}
        />
      </div>
    </div>
  );

  if (onBuilder) return <div className="border-b bg-warning/8">{body}</div>;

  return (
    <Link
      className="block border-b bg-warning/8 transition-colors hover:bg-warning/15 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
      href="/profile"
    >
      {body}
    </Link>
  );
}

/** "a, b and c" — the Oxford-comma-free form reads better inside a sentence. */
function listed(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
