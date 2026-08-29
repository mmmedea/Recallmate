import { LayoutDashboard, Upload, FileText, BrainCircuit, Sparkles, Settings, HelpCircle, CalendarDays, BookOpen, BarChart3 } from "lucide-react";
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
      label: "Study",
      href: "/dashboard",
      icon: LayoutDashboard,
      requiresAuth: true,
      mobileVisible: true,
    },
    {
      label: "Topics",
      href: "/topics",
      icon: BookOpen,
      requiresAuth: true,
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
      label: "Schedule",
      href: "/calendar",
      icon: CalendarDays,
      requiresAuth: true,
      mobileVisible: true,
    },
    { label: "Progress", href: "/progress", icon: BarChart3, requiresAuth: true, mobileVisible: true },
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
      href: "/help",
      icon: HelpCircle,
      requiresAuth: true,
      mobileVisible: false,
    },
  ],
};

