export interface NavItem {
  label: string;
  href: string;
  symbol: string;
  requiresAuth?: boolean;
  featureGate?: string;
  mobileVisible?: boolean;
}

export const navigationConfig: { main: NavItem[]; footer: NavItem[] } = {
  main: [
    { label: "Study", href: "/dashboard", symbol: "01", requiresAuth: true, mobileVisible: true },
    { label: "My Library", href: "/topics", symbol: "02", requiresAuth: true, mobileVisible: true },
    { label: "Create Workspace", href: "/upload", symbol: "03", requiresAuth: true, mobileVisible: true },
    { label: "Schedule", href: "/calendar", symbol: "04", requiresAuth: true, mobileVisible: true },
  ],
  footer: [
    { label: "Help & Support", href: "/help", symbol: "?", requiresAuth: true, mobileVisible: true },
    { label: "Settings & Profile", href: "/settings", symbol: "05", requiresAuth: true, mobileVisible: true },
  ],
};
