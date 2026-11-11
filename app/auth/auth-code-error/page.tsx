import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { AlertTriangle } from "lucide-react";

export default function AuthCodeErrorPage() {
  return (
    <AuthCard>
      <div className="space-y-6 text-center">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/50">
            <AlertTriangle className="h-7 w-7 text-rose-600 dark:text-rose-400" aria-hidden="true" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Sign-in link expired
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
            The authentication link you used has expired or is invalid. This can
            happen if the link was already used, or if too much time has passed.
          </p>
        </div>

        <Link
          href="/login"
          className="inline-flex items-center justify-center w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Try again
        </Link>
      </div>
    </AuthCard>
  );
}
