import { AuthCard } from "@/components/auth/AuthCard";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { EmailOTPForm } from "@/components/auth/EmailOTPForm";
import Link from "next/link";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  let next = "/dashboard";
  if (
    searchParams.next &&
    searchParams.next.startsWith("/") &&
    !searchParams.next.startsWith("//")
  ) {
    next = searchParams.next;
  }

  return (
    <AuthCard>
      <div className="space-y-6">
        {/* Heading */}
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Welcome back
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sign in to your RecallMate account
          </p>
        </div>

        {/* Google OAuth */}
        <OAuthButtons redirectTo={next} />

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-800" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 dark:text-slate-500 font-medium tracking-widest">
              or
            </span>
          </div>
        </div>

        {/* Email OTP */}
        <EmailOTPForm intent="signin" redirectTo={next} />

        {/* Sign up link */}
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          New to RecallMate?{" "}
          <Link
            href="/signup"
            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Sign up
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
