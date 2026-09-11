"use client";

import { GemIcon, MenuIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

import { usePlan } from "@/components/plan-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { isActive, primaryNav, secondaryNav } from "./nav-config";

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
          // biome-ignore lint/correctness/useJsxKeyInIterable: the key lives on the wrapper returned below, not on this extracted element.
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

/**
 * How much of the plan is left.
 *
 * Shown while it can still change the user's mind and hidden once it cannot:
 * a paid plan with three of thirty applications used is a bar nobody needs to
 * look at, so it only appears past half. On the free plan it is always there,
 * because one application is a number you should know before you spend it.
 */
function UsageMeter({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { plan, limits, usage, credits } = usePlan();
  const used = Math.min(usage.applications, limits.applications);
  const percent = limits.applications === 0 ? 100 : (used / limits.applications) * 100;
  const free = plan === "free";

  if (collapsed) return null;
  if (!free && percent < 50) return null;

  const spent = usage.applications >= limits.applications;

  return (
    <div className="space-y-2 rounded-lg border bg-card/60 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-xs">
          {used} of {limits.applications}{" "}
          {limits.applications === 1 ? "application" : "applications"}
        </span>
        {credits > 0 ? (
          <span className="text-muted-foreground text-[11px]">+{credits} credits</span>
        ) : null}
      </div>

      <Progress indicatorClassName={cn(spent && "bg-warning")} value={Math.min(100, percent)} />

      {free ? (
        <Link
          className={cn(buttonVariants({ size: "sm" }), "w-full")}
          href="/dashboard/pricing"
          onClick={onNavigate}
        >
          <GemIcon className="size-3.5" />
          Upgrade
        </Link>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {limits.applicationWindow === "period" ? "Resets when your plan renews." : null}
        </p>
      )}
    </div>
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
      href="/dashboard"
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
        href="/dashboard"
        onClick={onNavigate}
      >
        {/* Painted through its own alpha channel rather than shown as an
            image: the one asset is then ink on white and white on ink, instead
            of a near-black PNG sitting on a dark panel. */}
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
        {collapsed ? (
          <span className="sr-only">Wellsuited</span>
        ) : (
          <span className="font-semibold text-[0.95rem] tracking-tight">Wellsuited</span>
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

      <UsageMeter collapsed={collapsed} onNavigate={onNavigate} />

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
