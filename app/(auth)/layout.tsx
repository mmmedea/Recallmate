import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";
import { RecallMateBrandLogo } from "@/components/brand/RecallMateLogo";
import { ReactiveGrid } from "@/components/effects/ReactiveGrid";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // getClaims() — validates JWT locally.
  // If a valid session exists, the user is already authenticated → send them in.
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/dashboard");
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#FBFAFF] dark:bg-[#070B18]">
      <ReactiveGrid />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_105%,rgba(111,53,232,0.14),transparent_34%)] dark:bg-[radial-gradient(circle_at_50%_105%,rgba(124,60,255,0.22),transparent_36%)]" />
      <header className="flex items-center justify-between px-6 py-5">
        <a
          href="/"
          className="relative z-10 inline-flex items-center gap-2 font-extrabold text-slate-900 transition-opacity hover:opacity-80 dark:text-white"
        >
          <RecallMateBrandLogo size="sm" animated={false} showWordmark />
        </a>
        <ThemeToggle />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8">
        {children}
      </main>
    </div>
  );
}
