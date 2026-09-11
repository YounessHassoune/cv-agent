import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * One row of the settings form: what the group is on the left, what you can
 * change on the right. Groups are separated by a hairline rather than boxed
 * into cards, so nothing claims more hierarchy than it has.
 */
export function SettingsSection({
  title,
  description,
  children,
  className,
}: {
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <section
      className={cn(
        "grid gap-4 border-t py-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10",
        className,
      )}
    >
      <div className="space-y-1">
        <h2 className="font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </div>
      <div className="min-w-0 space-y-5">{children}</div>
    </section>
  );
}
