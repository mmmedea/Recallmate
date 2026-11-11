"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { EmailOTPForm } from "@/components/auth/EmailOTPForm";
import { DiamondLoader } from "@/components/DiamondLoader";
import { useOTPStore } from "@/lib/store";

function safeInternalPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const requestedIntent = searchParams.get("intent") === "signup" ? "signup" : "signin";
  const destination = safeInternalPath(searchParams.get("next"));
  const otpFlowContext = useOTPStore((state) => state.otpFlowContext);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    const unsubscribe = useOTPStore.persist.onFinishHydration(() => setHasHydrated(true));
    if (useOTPStore.persist.hasHydrated()) setHasHydrated(true);
    return unsubscribe;
  }, []);

  if (!hasHydrated) {
    return (
      <AuthCard>
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-8 text-sm text-slate-600 dark:text-slate-300">
          <DiamondLoader variant="section" label="Preparing email verification" />
          Preparing email verification…
        </div>
      </AuthCard>
    );
  }

  if (!otpFlowContext?.email) {
    const startPath = requestedIntent === "signup" ? "/signup" : "/login";
    return (
      <AuthCard>
        <div className="space-y-4 text-center">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Verification unavailable</h1>
          <p role="alert" aria-live="assertive" className="text-sm text-rose-600 dark:text-rose-400">
            This verification request is no longer active in this browser session. Start again to request a new code.
          </p>
          <Link href={startPath} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
            {requestedIntent === "signup" ? "Return to sign up" : "Return to sign in"}
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <div className="space-y-5">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Check your email</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Enter the code to {otpFlowContext.intent === "signup" ? "finish creating your account" : "sign in"}.
          </p>
        </div>
        <EmailOTPForm
          intent={otpFlowContext.intent}
          redirectTo={destination}
          initialStage="otp"
        />
      </div>
    </AuthCard>
  );
}
