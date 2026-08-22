import type { Metadata } from "next";
import { KeyRoundIcon, MailIcon } from "lucide-react";

import { db } from "@/agent/lib/db.ts";
import { initialsOf, requireUser } from "@/app/lib/current-user";
import { ThemePicker } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PasswordSection } from "./password-section";

export const metadata: Metadata = { title: "Settings · ApplyFlow" };
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

  return (
    <div className="mx-auto w-full max-w-200 space-y-8 px-4 py-8 md:px-10 md:py-12">
      <div className="space-y-2">
        <h1 className="font-bold text-3xl tracking-tight sm:text-4xl">Settings</h1>
        <p className="text-muted-foreground">Your account, sign-in methods and theme.</p>
      </div>

      <section className="surface-card space-y-6 rounded-xl p-6 md:p-8">
        <h2 className="border-b pb-4 font-semibold text-lg tracking-tight">Account</h2>

        <div className="flex items-center gap-4">
          <Avatar className="size-12 border">
            {user.image ? <AvatarImage alt="" src={user.image} /> : null}
            <AvatarFallback className="font-semibold">{initialsOf(user)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold text-lg tracking-tight">
              {user.name ?? "Your account"}
            </p>
            <p className="truncate text-muted-foreground text-sm">{user.email}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Badge className="border bg-field px-3 py-1.5" variant="outline">
            <MailIcon className="size-3.5 text-muted-foreground" />
            {account?.passwordHash ? "Password enabled" : "No password set"}
          </Badge>
          {account?.googleId ? (
            <Badge className="border bg-field px-3 py-1.5" variant="outline">
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

        <dl className="grid grid-cols-3 gap-4 border-t pt-6">
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs">Applications</dt>
            <dd className="font-semibold text-2xl tabular-nums tracking-tight">
              {applicationCount}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs">Roles on file</dt>
            <dd className="font-semibold text-2xl tabular-nums tracking-tight">
              {profile?._count.experiences ?? 0}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground text-xs">Skills on file</dt>
            <dd className="font-semibold text-2xl tabular-nums tracking-tight">
              {profile?._count.skills ?? 0}
            </dd>
          </div>
        </dl>
      </section>

      <section className="surface-card space-y-4 rounded-xl p-6 md:p-8">
        <div className="space-y-1">
          <h2 className="font-semibold text-lg tracking-tight">Appearance</h2>
          <p className="text-muted-foreground text-sm">
            Dark mode follows your system by default.
          </p>
        </div>
        <ThemePicker />
      </section>

      <PasswordSection hasPassword={Boolean(account?.passwordHash)} />

      <section className="space-y-4 rounded-xl border border-destructive/25 bg-destructive/5 p-6 md:p-8">
        <div className="space-y-1">
          <h2 className="font-semibold text-destructive text-lg tracking-tight">Sign out</h2>
          <p className="text-muted-foreground text-sm">
            End this session on this device. Your profile and applications stay put.
          </p>
        </div>
        <form action="/api/auth/signout" method="post">
          <Button
            className="border-destructive/30 bg-card text-destructive hover:bg-destructive/10 hover:text-destructive"
            type="submit"
            variant="outline"
          >
            Sign out
          </Button>
        </form>
      </section>
    </div>
  );
}
