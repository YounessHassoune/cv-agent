import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { Nav } from "@/app/_components/nav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./globals.css";

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CV Tailor",
  description: "Tailor an ATS-optimized CV to any job description, from your master profile.",
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html className={cn(sans.variable, mono.variable)} lang="en">
      <body>
        <TooltipProvider>
          <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
            <Nav />
            <div className="min-h-0 flex-1 overflow-auto">{children}</div>
          </div>
        </TooltipProvider>
      </body>
    </html>
  );
}
