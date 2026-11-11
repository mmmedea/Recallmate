"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OTPInput } from "./OTPInput";
import { ResendButton } from "./ResendButton";
import { TurnstileCaptcha } from "./CaptchaProvider";
import { useOTPStore } from "@/lib/store";
import type { OTPIntent } from "@/lib/types/auth";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

interface EmailOTPFormProps {
  intent: OTPIntent;
  privacyAgreed?: boolean; // required true for signup
  redirectTo?: string;
  username?: string;
  onUsernameChange?: (username: string) => void;
}

type FormStage = "email" | "otp";

const OTP_ERROR_MESSAGES: Record<string, string> = {
  invalid: "That code isn't right. Please check and try again.",
  expired: "Your code has expired. Request a new one.",
  rate_limited: "Too many attempts. Please wait a moment before trying again.",
  captcha_required: "Please complete the security check to continue.",
  captcha_failed: "Security verification failed. Please try again.",
  email_delivery: "We couldn't send the email. Please check the address and try again.",
  network: "Connection error. Please check your network and try again.",
  error: "Something went wrong. Please try again.",
  use_google: "It looks like you have a Gmail address. Please click 'Continue with Google' above!",
};

export function EmailOTPForm({ intent, privacyAgreed = true, redirectTo = "/dashboard", username = "", onUsernameChange }: EmailOTPFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const { setOTPState, setOTPFlowContext, otpFlowContext, otpState } = useOTPStore();

  const [stage, setStage] = useState<FormStage>("email");
  const [email, setEmail] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaRequired, setCaptchaRequired] = useState(false);

  // Focus management
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Mount effect to check if captcha is required
  useEffect(() => {
    // Wait for the window object
    if (typeof window !== "undefined") {
      // Very basic check - if it's production, we probably want captcha
      setCaptchaRequired(
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY !== undefined &&
        process.env.NODE_ENV === "production"
      );
    }
  }, []);

  // Rehydrate stage from sessionStorage if a flow is already active
  const hasHydrated = useRef(false);
  useEffect(() => {
    if (!hasHydrated.current && otpFlowContext) {
      if (otpFlowContext.intent === intent && ["sent", "verifying", "expired", "invalid", "rate_limited"].includes(otpState)) {
        setStage("otp");
        if (["expired", "invalid", "rate_limited"].includes(otpState)) {
          setErrorKey(otpState);
        }
      }
      hasHydrated.current = true;
    }
  }, [otpFlowContext, otpState, intent]);

  const captchaEnabled = process.env.NEXT_PUBLIC_AUTH_CAPTCHA_UI_ENABLED === "true";
  const errorId = "otp-error-msg";

  const maskEmail = (addr: string) => {
    const [user, domain] = addr.split("@");
    if (!user || !domain) return addr;
    return `${user[0]}${"•".repeat(Math.max(1, user.length - 1))}@${domain}`;
  };

  const canSubmitWithCaptcha = () => {
    if (!captchaRequired) return true;
    return !!captchaToken;
  };

  const handleSendOTP = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) return;
      
      if (trimmedEmail.endsWith("@gmail.com")) {
        setErrorKey("use_google");
        setOTPState("error");
        return;
      }
      
      if (!canSubmitWithCaptcha()) {
        setErrorKey("captcha_required");
        setOTPState("captcha_required");
        return;
      }

      try {
        setIsLoading(true);
        setErrorKey(null);
        setOTPState("sending");

        const options: Record<string, unknown> = {};
        if (captchaToken) options.captchaToken = captchaToken;
        if (intent === "signup") {
          if (!privacyAgreed) {
            setErrorKey("error");
            setOTPState("error");
            setIsLoading(false);
            return;
          }
          if (!username.trim()) {
            setErrorKey("error");
            setOTPState("error");
            setIsLoading(false);
            return;
          }
          options.data = { privacy_agreed: true, username: username.trim() };
        }

        const { error } = await supabase.auth.signInWithOtp({
          email: trimmedEmail,
          options: {
            // INTENT BOUNDARY:
            // signin → shouldCreateUser: false — a new email must NOT silently
            //   create an account. Sign In and Sign Up are semantically distinct.
            // signup → shouldCreateUser: true — create the account on first OTP.
            shouldCreateUser: intent === "signup",
            ...options,
          },
        });

        if (error) {
          if (error.message?.includes("rate")) {
            setErrorKey("rate_limited");
            setOTPState("rate_limited");
          } else {
            setErrorKey("email_delivery");
            setOTPState("error");
          }
          return;
        }

        // New flow — new otpFlowId. Scopes resend/expiry to this specific request.
        const flowId = uuidv4();
        setOTPFlowContext({
          otpFlowId: flowId,
          email: email.trim().toLowerCase(), // stored in Zustand only — never in URL
          intent,
          createdAt: Date.now(),
        });
        setOTPState("sent");
        setStage("otp");
        // Reset CAPTCHA for the next possible submission
        setCaptchaToken(null);
      } catch {
        setErrorKey("network");
        setOTPState("error");
      } finally {
        setIsLoading(false);
      }
    },
    [email, intent, username, captchaToken, canSubmitWithCaptcha, supabase, setOTPState, setOTPFlowContext]
  );

  const handleVerifyOTP = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (otpValue.length < 6) return;

      try {
        setIsLoading(true);
        setErrorKey(null);
        setOTPState("verifying");

        const { error } = await supabase.auth.verifyOtp({
          email: otpFlowContext?.email ?? email.trim().toLowerCase(),
          token: otpValue,
          type: "email",
        });

        if (error) {
          if (error.message?.includes("expired")) {
            setErrorKey("expired");
            setOTPState("expired");
          } else if (error.message?.includes("invalid")) {
            setErrorKey("invalid");
            setOTPState("invalid");
          } else if (error.message?.includes("rate")) {
            setErrorKey("rate_limited");
            setOTPState("rate_limited");
          } else {
            setErrorKey("error");
            setOTPState("error");
          }
          setOtpValue("");
          return;
        }

        setOTPState("verified");
        // Force router refresh so the server layout picks up the new session
        router.refresh();
        router.push(redirectTo);
      } catch {
        setErrorKey("network");
        setOTPState("error");
        setOtpValue("");
      } finally {
        setIsLoading(false);
      }
    },
    [otpValue, email, otpFlowContext, supabase, router, setOTPState]
  );

  const handleResend = useCallback(async () => {
    // Resending starts a new OTP flow — old UI state is discarded
    setOtpValue("");
    setErrorKey(null);
    setCaptchaToken(null);
    await handleSendOTP();
  }, [handleSendOTP]);

  const handleChangeEmail = useCallback(() => {
    // Cancel current flow — all OTP state is cleared
    setStage("email");
    setOtpValue("");
    setErrorKey(null);
    setOTPState("idle");
    setOTPFlowContext(null);
    setCaptchaToken(null);
  }, [setOTPState, setOTPFlowContext]);

  const currentError = errorKey ? OTP_ERROR_MESSAGES[errorKey] : null;

  // ── EMAIL STAGE ──────────────────────────────────────────────────
  if (stage === "email") {
    return (
      <form onSubmit={handleSendOTP} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          {intent === "signup" && <div className="space-y-1.5"><Label htmlFor="username-input">Username</Label><Input id="username-input" value={username} onChange={(e) => onUsernameChange?.(e.target.value)} placeholder="your username" autoComplete="username" disabled={isLoading} required /></div>}
          <Label htmlFor="email-input">Email</Label>
          <Input
            id="email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            disabled={isLoading}
            required
            aria-describedby={currentError ? errorId : undefined}
            className={cn(currentError && "border-rose-400 dark:border-rose-500")}
          />
        </div>

        {/* CAPTCHA — only rendered when enabled in env */}
        {captchaEnabled && (
          <TurnstileCaptcha
            onVerify={(token) => {
              setCaptchaToken(token);
              setCaptchaRequired(true);
            }}
            onExpire={() => setCaptchaToken(null)}
            onError={() => {
              setCaptchaToken(null);
              setErrorKey("captcha_failed");
            }}
          />
        )}

        {currentError && (
          <p
            id={errorId}
            role="alert"
            aria-live="assertive"
            className="text-sm text-rose-600 dark:text-rose-400"
          >
            {currentError}
          </p>
        )}

        <Button
          type="submit"
          className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 font-semibold"
          disabled={isLoading || !email.trim()}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <>
              <Mail className="h-4 w-4" aria-hidden="true" />
              Send verification code
            </>
          )}
        </Button>
      </form>
    );
  }

  // ── OTP STAGE ────────────────────────────────────────────────────
  const maskedEmail = maskEmail(otpFlowContext?.email ?? email);

  return (
    <form onSubmit={handleVerifyOTP} className="space-y-6" noValidate>
      <div className="text-center space-y-1">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          We sent a code to
        </p>
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {maskedEmail}
        </p>
      </div>

      <div className="space-y-3">
        <OTPInput
          value={otpValue}
          onChange={(val) => {
            setOtpValue(val);
            // Auto-submit when 6 digits entered
            if (val.length === 6) handleVerifyOTP();
          }}
          disabled={isLoading}
          hasError={!!currentError}
          aria-describedby={currentError ? errorId : undefined}
        />

        {currentError && (
          <p
            id={errorId}
            role="alert"
            aria-live="assertive"
            className="text-sm text-rose-600 dark:text-rose-400 text-center"
          >
            {currentError}
          </p>
        )}
      </div>

      <Button
        type="submit"
        className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 font-semibold"
        disabled={isLoading || otpValue.length < 6}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          "Verify code"
        )}
      </Button>

      <div className="flex items-center justify-between text-sm">
        <ResendButton onResend={handleResend} disabled={isLoading} />
        <button
          type="button"
          onClick={handleChangeEmail}
          className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Change email
        </button>
      </div>
    </form>
  );
}

