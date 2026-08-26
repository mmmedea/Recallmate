import { Home, LayoutDashboard, Upload, FileText, BrainCircuit, Sparkles, Settings, HelpCircle, CalendarDays } from "lucide-react";
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
      label: "Home",
      href: "/",
      icon: Home,
      requiresAuth: false,
      mobileVisible: true,
    },
    {
      label: "Upload",
      href: "/upload",
      icon: Upload,
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
    {
      label: "Notes",
      href: "/notes",
      icon: FileText,
      requiresAuth: true,
      mobileVisible: true,
    },
    {
      label: "Quizzes",
      href: "/quiz",
      icon: BrainCircuit,
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
      href: "#help",
      icon: HelpCircle,
      requiresAuth: true,
      mobileVisible: false,
    },
  ],
};

