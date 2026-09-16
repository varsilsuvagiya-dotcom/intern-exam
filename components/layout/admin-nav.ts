import {
  ClipboardList,
  Download,
  FileQuestion,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

import { isActive, type NavMatch } from "./nav-active";

export { isActive };

/// The admin navigation, built only from routes that actually exist.
export type NavItem = NavMatch & {
  label: string;
  icon: LucideIcon;
};

export type NavGroup = { label?: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true }],
  },
  {
    label: "Question bank",
    items: [
      {
        href: "/admin/questions",
        label: "Questions",
        icon: FileQuestion,
        excludes: ["/admin/questions/import"],
      },
      { href: "/admin/questions/import", label: "Import CSV", icon: Download },
    ],
  },
  {
    label: "Candidates & attempts",
    items: [
      { href: "/admin/candidates", label: "Candidates", icon: Users },
      { href: "/admin/attempts", label: "Attempts", icon: ClipboardList },
    ],
  },
  {
    label: "System",
    items: [{ href: "/admin/settings", label: "Settings", icon: Settings }],
  },
];
