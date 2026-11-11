import { LayoutDashboard, Upload, FileText, Sparkles, Settings, HelpCircle, CalendarDays, BookOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  requiresAuth?: boolean;
  featureGate?: string;
  mobileVisible?: boolean;
}

export const navigationConfig: {
  main: NavItem[];
  footer: NavItem[];
} = {
  main: [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      requiresAuth: true,
      mobileVisible: true,
    },
    {
      label: "Library",
      href: "/dashboard#library",
      icon: BookOpen,
      requiresAuth: true,
      mobileVisible: true,
    },
    {
      label: "Quiz",
      href: "/upload",
      icon: Upload,
      requiresAuth: true,
      mobileVisible: true,
    },
    {
      label: "Notes",
      href: "/notes",
      icon: FileText,
      requiresAuth: true,
      mobileVisible: true,
    },
    {
      label: "Calendar",
      href: "/calendar",
      icon: CalendarDays,
      requiresAuth: true,
      mobileVisible: true,
    },
  ],
  footer: [
    {
      label: "Premium",
      href: "#premium",
      icon: Sparkles,
      requiresAuth: true,
      mobileVisible: false,
    },
    {
      label: "Settings",
      href: "/settings",
      icon: Settings,
      requiresAuth: true,
      mobileVisible: true,
    },
    {
      label: "Help",
      href: "/help",
      icon: HelpCircle,
      requiresAuth: true,
      mobileVisible: false,
    },
  ],
};

