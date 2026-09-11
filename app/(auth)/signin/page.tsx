import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/current-user";
import { Input } from "@/components/ui/input";
import { AuthError } from "../_components/auth-error";
import { AuthForm, Field, PasswordInput } from "../_components/auth-fields";
import { GoogleButton } from "../_components/google-button";

export const metadata: Metadata = { title: "Sign in · Wellsuited" };
export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ error?: string; email?: string }>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { error, email } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-semibold text-2xl tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-sm">
          Sign in to keep tailoring CVs from your master profile.
        </p>
      </div>

      <AuthError code={error} />

      <div className="space-y-4">
        <GoogleButton label="Continue with Google" />

        <AuthForm action="/api/auth/signin" submitLabel="Sign in">
          <Field label="Email">
            <Input
              autoComplete="email"
              className="h-10"
              defaultValue={email}
              name="email"
              placeholder="you@example.com"
              required
              type="email"
            />
          </Field>

          <Field label="Password">
            <PasswordInput autoComplete="current-password" name="password" />
          </Field>
        </AuthForm>
      </div>

      <p className="text-center text-muted-foreground text-sm">
        New here?{" "}
        <Link
          className="font-medium text-foreground underline-offset-4 hover:underline"
          href="/signup"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
