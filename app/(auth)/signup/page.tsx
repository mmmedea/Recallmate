"use client";

import { useState } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { EmailOTPForm } from "@/components/auth/EmailOTPForm";
import Link from "next/link";

export default function SignupPage() {
  const [privacyAgreed, setPrivacyAgreed] = useState(false);

  return (
    <AuthCard>
      <div className="space-y-6">
        {/* Heading */}
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Create your account
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Start learning smarter with RecallMate
          </p>
        </div>

        {/* Google OAuth */}
        <OAuthButtons redirectTo="/upload" />

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

        {/* Privacy acknowledgement — explicit, unchecked by default */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={privacyAgreed}
            onChange={(e) => setPrivacyAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
            aria-required="true"
          />
          <span className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            I have read and agree to the{" "}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Privacy Policy
            </a>
            .
          </span>
        </label>

        {/* Email OTP — disabled until privacy agreed */}
        <div className={!privacyAgreed ? "opacity-50 pointer-events-none" : ""}>
          <EmailOTPForm intent="signup" privacyAgreed={privacyAgreed} />
        </div>

        {!privacyAgreed && (
          <p
            role="note"
            className="text-xs text-slate-400 dark:text-slate-500 text-center -mt-2"
          >
            Please agree to the Privacy Policy to continue.
          </p>
        )}

        {/* Sign in link */}
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
