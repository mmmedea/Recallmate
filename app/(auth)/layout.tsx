import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import ThemeToggle from "@/components/ThemeToggle";

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/20 flex flex-col">
      {/* Minimal header — wordmark only */}
      <header className="flex items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-extrabold text-slate-900 dark:text-white hover:opacity-80 transition-opacity"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
          </div>
          RecallMate
        </Link>
        <ThemeToggle />
      </header>

      {/* Centered auth card */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        {children}
      </main>
    </div>
  );
}
