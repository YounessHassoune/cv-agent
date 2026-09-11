"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";

/**
 * Wraps `next-themes`, which writes the stored theme to <html> from its own
 * injected script before first paint — so no reload flashes light before
 * hydration, and the app never has to inline a script of its own.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
