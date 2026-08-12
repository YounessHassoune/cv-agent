import Link from "next/link";
import { getCurrentUser } from "@/app/lib/current-user";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/", label: "Tailor" },
  { href: "/profile", label: "Profile" },
  { href: "/applications", label: "Applications" },
];

export async function Nav() {
  const user = await getCurrentUser();

  return (
    <header className="flex h-14 shrink-0 items-center gap-6 border-b px-4 sm:px-6">
      <span className="font-medium text-sm tracking-tight">CV Tailor</span>
      <nav className="flex items-center gap-4">
        {links.map((link) => (
          <Link
            className="text-muted-foreground text-sm transition-colors hover:text-foreground"
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        {user ? (
          <>
            <span className="hidden text-muted-foreground text-xs sm:inline">{user.email}</span>
            <form action="/api/auth/signout" method="post">
              <Button size="sm" type="submit" variant="ghost">
                Sign out
              </Button>
            </form>
          </>
        ) : (
          <Button asChild size="sm" variant="ghost">
            <Link href="/signin">Sign in</Link>
          </Button>
        )}
      </div>
    </header>
  );
}
