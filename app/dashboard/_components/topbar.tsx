"use client";

import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { isActive, primaryNav, secondaryNav } from "./nav-config";
import { MobileNav, SidebarToggle } from "./sidebar";
import { UserMenu } from "./user-menu";

function useSection() {
  const pathname = usePathname();
  const match = [...primaryNav, ...secondaryNav].find((item) => isActive(pathname, item.href));
  return match ?? primaryNav[0];
}

export function Topbar({
  email,
  name,
  image,
  initials,
}: {
  readonly email: string;
  readonly name: string | null;
  readonly image: string | null;
  readonly initials: string;
}) {
  const section = useSection();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-md sm:px-4">
      <MobileNav initials={initials} name={name ?? email} />
      <SidebarToggle />

      {/* The section name sits on the baseline with its description beside it on
          wide screens, so the bar stays one line tall instead of stacking two. */}
      <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
        <h2 className="shrink-0 font-semibold text-sm tracking-tight">{section.label}</h2>
        <p className="hidden min-w-0 truncate text-muted-foreground text-xs lg:block">
          {section.description}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <UserMenu email={email} image={image} initials={initials} name={name} />
      </div>
    </header>
  );
}
