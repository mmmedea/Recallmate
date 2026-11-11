"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DiamondLoader } from "@/components/DiamondLoader";
import { OTPInput } from "./OTPInput";
import { ResendButton } from "./ResendButton";
import { TurnstileCaptcha } from "./CaptchaProvider";
import { useOTPStore } from "@/lib/store";
import type { OTPIntent } from "@/lib/types/auth";
import { AUTH_OTP_LENGTH } from "@/lib/config/auth";

interface EmailOTPFormProps {
  intent: OTPIntent;
  privacyAgreed?: boolean;
  redirectTo?: string;
  username?: string;
  onUsernameChange?: (username: string) => void;
  initialStage?: "credentials" | "otp";
}

type FormStage = "credentials" | "otp";

const AUTH_ERRORS: Record<string, string> = {
  invalid: "That code isn't valid or is no longer the newest code. Check it, or request a new verification code.",
  expired: "Your code has expired. Request a new verification code.",
  rate_limited: "Too many attempts. Please wait before trying again.",
  captcha_required: "Please complete the security check to continue.",
  captcha_failed: "Security verification failed. Please try again.",
  email_delivery: "We couldn't complete the email request. Please try again shortly.",
  email_invalid: "Enter a valid email address, including Gmail addresses such as name@gmail.com.",
  username_exists: "That username is already taken. Choose a different username.",
  service_unavailable: "RecallMate sign-in is temporarily unavailable. Please try again shortly.",
  network: "Connection error. Check your connection and try again.",
  username_required: "Choose a username using 3–30 letters, numbers, or underscores.",
  privacy_required: "Please agree to the Privacy Policy and Terms of Service.",
  error: "Something went wrong. Please try again.",
};

function safeInternalPath(path: string) {
  return path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard";
}

function verificationPath(intent: OTPIntent, destination: string) {
  const query = new URLSearchParams({ intent });
  if (destination !== "/dashboard") query.set("next", destination);
  return `/verify-email?${query.toString()}`;
}

function otpErrorKey(error: { message?: string; code?: string }) {
  const message = `${error.message ?? ""} ${error.code ?? ""}`.toLowerCase();
  if (message.includes("rate") || message.includes("too many")) return "rate_limited";
  if (message.includes("expired")) return "expired";
  if (message.includes("captcha")) return "captcha_failed";
  if (message.includes("invalid")) return "invalid";
  if (message.includes("invalid") && message.includes("email")) return "email_invalid";
  // Never surface provider text that can reveal whether an email is registered.
  return "email_delivery";
}

