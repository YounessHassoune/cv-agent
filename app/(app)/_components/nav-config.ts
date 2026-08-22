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

export const primaryNav: NavItem[] = [
  {
    href: "/",
    label: "Chat",
    icon: MessagesSquare,
    description: "",
  },
  {
    href: "/applications",
    label: "Applications",
    icon: LayoutGridIcon,
    description: "",
  },
  {
    href: "/profile",
    label: "CV Builder",
    icon: UserRoundIcon,
    description: "",
  },
];

export const secondaryNav: NavItem[] = [
  {
    href: "/settings",
    label: "Settings",
    icon: SettingsIcon,
    description: "",
  },
];

export const brandIcon = FileTextIcon;

/** `/applications/abc` should light up the Applications entry, but `/` only matches itself. */
export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
