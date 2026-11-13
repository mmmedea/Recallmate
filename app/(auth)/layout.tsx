import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Auth pages must remain renderable even when Supabase is temporarily
  // unreachable or an old session cookie cannot be decoded. A failed session
  // lookup is not a reason to replace the sign-in form with an error boundary.
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (!error && data?.claims) {
      redirect("/dashboard");
    }
  } catch (error) {
    console.error("[auth-layout] session lookup failed; keeping auth page available", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[radial-gradient(ellipse_at_12%_8%,rgba(196,167,255,.24),transparent_38%),radial-gradient(ellipse_at_88%_32%,rgba(255,82,107,.2),transparent_38%),linear-gradient(135deg,#100b19_0%,#21132c_48%,#301321_100%)] text-white">
      {/* RecallMate brand header */}
      <header className="relative z-10 flex items-center px-5 py-5 sm:px-10">
        <Link
          href="/"
          className="inline-flex items-center gap-3 transition-opacity hover:opacity-90"
        >
          <div className="h-11 w-11 overflow-hidden rounded-2xl border border-[#c4a7ff]/40 bg-[#21182d] shadow-[0_0_25px_rgba(167,139,250,.22)]">
            <img
              src="https://lh3.googleusercontent.com/d/1VBjuDg72zKakz032deRqbBJp0SYUFDuu=w512"
              alt="RecallMate logo"
              width="44"
              height="44"
              className="h-full w-full rounded-2xl object-contain"
            />
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
