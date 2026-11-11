"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App boundary error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h2 className="mb-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Workspace Error</h2>
      <p className="mb-8 max-w-[400px] text-slate-500 dark:text-slate-400">
        Something went wrong in your study workspace. Your data is safe.
      </p>
      <div className="flex gap-4">
        <Button onClick={() => reset()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          Reload Workspace
        </Button>
      </div>
    </div>
  );
}
