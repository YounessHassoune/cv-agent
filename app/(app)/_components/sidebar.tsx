"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { MenuIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, PlusIcon } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  const label = collapsed ? "Expand sidebar" : "Collapse sidebar";

  return (
    <Button
      aria-label={label}
      className="hidden text-muted-foreground md:inline-flex"
      onClick={toggle}
      size="icon-sm"
      title={label}
      type="button"
      variant="ghost"
    >
      <Icon className="size-4" />
    </Button>
  );
}

/**
 * Collapsed, the sidebar becomes an icon rail rather than disappearing: the
 * point of collapsing is to give the workspace its width back, not to give up
 * navigation and have to expand again for every move.
 */
function NavLinks({
  collapsed,
  onNavigate,
}: {
  readonly collapsed: boolean;
  readonly onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="min-h-0 flex-1 space-y-0.5">
      {[...primaryNav, ...secondaryNav].map((item) => {
        const active = isActive(pathname, item.href);
        const link = (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center rounded-lg font-medium text-sm transition-colors active:translate-y-px",
              collapsed ? "size-10 justify-center" : "gap-3 px-3 py-2",
              active
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
            href={item.href}
            onClick={onNavigate}
          >
            <item.icon className="size-4.5 shrink-0" />
            {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
          </Link>
        );

        // Collapsed, the label is gone from the screen, so it has to be reachable
        // some other way or the rail is a row of guesses.
        return collapsed ? (
          <Tooltip key={item.href}>
            <TooltipTrigger render={link} />
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        ) : (
          <div key={item.href}>{link}</div>
        );
      })}
    </nav>
  );
}

function SidebarBody({
  collapsed = false,
  initials,
  name,
  onNavigate,
}: SidebarProps & { readonly collapsed?: boolean; readonly onNavigate?: () => void }) {
  const newOptimization = (
    <Link
      className={cn(
        buttonVariants({ size: collapsed ? "icon" : "default" }),
        "w-full",
        collapsed ? "px-0" : "justify-center",
      )}
      href="/"
      onClick={onNavigate}
    >
      <PlusIcon className="size-4" />
      {collapsed ? <span className="sr-only">New optimization</span> : "New optimization"}
    </Link>
  );

  return (
    <div className={cn("flex h-full flex-col gap-5 py-5", collapsed ? "px-3" : "px-4")}>
      <Link
        className={cn("flex items-center", collapsed ? "justify-center" : "gap-2.5 px-1")}
        href="/"
        onClick={onNavigate}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <BrandIcon className="size-4" />
        </span>
        {collapsed ? (
          <span className="sr-only">ApplyFlow</span>
        ) : (
          <span className="font-semibold text-[0.95rem] tracking-tight">ApplyFlow</span>
        )}
      </Link>

      {collapsed ? (
        <Tooltip>
          <TooltipTrigger render={newOptimization} />
          <TooltipContent side="right">New optimization</TooltipContent>
        </Tooltip>
      ) : (
        newOptimization
      )}

      <NavLinks collapsed={collapsed} onNavigate={onNavigate} />

      {/* Identity block. Settings itself lives in the nav above. */}
      {initials ? (
        <div
          className={cn(
            "mt-auto flex items-center border-t pt-4",
            collapsed ? "justify-center" : "gap-2.5 px-1",
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-muted-foreground text-xs">
            {initials}
          </span>
          {collapsed ? null : <span className="min-w-0 truncate font-medium text-sm">{name}</span>}
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
        "hidden shrink-0 border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out md:block",
        collapsed ? "md:w-16" : "md:w-64",
      )}
    >
      <SidebarBody collapsed={collapsed} initials={initials} name={name} />
    </aside>
  );
}

export function MobileNav({ initials, name }: SidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger
        render={
          <Button aria-label="Open navigation" className="md:hidden" size="icon-sm" variant="ghost">
            <MenuIcon className="size-4" />
          </Button>
        }
      />
      <SheetContent className="p-0" side="left">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarBody initials={initials} name={name} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
