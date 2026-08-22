"use client";

import { useEffect, useState } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "applyflow-theme";

/**
 * Inlined in <head> so the stored theme is applied before first paint —
 * without it every reload flashes light before hydration swaps to dark.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}")||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const stored = (localStorage.getItem(THEME_STORAGE_KEY) as Theme | null) ?? "system";
    setThemeState(stored);
  }, []);

  // Follow the OS while the user is on "system".
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
  };

  return { theme, setTheme };
}

/** Compact icon button that cycles light → dark → system. */
export function ThemeToggle({ className }: { readonly className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const next: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" };
  const Icon = theme === "dark" ? MoonIcon : theme === "light" ? SunIcon : MonitorIcon;

  return (
    <Button
      aria-label={`Theme: ${theme}. Switch to ${next[theme]}.`}
      className={cn("text-muted-foreground", className)}
      onClick={() => setTheme(next[theme])}
      size="icon-sm"
      title={`Theme: ${theme}`}
      type="button"
      variant="ghost"
    >
      {mounted ? <Icon className="size-4" /> : <span className="size-4" />}
    </Button>
  );
}

/** Segmented light/dark/system picker for the settings page. */
export function ThemePicker() {
  const { theme, setTheme } = useTheme();
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
            theme === option.value
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
