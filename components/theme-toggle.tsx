"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Theme = "light" | "dark" | "system";

/** Passed to the provider in the root layout as `storageKey`. */
export const THEME_STORAGE_KEY = "applyflow-theme";

/**
 * Both controls render a placeholder until mounted: the stored theme is only
 * known in the browser, so anything derived from it during SSR would mismatch.
 */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

/** Compact icon button that cycles light → dark → system. */
export function ThemeToggle({ className }: { readonly className?: string }) {
  const { theme = "system", setTheme } = useTheme();
  const mounted = useMounted();

  const next: Record<string, Theme> = { light: "dark", dark: "system", system: "light" };
  const Icon = theme === "dark" ? MoonIcon : theme === "light" ? SunIcon : MonitorIcon;
  // The label and tooltip name the stored theme, so they have to stay on the
  // same placeholder as the icon until the browser value is known.
  const label = mounted ? `Theme: ${theme}. Switch to ${next[theme] ?? "light"}.` : "Toggle theme";

  return (
    <Button
      aria-label={label}
      className={cn("text-muted-foreground", className)}
      onClick={() => setTheme(next[theme] ?? "light")}
      size="icon-sm"
      title={label}
      type="button"
      variant="ghost"
    >
      {mounted ? <Icon className="size-4" /> : <span className="size-4" />}
    </Button>
  );
}

/** Segmented light/dark/system picker for the settings page. */
export function ThemePicker() {
  const { theme = "system", setTheme } = useTheme();
  const mounted = useMounted();

  const options: { value: Theme; label: string; icon: typeof SunIcon }[] = [
    { value: "light", label: "Light", icon: SunIcon },
    { value: "dark", label: "Dark", icon: MoonIcon },
    { value: "system", label: "System", icon: MonitorIcon },
  ];

  return (
    <div className="inline-flex rounded-lg border bg-field p-1">
      {options.map((option) => (
        <button
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-4 py-2 font-medium text-sm transition-colors",
            mounted && theme === option.value
              ? "border bg-card text-foreground shadow-xs"
              : "border border-transparent text-muted-foreground hover:text-foreground",
          )}
          key={option.value}
          onClick={() => setTheme(option.value)}
          type="button"
        >
          <option.icon className="size-3.5" />
          {option.label}
        </button>
      ))}
    </div>
  );
}