export function EmailOTPForm({
  intent,
  privacyAgreed = true,
  redirectTo = "/dashboard",
  username = "",
  onUsernameChange,
  initialStage = "credentials",
}: EmailOTPFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { setOTPState, setOTPFlowContext, otpFlowContext, otpState } = useOTPStore();
  const [stage, setStage] = useState<FormStage>(initialStage);
  const [email, setEmail] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const verificationInFlight = useRef(false);
  const verificationOperationRef = useRef(0);
  const previousFlowIdRef = useRef(otpFlowContext?.otpFlowId ?? null);
  const captchaEnabled =
    process.env.NEXT_PUBLIC_AUTH_CAPTCHA_UI_ENABLED === "true" &&
    Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const errorId = "auth-error-msg";
  const destination = safeInternalPath(redirectTo);

  useEffect(() => {
    if (
      otpFlowContext?.intent === intent &&
      ["sent", "verifying", "expired", "invalid", "rate_limited"].includes(otpState)
    ) {
      setStage("otp");
    }
  }, [intent, otpFlowContext?.intent, otpState]);

  useEffect(() => {
    const nextFlowId = otpFlowContext?.otpFlowId ?? null;
    if (previousFlowIdRef.current === nextFlowId) return;

    previousFlowIdRef.current = nextFlowId;
    setOtpValue("");
    setErrorKey(null);

    // A replacement flow invalidates any pending verification response.
    if (verificationInFlight.current) {
      verificationOperationRef.current += 1;
      verificationInFlight.current = false;
      setIsLoading(false);
    }
  }, [otpFlowContext?.otpFlowId]);

  const maskEmail = (address: string) => {
    const [user, domain] = address.split("@");
    if (!user || !domain) return address;
    return `${user[0]}${"•".repeat(Math.max(1, user.length - 1))}@${domain}`;
  };

  const handleSendOTP = useCallback(async (event?: React.FormEvent) => {
    event?.preventDefault();
    const isResend = stage === "otp";
    const normalizedEmail = (isResend ? otpFlowContext?.email : email)?.trim().toLowerCase() ?? "";
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setErrorKey("email_invalid");
      return;
    }

    if (!isResend && intent === "signup") {
      if (!privacyAgreed) return setErrorKey("privacy_required");
      if (!/^[A-Za-z0-9_]{3,30}$/.test(username.trim())) return setErrorKey("username_required");
    }
    if (captchaEnabled && !captchaToken) return setErrorKey("captcha_required");

    const nextFlow = {
      otpFlowId: uuidv4(),
      email: normalizedEmail,
      intent,
      createdAt: Date.now(),
    };

    setIsLoading(true);
    setErrorKey(null);
    setOtpValue("");
    setOTPState("sending");

    // A resend creates a new client flow immediately so late verification
    // results from the previous code cannot mutate this request's UI state.
    if (isResend) setOTPFlowContext(nextFlow);
    else setOTPFlowContext(null);

    try {
      if (!isResend && intent === "signup") {
        const availabilityResponse = await fetch("/api/auth/check-availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail, username: username.trim() }),
        });
        const availability = await availabilityResponse.json() as { usernameExists?: boolean };
        if (!availabilityResponse.ok) {
          const key = availabilityResponse.status === 429 ? "rate_limited" : "service_unavailable";
          setErrorKey(key);
          setOTPState(key === "rate_limited" ? "rate_limited" : "error");
          return;
        }
        if (availability.usernameExists) {
          setErrorKey("username_exists");
          setOTPState("error");
          return;
        }
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: intent === "signup",
          ...(intent === "signup" && !isResend
            ? { data: { privacy_agreed: true, username: username.trim(), recallmate_account_completed: false } }
            : {}),
          ...(captchaToken ? { captchaToken } : {}),
        },
      });

      if (error) {
        const key = otpErrorKey(error);
        setErrorKey(key);
        setOTPState(key === "rate_limited" ? "rate_limited" : "error");
        return;
      }

      setOTPFlowContext(nextFlow);
      setOTPState("sent");
      setStage("otp");
      setCaptchaToken(null);
      router.push(verificationPath(intent, destination));
    } catch {
      setErrorKey("network");
      setOTPState("error");
    } finally {
      setIsLoading(false);
    }
  }, [captchaEnabled, captchaToken, destination, email, intent, otpFlowContext?.email, privacyAgreed, router, setOTPFlowContext, setOTPState, stage, supabase, username]);

  const verifyCode = useCallback(async (code: string) => {
    const normalizedCode = code.replace(/\D/g, "").slice(0, AUTH_OTP_LENGTH);
    if (normalizedCode.length !== AUTH_OTP_LENGTH || verificationInFlight.current) return;

    const flow = otpFlowContext;
    if (!flow?.email || flow.intent !== intent) {
      setErrorKey("error");
      return;
    }

    const operation = ++verificationOperationRef.current;
    const isCurrentFlow = () =>
      verificationOperationRef.current === operation &&
      useOTPStore.getState().otpFlowContext?.otpFlowId === flow.otpFlowId;

    try {
      verificationInFlight.current = true;
      setIsLoading(true);
      setErrorKey(null);
      setOTPState("verifying");

      const { data, error } = await supabase.auth.verifyOtp({
        email: flow.email,
        token: normalizedCode,
        type: "email",
      });

      if (!isCurrentFlow()) return;

      if (error) {
        const key = otpErrorKey(error);
        const recoverableKey = key === "rate_limited" ? "rate_limited" : key === "email_delivery" ? "invalid" : key;
        setErrorKey(recoverableKey);
        setOTPState(recoverableKey as "expired" | "invalid" | "rate_limited" | "error");
        setOtpValue("");
        return;
      }

      const user = data.user;
      if (!user) {
        setErrorKey("invalid");
        setOTPState("invalid");
        setOtpValue("");
        return;
      }

      const isAccountComplete = user.user_metadata?.recallmate_account_completed === true;
      setOTPState("verified");
      verificationInFlight.current = false;
      setOTPFlowContext(null);
      const nextPath = isAccountComplete
        ? destination
        : `/onboarding?next=${encodeURIComponent(destination)}`;
      router.replace(nextPath);
      router.refresh();
    } catch {
      if (!isCurrentFlow()) return;
      setErrorKey("error");
      setOTPState("error");
      setOtpValue("");
    } finally {
      verificationInFlight.current = false;
      if (isCurrentFlow()) setIsLoading(false);
    }
  }, [destination, intent, otpFlowContext, router, setOTPFlowContext, setOTPState, supabase]);

  const handleResend = useCallback(async () => {
    setCaptchaToken(null);
    await handleSendOTP();
  }, [handleSendOTP]);

  const currentError = errorKey ? AUTH_ERRORS[errorKey] : null;

  if (stage === "credentials" && intent === "signin") {
    return <form onSubmit={handleSendOTP} className="space-y-4" noValidate>
      <div className="space-y-1.5"><Label htmlFor="signin-email">Email</Label><Input id="signin-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" autoFocus disabled={isLoading} required /></div>
      {currentError && <p id={errorId} role="alert" aria-live="assertive" className="text-sm text-rose-600 dark:text-rose-400">{currentError}</p>}
      <Button type="submit" className="h-11 w-full bg-indigo-600 font-semibold hover:bg-indigo-700" disabled={isLoading || !email.trim()}>{isLoading ? <><DiamondLoader variant="inline" label="Sending sign-in code" />Sending code…</> : <><Mail className="h-4 w-4" />Send sign-in code</>}</Button>
    </form>;
  }

  if (stage === "credentials") {
    return <form onSubmit={handleSendOTP} className="space-y-4" noValidate>
      <div className="space-y-1.5"><Label htmlFor="username-input">Username</Label><Input id="username-input" value={username} onChange={event => onUsernameChange?.(event.target.value)} placeholder="your_username" autoComplete="username" disabled={isLoading} required /></div>
      <div className="space-y-1.5"><Label htmlFor="signup-email">Email</Label><Input id="signup-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@gmail.com" autoComplete="email" disabled={isLoading} required /><p className="text-xs text-slate-500 dark:text-slate-400">Gmail and other valid email addresses are supported.</p></div>
      {captchaEnabled && <TurnstileCaptcha onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} onError={() => { setCaptchaToken(null); setErrorKey("captcha_failed"); }} />}
      {currentError && <p id={errorId} role="alert" aria-live="assertive" className="text-sm text-rose-600 dark:text-rose-400">{currentError}</p>}
      <Button type="submit" className="h-11 w-full bg-indigo-600 font-semibold hover:bg-indigo-700" disabled={isLoading || !email.trim()}>{isLoading ? <><DiamondLoader variant="inline" label="Creating account" />Sending verification code…</> : <><Mail className="h-4 w-4" />Create account & send code</>}</Button>
    </form>;
  }

  const changeEmail = () => {
    setOtpValue("");
    setErrorKey(null);
    setOTPState("idle");
    setOTPFlowContext(null);
    setCaptchaToken(null);
    if (initialStage === "otp") {
      router.replace(intent === "signup" ? "/signup" : "/login");
      return;
    }
    setStage("credentials");
  };

  return <form onSubmit={event => { event.preventDefault(); void verifyCode(otpValue); }} className="space-y-6" noValidate>
    <div className="space-y-2 text-center">
      <p role="status" aria-live="polite" className="text-sm text-slate-600 dark:text-slate-400">If this email address can receive a RecallMate verification code, we've sent one. Check your inbox, Spam, or Junk.</p>
      {otpFlowContext?.email && <p className="text-sm font-semibold text-slate-900 dark:text-white">{maskEmail(otpFlowContext.email)}</p>}
      <p className="text-xs text-slate-500 dark:text-slate-400">Enter the {AUTH_OTP_LENGTH}-digit code. Paste or type only the newest code if you requested more than one.</p>
      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">The verification email is automated. Please do not reply to it.</p>
      <p className="rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs font-medium leading-relaxed text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200">No code yet? Check your Spam or Junk folder. If you find it there, mark it as not spam so future RecallMate codes reach your inbox.</p>
    </div>
    {!otpFlowContext?.email && <p role="alert" aria-live="assertive" className="text-center text-sm text-rose-600 dark:text-rose-400">This verification request is no longer active. Start again to request a new code.</p>}
    <div className="space-y-3"><OTPInput length={AUTH_OTP_LENGTH} value={otpValue} onChange={value => { setOtpValue(value); if (value.length === AUTH_OTP_LENGTH) void verifyCode(value); }} disabled={isLoading || !otpFlowContext?.email} hasError={Boolean(currentError)} aria-describedby={currentError ? errorId : undefined} />{currentError && <p id={errorId} role="alert" aria-live="assertive" className="text-center text-sm text-rose-600 dark:text-rose-400">{currentError}</p>}</div>
    <Button type="submit" className="h-11 w-full bg-indigo-600 font-semibold hover:bg-indigo-700" disabled={isLoading || otpValue.length !== AUTH_OTP_LENGTH || !otpFlowContext?.email}>{isLoading ? <><DiamondLoader variant="inline" label="Verifying code" />Verifying code…</> : "Verify code & continue"}</Button>
    <div className="flex items-center justify-between text-sm"><ResendButton onResend={handleResend} disabled={isLoading || !otpFlowContext?.email} /><button type="button" onClick={changeEmail} disabled={isLoading} className="rounded text-slate-500 transition-colors hover:text-indigo-600 disabled:opacity-50 dark:text-slate-400">Change email</button></div>
  </form>;
}
