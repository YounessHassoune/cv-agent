import {
  FileTextIcon,
  LayoutGridIcon,
  type LucideIcon,
  SettingsIcon,
  SparklesIcon,
  UserRoundIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
};

export const primaryNav: NavItem[] = [
  {
    href: "/",
    label: "Tailor Chat",
    icon: SparklesIcon,
    description: "Paste a job description and generate a CV",
  },
  {
    href: "/applications",
    label: "Applications",
    icon: LayoutGridIcon,
    description: "Every tailored CV you have generated",
  },
  {
    href: "/profile",
    label: "CV Builder",
    icon: UserRoundIcon,
    description: "Your master profile — the only source of facts",
  },
];

export const secondaryNav: NavItem[] = [
  {
    href: "/settings",
    label: "Settings",
    icon: SettingsIcon,
    description: "Account and appearance",
  },
];

export const brandIcon = FileTextIcon;

/** `/applications/abc` should light up the Applications entry, but `/` only matches itself. */
export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
