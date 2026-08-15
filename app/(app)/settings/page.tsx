import type { Metadata } from "next";
import { KeyRoundIcon, MailIcon } from "lucide-react";

import { db } from "@/agent/lib/db.ts";
import { initialsOf, requireUser } from "@/app/lib/current-user";
import { ThemePicker } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PasswordSection } from "./password-section";

export const metadata: Metadata = { title: "Settings · CV Tailor" };
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
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <h1 className="font-medium text-2xl tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Your account, sign-in methods and theme.</p>
      </div>

      <section className="surface-card space-y-5 rounded-xl p-5">
        <h2 className="font-medium text-sm">Account</h2>

        <div className="flex items-center gap-4">
          <Avatar className="size-12 border">
            {user.image ? <AvatarImage alt="" src={user.image} /> : null}
            <AvatarFallback className="text-sm">{initialsOf(user)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">{user.name ?? "Your account"}</p>
            <p className="truncate text-muted-foreground text-sm">{user.email}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            <MailIcon className="size-3" />
            {account?.passwordHash ? "Password enabled" : "No password set"}
          </Badge>
          {account?.googleId ? (
            <Badge variant="secondary">
              <KeyRoundIcon className="size-3" />
              Google linked
            </Badge>
          ) : null}
          {account?.createdAt ? (
            <Badge variant="outline">Member since {account.createdAt.toLocaleDateString()}</Badge>
          ) : null}
        </div>

        <dl className="grid gap-3 border-t pt-4 sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground text-xs">Applications</dt>
            <dd className="font-medium text-lg tabular-nums">{applicationCount}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Roles on file</dt>
            <dd className="font-medium text-lg tabular-nums">
              {profile?._count.experiences ?? 0}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Skills on file</dt>
            <dd className="font-medium text-lg tabular-nums">{profile?._count.skills ?? 0}</dd>
          </div>
        </dl>
      </section>

      <section className="surface-card space-y-4 rounded-xl p-5">
        <div className="space-y-1">
          <h2 className="font-medium text-sm">Appearance</h2>
          <p className="text-muted-foreground text-sm">
            Dark mode follows your system by default.
          </p>
        </div>
        <ThemePicker />
      </section>

      <PasswordSection hasPassword={Boolean(account?.passwordHash)} />

      <section className="space-y-4 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="space-y-1">
          <h2 className="font-medium text-sm">Sign out</h2>
          <p className="text-muted-foreground text-sm">
            End this session on this device. Your profile and applications stay put.
          </p>
        </div>
        <form action="/api/auth/signout" method="post">
          <Button size="sm" type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </section>
    </div>
  );
}
