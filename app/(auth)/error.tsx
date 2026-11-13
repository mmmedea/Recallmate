"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Auth boundary error:", { name: error.name, message: error.message, digest: error.digest, stack: error.stack });
    void fetch("/api/auth/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: error.name, message: error.message, digest: error.digest, stack: error.stack }),
      keepalive: true,
    }).catch(() => undefined);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400">
        <ShieldAlert className="h-8 w-8" />
      </div>
      <h2 className="mb-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Authentication Error</h2>
      <p className="mb-8 max-w-[400px] text-slate-500 dark:text-slate-400">
        We encountered a problem loading the authentication screen. Please try again.
      </p>
      <div className="flex gap-4">
        <Button onClick={() => reset()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          Try again
        </Button>
        <Button variant="outline" onClick={() => window.location.href = '/'}>
          Return Home
        </Button>
      </div>
    </div>
  );
}
