import Link from "next/link";

import { getCurrentUser } from "@/app/lib/current-user";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

/**
 * The public header.
 *
 * It knows whether you are signed in, because the alternative — showing "Sign
 * up" to somebody with a live session — makes a returning user think they have
 * been logged out and sends them round the sign-in loop for nothing.
 */
export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4 md:px-8">
        <Link className="flex items-center gap-2.5" href="/">
          {/* Painted through its own alpha channel, exactly as in the sidebar:
              one asset that is ink on white and white on ink. */}
          <span
            aria-hidden="true"
            className="size-7 shrink-0"
            style={{
              backgroundColor: "currentColor",
              maskImage: "url(/logo-mark.png)",
              maskPosition: "center",
              maskRepeat: "no-repeat",
              maskSize: "contain",
              WebkitMaskImage: "url(/logo-mark.png)",
              WebkitMaskPosition: "center",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskSize: "contain",
            }}
          />
          <span className="font-semibold text-[0.95rem] tracking-tight">Wellsuited</span>
        </Link>

        <nav className="ml-6 hidden items-center gap-5 md:flex">
          <Link
            className="text-muted-foreground text-sm transition-colors hover:text-foreground"
            href="/#how"
          >
            How it works
          </Link>
          <Link
            className="text-muted-foreground text-sm transition-colors hover:text-foreground"
            href="/pricing"
          >
            Pricing
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <Link className={cn(buttonVariants({ size: "sm" }))} href="/dashboard">
              Open app
            </Link>
          ) : (
            <>
              <Link
                className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}
                href="/signin"
              >
                Sign in
              </Link>
              <Link className={cn(buttonVariants({ size: "sm" }))} href="/signup">
                Start free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
