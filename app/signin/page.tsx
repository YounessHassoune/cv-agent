import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default async function SignInPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form
        action="/api/auth/signin"
        className="w-full max-w-sm space-y-4 rounded-xl border p-6"
        method="post"
      >
        <div>
          <h1 className="font-medium text-xl tracking-tight">Sign in</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Your email identifies which master profile the agent tailors from.
          </p>
        </div>
        <Input autoComplete="email" name="email" placeholder="you@example.com" type="email" />
        {error ? <p className="text-destructive text-sm">Enter a valid email address.</p> : null}
        <Button className="w-full" type="submit">
          Continue
        </Button>
      </form>
    </main>
  );
}
