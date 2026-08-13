"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h2 className="mb-2 text-2xl font-bold tracking-tight text-foreground">Something went wrong!</h2>
      <p className="mb-8 max-w-[500px] text-muted-foreground">
        We encountered an unexpected error. The system has logged this incident and we're looking into it.
      </p>
      <div className="flex gap-4">
        <Button onClick={() => reset()} size="lg">
          Try again
        </Button>
        <Button variant="outline" size="lg" onClick={() => window.location.reload()}>
          Reload Page
        </Button>
      </div>
    </div>
  );
}
