"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { DiamondLoader } from "@/components/DiamondLoader";

interface ResendButtonProps {
  onResend: () => Promise<void>;
  cooldownSeconds?: number;
  disabled?: boolean;
}

// UI cooldown ≠ security rate limit.
// This timer is UX feedback only — it shows the user how long before they can
// request another code in the UI. Actual rate limiting and abuse protection
// is enforced exclusively by Supabase Auth infrastructure.
export function ResendButton({
  onResend,
  cooldownSeconds = 60,
  disabled = false,
}: ResendButtonProps) {
  const [secondsLeft, setSecondsLeft] = useState(cooldownSeconds);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  const handleResend = useCallback(async () => {
    try {
      setIsSending(true);
      await onResend();
      setSecondsLeft(cooldownSeconds);
    } finally {
      setIsSending(false);
    }
  }, [onResend, cooldownSeconds]);

  const canResend = secondsLeft === 0 && !disabled && !isSending;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleResend}
      disabled={!canResend}
      className="text-sm text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 h-auto p-0 font-normal"
      aria-label={
        secondsLeft > 0
          ? `Resend code available in ${secondsLeft} seconds`
          : "Resend verification code"
      }
      aria-live="polite"
    >
      {isSending ? (
        <span className="flex items-center gap-1.5">
          <DiamondLoader variant="inline" label="Sending verification code" />
          Sending...
        </span>
      ) : secondsLeft > 0 ? (
        `Resend code in ${secondsLeft}s`
      ) : (
        "Resend code"
      )}
    </Button>
  );
}
