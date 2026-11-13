import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(ellipse_at_12%_8%,rgba(196,167,255,.24),transparent_38%),radial-gradient(ellipse_at_88%_32%,rgba(255,82,107,.2),transparent_38%),linear-gradient(135deg,#100b19_0%,#21132c_48%,#301321_100%)] text-white">
      {/* RecallMate brand header */}
      <header className="relative z-10 flex items-center px-5 py-5 sm:px-10">
        <Link
          href="/"
          className="inline-flex items-center gap-3 transition-opacity hover:opacity-90"
        >
          <div className="h-11 w-11 overflow-hidden rounded-2xl border border-[#c4a7ff]/40 bg-[#21182d] shadow-[0_0_25px_rgba(167,139,250,.22)]"><img src="https://lh3.googleusercontent.com/d/1VBjuDg72zKakz032deRqbBJp0SYUFDuu=w512" alt="RecallMate logo" width="44" height="44" className="h-full w-full rounded-2xl object-contain" /></div>
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
          <span className="font-fredoka bg-gradient-to-r from-[#f5efff] via-[#c4a7ff] to-[#ff7185] bg-clip-text text-2xl font-semibold tracking-tight text-transparent">RecallMate</span>
        </Link>
      </header>

      {/* Centered auth card */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
