import type { Metadata } from "next";
import { KeyRoundIcon, MailIcon } from "lucide-react";

import { db } from "@/agent/lib/db.ts";
import { initialsOf, requireUser } from "@/app/lib/current-user";
import { ThemePicker } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BillingSection } from "./billing-section";
import { PasswordSection } from "./password-section";
import { SettingsSection } from "./settings-section";

export const metadata: Metadata = { title: "Settings · Wellsuited" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();

  const account = await db.user.findUnique({
    where: { id: user.userId },
    select: { googleId: true, passwordHash: true, createdAt: true },
  });

  const [profile, applicationCount] = await Promise.all([
    db.profile.findUnique({
      where: { userId: user.userId },
      select: { updatedAt: true, _count: { select: { experiences: true, skills: true } } },
    }),
    db.application.count({ where: { userId: user.userId } }),
  ]);

  const counts = [
    { label: "Applications", value: applicationCount },
    { label: "Roles on file", value: profile?._count.experiences ?? 0 },
    { label: "Skills on file", value: profile?._count.skills ?? 0 },
  ];

  return (
    /*
     * Settings used to be four stacked cards, which gave every group the same
     * visual weight and left the reader scanning boxes for the one control they
     * came for. This is the two-column form the pattern is usually written as:
     * what the group is on the left, what you can change on the right, separated
     * by hairlines rather than boxed in.
     */
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8 md:py-10">
      <div className="space-y-1 pb-8">
        <h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Your account, sign-in methods and theme.</p>
      </div>

      <SettingsSection
        description="How you sign in, and what is on file for the agent to draw on."
        title="Account"
      >
        <div className="flex items-center gap-4">
          <Avatar className="size-12 border">
            {user.image ? <AvatarImage alt="" src={user.image} /> : null}
            <AvatarFallback className="text-sm">{initialsOf(user)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold tracking-tight">{user.name ?? "Your account"}</p>
            <p className="truncate text-muted-foreground text-sm">{user.email}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge className="gap-1.5 border bg-field px-3 py-1.5" variant="outline">
            <MailIcon className="size-3.5 text-muted-foreground" />
            {account?.passwordHash ? "Password enabled" : "No password set"}
          </Badge>
          {account?.googleId ? (
            <Badge className="gap-1.5 border bg-field px-3 py-1.5" variant="outline">
              <KeyRoundIcon className="size-3.5 text-muted-foreground" />
              Google linked
            </Badge>
          ) : null}
          {account?.createdAt ? (
            <Badge className="border bg-field px-3 py-1.5" variant="outline">
              Member since {account.createdAt.toLocaleDateString()}
            </Badge>
          ) : null}
        </div>

        {/* The same divided strip the applications page uses for its counts, so
            a set of numbers looks the same wherever it appears. */}
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border bg-border">
          {counts.map((count) => (
            <div className="bg-card p-4" key={count.label}>
              <dt className="text-muted-foreground text-xs">{count.label}</dt>
              <dd className="mt-1 font-semibold text-xl tabular-nums tracking-tight">
                {count.value}
              </dd>
            </div>
          ))}
        </dl>
      </SettingsSection>

      <BillingSection />

      <SettingsSection
        description="Dark mode follows your system unless you pick one."
        title="Appearance"
      >
        <ThemePicker />
      </SettingsSection>

      <PasswordSection hasPassword={Boolean(account?.passwordHash)} />

      <SettingsSection
        description="End this session on this device. Your profile and applications stay put."
        title="Sign out"
      >
        <form action="/api/auth/signout" method="post">
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </SettingsSection>
    </div>
  );
}
