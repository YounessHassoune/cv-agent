"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MenuIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { brandIcon as BrandIcon, isActive, primaryNav, secondaryNav } from "./nav-config";

function NavLinks({ onNavigate }: { readonly onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between gap-6">
      <nav className="space-y-1">
        {primaryNav.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
              href={item.href}
              key={item.href}
              onClick={onNavigate}
            >
              <item.icon
                className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <nav className="space-y-1 border-t pt-4">
        {secondaryNav.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
              href={item.href}
              key={item.href}
              onClick={onNavigate}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function SidebarBody({ onNavigate }: { readonly onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link className="flex items-center gap-2.5 px-1" href="/" onClick={onNavigate}>
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <BrandIcon className="size-4" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="font-medium text-sm tracking-tight">CV Tailor</span>
          <span className="text-[0.7rem] text-muted-foreground">Optimization suite</span>
        </span>
      </Link>

      <Button asChild className="w-full justify-center" size="sm">
        <Link href="/" onClick={onNavigate}>
          <PlusIcon className="size-4" />
          New optimization
        </Link>
      </Button>

      <NavLinks onNavigate={onNavigate} />
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground md:block">
      <SidebarBody />
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button aria-label="Open navigation" className="md:hidden" size="icon-sm" variant="ghost">
          <MenuIcon className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="p-0" side="left">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarBody onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
