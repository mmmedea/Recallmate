import { AuthCard } from "@/components/auth/AuthCard";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { EmailOTPForm } from "@/components/auth/EmailOTPForm";
import { RecallMateLogo } from "@/components/brand/RecallMateLogo";
import Link from "next/link";

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const next = "/dashboard";

  const authErrorMessage =
    searchParams.error === "missing_oauth_code"
      ? "Google sign-in did not return a valid authorization code. Please try again."
      : searchParams.error === "google_auth_failed"
        ? "Google sign-in could not finish. Please start from this production login page and try again."
        : searchParams.error === "google_oauth_setup_mismatch"
          ? "Google sign-in is temporarily unavailable. You can continue with email or try again shortly."
        : "";

  return (
    <AuthCard>
      <div className="space-y-6">
        {/* Heading */}
        <div className="space-y-1 text-center">
          <RecallMateLogo animated={false} showWordmark size="lg" className="mb-5 justify-center" />
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Welcome back
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sign in to your RecallMate account
          </p>
        </div>

        {/* Google OAuth */}
        <OAuthButtons redirectTo={next} />

        {authErrorMessage && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-300"
          >
            {authErrorMessage}
          </div>
        )}

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
