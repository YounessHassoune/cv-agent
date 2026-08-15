"use client";

import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { isActive, primaryNav, secondaryNav } from "./nav-config";
import { MobileNav } from "./sidebar";
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
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md sm:px-6">
      <MobileNav />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm">{section.label}</p>
        <p className="hidden truncate text-muted-foreground text-xs sm:block">
          {section.description}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        <ThemeToggle />
        <UserMenu email={email} image={image} initials={initials} name={name} />
      </div>
    </header>
  );
}
