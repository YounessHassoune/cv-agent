"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { MenuIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { brandIcon as BrandIcon, isActive, primaryNav, secondaryNav } from "./nav-config";

const COLLAPSE_STORAGE_KEY = "applyflow-sidebar-collapsed";

const SidebarContext = createContext<{
  collapsed: boolean;
  toggle: () => void;
}>({ collapsed: false, toggle: () => {} });

/** Shares the desktop collapse state between the rail and the topbar button. */
export function SidebarProvider({ children }: { readonly children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  // Read after mount: the server can't know the stored preference.
  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
  }, []);

  const toggle = () =>
    setCollapsed((current) => {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, current ? "0" : "1");
      return !current;
    });

  return <SidebarContext value={{ collapsed, toggle }}>{children}</SidebarContext>;
}

/** Desktop-only: below md the nav is a sheet, which has its own trigger. */
export function SidebarToggle() {
  const { collapsed, toggle } = useContext(SidebarContext);
  const Icon = collapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon;

  return (
    <Button
      aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
      className="hidden text-muted-foreground md:inline-flex"
      onClick={toggle}
      size="icon-sm"
      title={collapsed ? "Show sidebar" : "Hide sidebar"}
      type="button"
      variant="ghost"
    >
      <Icon className="size-4" />
    </Button>
  );
}

const navLink = (active: boolean) =>
  cn(
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors active:scale-[0.99]",
    active
      ? "bg-sidebar-accent font-semibold text-primary"
      : "font-medium text-muted-foreground hover:bg-secondary hover:text-foreground",
  );

function NavLinks({ onNavigate }: { readonly onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="min-h-0 flex-1 space-y-1">
      {[...primaryNav, ...secondaryNav].map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={navLink(active)}
            href={item.href}
            key={item.href}
            onClick={onNavigate}
          >
            <item.icon
              className={cn("size-4.5 shrink-0", active ? "text-primary" : "text-muted-foreground")}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({
  initials,
  name,
  onNavigate,
}: SidebarProps & { readonly onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 px-4 py-6">
      <Link className="flex items-center gap-3 px-1" href="/" onClick={onNavigate}>
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
          <BrandIcon className="size-4.5" />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="font-semibold text-[0.95rem] tracking-tight">ApplyFlow</span>
          <span className="text-[0.7rem] text-muted-foreground">SaaS suite</span>
        </span>
      </Link>

      <Button asChild className="w-full justify-center" size="lg">
        <Link href="/" onClick={onNavigate}>
          <PlusIcon className="size-4" />
          New optimization
        </Link>
      </Button>

      <NavLinks onNavigate={onNavigate} />

      {/* Identity block — Settings itself now lives in the nav above. */}
      {initials ? (
        <div className="mt-auto flex items-center gap-3 border-t px-1 pt-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-muted-foreground text-xs">
            {initials}
          </span>
          <span className="min-w-0 truncate font-semibold text-sm">{name}</span>
        </div>
      ) : null}
    </div>
  );
}

type SidebarProps = { readonly initials?: string; readonly name?: string };

export function Sidebar({ initials, name }: SidebarProps) {
  const { collapsed } = useContext(SidebarContext);

  return (
    <aside
      className={cn(
        "hidden shrink-0 overflow-hidden border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:block",
        collapsed ? "md:w-0 md:border-r-0" : "md:w-70",
      )}
      inert={collapsed}
    >
      {/* Fixed inner width so the contents slide out rather than reflow. */}
      <div className="h-full w-70">
        <SidebarBody initials={initials} name={name} />
      </div>
    </aside>
  );
}

export function MobileNav({ initials, name }: SidebarProps) {
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
        <SidebarBody initials={initials} name={name} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
