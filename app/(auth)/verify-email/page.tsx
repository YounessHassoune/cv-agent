import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheckIcon } from "lucide-react";

import { getCurrentUser } from "@/app/lib/current-user";
import { AuthError } from "../_components/auth-error";
import { ResendForm } from "../_components/resend-form";

export const metadata: Metadata = { title: "Confirm your email · Wellsuited" };
export const dynamic = "force-dynamic";

/** Outcomes of a resend request. None of them confirm the account exists. */
const sentMessages: Record<string, string> = {
  ok: "If that address needs confirming, a new link is on its way.",
  cooldown: "A link went out less than a minute ago. Check your inbox before asking for another.",
  failed: "We couldn't send that email. Try again in a moment.",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ email?: string; error?: string; sent?: string }>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { email, error, sent } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <span className="inline-flex size-10 items-center justify-center rounded-lg border bg-card text-primary">
          <MailCheckIcon className="size-5" />
        </span>
        <div className="space-y-1.5">
          <h1 className="font-semibold text-2xl tracking-tight">Confirm your email</h1>
          <p className="text-muted-foreground text-sm">
            {email ? (
              <>
                We sent a link to <span className="font-medium text-foreground">{email}</span>. Open
                it and you'll be signed in.
              </>
            ) : (
              "Open the link we emailed you and you'll be signed in."
            )}
          </p>
        </div>
      </div>

      <AuthError code={error} />

      {sent ? (
        <p className="rounded-lg border bg-card px-3 py-2.5 text-muted-foreground text-sm">
          {sentMessages[sent] ?? sentMessages.ok}
        </p>
      ) : null}

      <ResendForm email={email} />

      <p className="text-center text-muted-foreground text-sm">
        Wrong address?{" "}
        <Link
          className="font-medium text-foreground underline-offset-4 hover:underline"
          href="/signup"
        >
          Start over
        </Link>
      </p>
    </div>
  );
}
