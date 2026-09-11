import {
  CreditCardIcon,
  GemIcon,
  LayoutGridIcon,
  type LucideIcon,
  MessagesSquare,
  SettingsIcon,
  UserRoundIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
};

/** `description` is the subtitle the topbar shows under the section name. */
export const primaryNav: NavItem[] = [
  {
    href: "/dashboard",
    label: "Chat",
    icon: MessagesSquare,
    description: "Paste a job description and get a tailored CV back.",
  },
  {
    href: "/dashboard/applications",
    label: "Applications",
    icon: LayoutGridIcon,
    description: "Every CV you have tailored, with its ATS score.",
  },
  {
    href: "/dashboard/profile",
    label: "CV Builder",
    icon: UserRoundIcon,
    description: "Your master profile. Every tailored CV draws only from here.",
  },
];

export const secondaryNav: NavItem[] = [
  {
    href: "/dashboard/pricing",
    label: "Plans",
    icon: GemIcon,
    description: "What each plan includes, and what it costs.",
  },
  {
    href: "/dashboard/billing",
    label: "Billing",
    icon: CreditCardIcon,
    description: "Your plan, your card and every invoice.",
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: SettingsIcon,
    description: "Account, sign-in methods and theme.",
  },
];

/**
 * `/dashboard/applications/abc` lights up the Applications entry. `/dashboard`
 * only matches itself — it is the prefix of every other entry, so a prefix test
 * would light the chat row up on every page in the app.
 */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
