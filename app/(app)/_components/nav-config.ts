import {
  FileTextIcon,
  LayoutGridIcon,
  type LucideIcon,
  SettingsIcon,
  MessagesSquare,
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
    href: "/",
    label: "Chat",
    icon: MessagesSquare,
    description: "Paste a job description and get a tailored CV back.",
  },
  {
    href: "/applications",
    label: "Applications",
    icon: LayoutGridIcon,
    description: "Every CV you have tailored, with its ATS score.",
  },
  {
    href: "/profile",
    label: "CV Builder",
    icon: UserRoundIcon,
    description: "Your master profile. Every tailored CV draws only from here.",
  },
];

export const secondaryNav: NavItem[] = [
  {
    href: "/settings",
    label: "Settings",
    icon: SettingsIcon,
    description: "Account, sign-in methods and theme.",
  },
];

/** `/applications/abc` should light up the Applications entry, but `/` only matches itself. */
export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
