import { AuthCard } from "@/components/auth/AuthCard";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { EmailOTPForm } from "@/components/auth/EmailOTPForm";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; passwordReset?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  let next = "/dashboard";
  if (
    resolvedSearchParams.next &&
    resolvedSearchParams.next.startsWith("/") &&
    resolvedSearchParams.next !== "/" &&
    !resolvedSearchParams.next.startsWith("//") &&
    !resolvedSearchParams.next.startsWith("/login") &&
    !resolvedSearchParams.next.startsWith("/signup") &&
    !resolvedSearchParams.next.startsWith("/auth/")
  ) {
    next = resolvedSearchParams.next;
  }

  return (
    <AuthCard>
      <div className="space-y-5"><nav aria-label="Account access" className="mx-auto grid w-full max-w-[280px] grid-cols-2 rounded-full border border-[#e5d9f4] bg-[#eee8f7] p-1.5 shadow-inner"><Link href="/login" aria-current="page" className="rounded-full bg-gradient-to-r from-white to-[#fff4f6] px-4 py-2.5 text-center font-fredoka text-sm font-semibold text-[#21152d] shadow-[0_3px_12px_rgba(34,18,48,.12)] ring-1 ring-white">Sign in</Link><Link href="/signup" className="rounded-full px-4 py-2.5 text-center font-fredoka text-sm font-semibold text-[#766b84] transition-all duration-200 hover:bg-white/70 hover:text-[#21152d]">Sign up</Link></nav>
        {/* Heading */}
        <div className="space-y-1 text-center">
          <h1 className="font-fredoka text-3xl font-semibold tracking-tight text-[#21152d] sm:text-4xl">
            Welcome back
          </h1>
          <p className="font-quicksand text-sm font-semibold text-[#746a80]">
            Sign in to your RecallMate account
          </p>
        </div>

        {/* Email OTP */}
        <EmailOTPForm intent="signin" redirectTo={next} passwordReset={resolvedSearchParams.passwordReset === "success"} />
        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#a78bfa]/25" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#fffaff] px-3 font-pixelify text-xs font-medium tracking-widest text-[#8b779f]">
              OR CONTINUE WITH
            </span>
          </div>
        </div>

        <OAuthButtons redirectTo={next} intent="signin" />

        {/* Sign up link */}
        <p className="text-center text-sm text-[#746a80]">
          New to RecallMate?{" "}
          <Link
            href="/signup"
            className="font-fredoka font-semibold text-[#bd4668] hover:text-[#8e64cb] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4a7ff] rounded"
          >
            Sign up
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
