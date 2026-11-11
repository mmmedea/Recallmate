import { redirect } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { RecallMateBrandLogo } from "@/components/brand/RecallMateLogo";
import { createClient } from "@/utils/supabase/server";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(99,102,241,0.18),transparent_32%),radial-gradient(circle_at_80%_70%,rgba(217,70,239,0.14),transparent_30%)]" />
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <a href="/" className="inline-flex items-center gap-2 font-extrabold text-slate-950 dark:text-white">
          <RecallMateBrandLogo size="sm" animated={false} showWordmark />
        </a>
        <ThemeToggle />
      </header>
      <main className="relative z-10 flex min-h-[calc(100vh-80px)] items-center justify-center px-4 pb-12">{children}</main>
    </div>
  );
}
