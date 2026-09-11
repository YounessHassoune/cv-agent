import Link from "next/link";
import type { ReactNode } from "react";

import { SiteHeader } from "./_components/site-header";

/**
 * The public shell: everything anyone can see without an account.
 *
 * Deliberately no `requireUser()`. The app itself lives under `/dashboard` and
 * guards its own layout, which leaves this side free to be read by a stranger,
 * a search engine, or somebody comparing prices before signing up.
 */
export default function MarketingLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-8 md:px-8">
          <p className="text-muted-foreground text-sm">© {new Date().getFullYear()} Wellsuited</p>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 md:ml-auto">
            <Link
              className="text-muted-foreground text-sm transition-colors hover:text-foreground"
              href="/pricing"
            >
              Pricing
            </Link>
            <Link
              className="text-muted-foreground text-sm transition-colors hover:text-foreground"
              href="/#how"
            >
              How it works
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
