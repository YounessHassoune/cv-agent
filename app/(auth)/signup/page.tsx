import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/current-user";
import { Input } from "@/components/ui/input";
import { AuthError } from "../_components/auth-error";
import { AuthForm, Field, PasswordInput } from "../_components/auth-fields";
import { GoogleButton } from "../_components/google-button";

export const metadata: Metadata = { title: "Create account · Wellsuited" };
export const dynamic = "force-dynamic";

export default async function SignUpPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ error?: string; email?: string; name?: string }>;
}) {
  if (await getCurrentUser()) redirect("/dashboard");
  const { error, email, name } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="font-semibold text-2xl tracking-tight">Create your account</h1>
        <p className="text-muted-foreground text-sm">
          Build your master profile once, then tailor it to every role.
        </p>
      </div>

      <AuthError code={error} />

      <div className="space-y-4">
        <GoogleButton label="Sign up with Google" />

        <AuthForm action="/api/auth/signup" submitLabel="Create account">
          <Field label="Full name">
            <Input
              autoComplete="name"
              className="h-10"
              defaultValue={name}
              name="name"
              placeholder="Ada Lovelace"
              required
            />
          </Field>

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

          <Field hint="8+ characters, a letter and a number" label="Password">
            <PasswordInput autoComplete="new-password" name="password" />
          </Field>
        </AuthForm>
      </div>

      <p className="text-center text-muted-foreground text-sm">
        Already have an account?{" "}
        <Link className="font-medium text-foreground underline-offset-4 hover:underline" href="/signin">
          Sign in
        </Link>
      </p>
    </div>
  );
}
