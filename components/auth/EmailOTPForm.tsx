"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, LockKeyhole, Mail, Check, Circle } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
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
  password?: string;
  onPasswordChange?: (value: string) => void;
  confirmPassword?: string;
  onConfirmPasswordChange?: (value: string) => void;
  privacyControl?: React.ReactNode;
  passwordReset?: boolean;
}

type FormStage = "credentials" | "otp" | "recovery-email" | "recovery-code" | "recovery-password";

const AUTH_ERRORS: Record<string, string> = {
  invalid: "That code isn't valid or is no longer the newest code. Check it, or request a new verification code.",
  expired: "Your code has expired. Request a new verification code.",
  rate_limited: "Too many attempts. Please wait before trying again.",
  captcha_required: "Please complete the security check to continue.",
  captcha_failed: "Security verification failed. Please try again.",
  email_delivery: "We couldn't send the email. Check the address and try again.",
  email_invalid: "Enter a valid email address, including Gmail addresses such as name@gmail.com.",
  account_exists: "An account already uses this email. Sign in instead, or reset your password.",
  username_exists: "That username is already taken. Choose a different username.",
  email_unconfirmed: "This account has not been verified yet. Finish email verification before signing in.",
  service_unavailable: "RecallMate sign-in is temporarily unavailable. Please try again shortly.",
  network: "Connection error. Check your connection and try again.",
  invalid_credentials: "We couldn't find a matching RecallMate account, or the password is incorrect. If you haven't signed up yet, create an account first.",
  username_required: "Choose a username using 3–30 letters, numbers, or underscores.",
  weak_password: "Use at least 8 characters, uppercase and lowercase letters, and one special symbol.",
  password_mismatch: "The passwords do not match.",
  privacy_required: "Please agree to the Privacy Policy and Terms of Service.",
  recovery_sent: "If an account exists for this email, a password recovery code has been sent. Check your inbox and spam folder.",
  recovery_password: "Choose a new password that meets all the requirements.",
  recovery_mismatch: "The new passwords do not match.",
  service_configuration: "RecallMate authentication needs attention. Please try again later or contact support.",
  error: "Something went wrong. Please try again.",
};

function safeInternalPath(path: string) {
  // Never treat the marketing homepage or an auth endpoint as a post-login
  // destination. Successful sign-in and sign-up should enter the app.
  const isInternalAppPath =
    path.startsWith("/") &&
    path !== "/" &&
    !path.startsWith("//") &&
    !path.startsWith("/login") &&
    !path.startsWith("/signup") &&
    !path.startsWith("/auth/");
  return isInternalAppPath ? path : "/dashboard";
}

export function EmailOTPForm({
  intent,
  privacyAgreed = true,
  redirectTo = "/dashboard",
  username = "",
  onUsernameChange,
  password = "",
  onPasswordChange,
  confirmPassword = "",
  onConfirmPasswordChange,
  privacyControl,
  passwordReset = false,
}: EmailOTPFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { setOTPState, setOTPFlowContext, otpFlowContext, otpState } = useOTPStore();
  const [stage, setStage] = useState<FormStage>("credentials");
  const [email, setEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryPasswordConfirm, setRecoveryPasswordConfirm] = useState("");
  const [recoveryNotice, setRecoveryNotice] = useState(false);
  const [availability, setAvailability] = useState<{ email: "available" | "taken" | null; username: "available" | "taken" | null }>({ email: null, username: null });
  const [otpValue, setOtpValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const hasHydrated = useRef(false);
  const verificationInFlight = useRef(false);
  const captchaEnabled =
    process.env.NEXT_PUBLIC_AUTH_CAPTCHA_UI_ENABLED === "true" &&
    Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const errorId = "auth-error-msg";
  const destination = safeInternalPath(redirectTo);

  useEffect(() => {
    if (
      intent === "signup" &&
      !hasHydrated.current &&
      otpFlowContext?.intent === intent &&
      ["sent", "verifying", "expired", "invalid", "rate_limited"].includes(otpState)
    ) {
      setStage("otp");
      if (["expired", "invalid", "rate_limited"].includes(otpState)) {
        setErrorKey(otpState);
      }
    }
    hasHydrated.current = true;
  }, [intent, otpFlowContext, otpState]);

  const maskEmail = (address: string) => {
    const [user, domain] = address.split("@");
    if (!user || !domain) return address;
    return `${user[0]}${"•".repeat(Math.max(1, user.length - 1))}@${domain}`;
  };

  const checkIdentityAvailability = useCallback(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || !/^[A-Za-z0-9_]{3,30}$/.test(normalizedUsername)) return;
    try {
      const response = await fetch("/api/auth/check-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, username: normalizedUsername }),
      });
      if (!response.ok) return;
      const result = await response.json() as { emailExists?: boolean; usernameExists?: boolean };
      setAvailability({
        email: result.emailExists ? "taken" : "available",
        username: result.usernameExists ? "taken" : "available",
      });
      if (result.emailExists) setErrorKey("account_exists");
      else if (errorKey === "account_exists") setErrorKey(null);
      if (result.usernameExists) setErrorKey("username_exists");
      else if (errorKey === "username_exists") setErrorKey(null);
    } catch {
      // Availability hints are best-effort; the server rechecks before signup.
    }
  }, [email, errorKey, username]);

  const handlePasswordSignIn = useCallback(async (event?: React.FormEvent) => {
    event?.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !signInPassword) return;
    setIsLoading(true);
    setErrorKey(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password: signInPassword });
      if (error) {
        const message = error.message.toLowerCase();
        const code = "code" in error && typeof error.code === "string" ? error.code.toLowerCase() : "";
        const status = Number(error.status);
        const key =
          status === 429 || code.includes("rate") || message.includes("rate limit")
            ? "rate_limited"
            : message.includes("email not confirmed") || code === "email_not_confirmed"
              ? "email_unconfirmed"
              : message.includes("invalid api key") ||
                  message.includes("supabase_url") ||
                  message.includes("supabase_key") ||
                  code === "invalid_api_key"
                ? "service_configuration"
                : code === "invalid_credentials" ||
                    message.includes("invalid login credentials") ||
                    message.includes("invalid credentials") ||
                    message.includes("user not found") ||
                    status === 400 ||
                    status === 401
                  ? "invalid_credentials"
                  : status >= 500
                    ? "service_unavailable"
                    : "network";
        console.error("[auth] password sign-in rejected", {
          status: Number.isFinite(status) ? status : "unknown",
          code: code || "unknown",
          category: key,
        });
        setErrorKey(key);
        return;
      }
      router.replace(destination);
      router.refresh();
    } catch {
      setErrorKey("network");
    } finally {
      setIsLoading(false);
    }
  }, [destination, email, router, signInPassword, supabase]);

  const handleSendOTP = useCallback(async (event?: React.FormEvent) => {
    event?.preventDefault();
    const normalizedEmail = (email || otpFlowContext?.email || "").trim().toLowerCase();
    if (!normalizedEmail) return;
    if (!privacyAgreed) return setErrorKey("privacy_required");
    if (!/^[A-Za-z0-9_]{3,30}$/.test(username.trim())) return setErrorKey("username_required");
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[^\sA-Za-z0-9]/.test(password)) return setErrorKey("weak_password");
    if (password !== confirmPassword) return setErrorKey("password_mismatch");
    if (captchaEnabled && !captchaToken) return setErrorKey("captcha_required");

    try {
      setIsLoading(true);
      setErrorKey(null);
      setOTPState("sending");
      const availabilityResponse = await fetch("/api/auth/check-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, username: username.trim() }),
      });
      const availability = await availabilityResponse.json().catch(() => ({})) as {
        emailExists?: boolean;
        usernameExists?: boolean;
        error?: string;
        code?: string;
      };
      if (!availabilityResponse.ok) {
        const failure =
          availability.code === "service_configuration"
            ? "service_configuration"
            : availabilityResponse.status === 429 || availability.code === "rate_limited"
              ? "rate_limited"
              : availabilityResponse.status >= 500 || availability.code === "service_unavailable"
                ? "service_unavailable"
                : availabilityResponse.status === 400
                  ? "email_invalid"
                  : "network";
        console.error("[auth] signup availability check rejected", {
          status: availabilityResponse.status,
          code: availability.code || "unknown",
        });
        setErrorKey(failure);
        setOTPState("error");
        return;
      }
      if (availability.emailExists) {
        setErrorKey("account_exists");
        setOTPState("error");
        return;
      }
      if (availability.usernameExists) {
        setErrorKey("username_exists");
        setOTPState("error");
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          data: { privacy_agreed: true, username: username.trim(), recallmate_account_completed: false },
          ...(captchaToken ? { captchaToken } : {}),
        },
      });
      if (error) {
        const message = error.message.toLowerCase();
        const key = message.includes("profiles_username_unique_ci") || (message.includes("duplicate key") && message.includes("username"))
          ? "username_exists"
          : message.includes("already") || message.includes("registered") || message.includes("exists")
            ? "account_exists"
            : message.includes("invalid") && message.includes("email")
              ? "email_invalid"
              : message.includes("rate")
                ? "rate_limited"
                : message.includes("invalid api key")
                  ? "service_configuration"
                  : "email_delivery";
        setErrorKey(key);
        setOTPState(key === "rate_limited" ? "rate_limited" : "error");
        return;
      }
      setOTPFlowContext({ otpFlowId: uuidv4(), email: normalizedEmail, intent, createdAt: Date.now() });
      setOTPState("sent");
      setStage("otp");
      setCaptchaToken(null);
    } catch {
      setErrorKey("network");
      setOTPState("error");
    } finally {
      setIsLoading(false);
    }
  }, [captchaEnabled, captchaToken, confirmPassword, email, intent, otpFlowContext?.email, password, privacyAgreed, setOTPFlowContext, setOTPState, supabase, username]);

  const verifyCode = useCallback(async (code: string) => {
    const normalizedCode = code.replace(/\D/g, "").slice(0, AUTH_OTP_LENGTH);
    if (normalizedCode.length !== AUTH_OTP_LENGTH || verificationInFlight.current) return;
    const normalizedEmail = otpFlowContext?.email ?? email.trim().toLowerCase();
    try {
      verificationInFlight.current = true;
      setIsLoading(true);
      setErrorKey(null);
      setOTPState("verifying");
      const { error } = await supabase.auth.verifyOtp({ email: normalizedEmail, token: normalizedCode, type: "email" });
      if (error) {
        const message = error.message.toLowerCase();
        const key = message.includes("invalid")
          ? "invalid"
          : message.includes("expired")
            ? "expired"
            : message.includes("rate")
              ? "rate_limited"
              : "error";
        setErrorKey(key);
        setOTPState(key as "expired" | "invalid" | "rate_limited" | "error");
        setOtpValue("");
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { username: username.trim(), privacy_agreed: true, recallmate_account_completed: true },
      });
      if (updateError) throw updateError;
      setOTPState("verified");
      setOTPFlowContext(null);
      router.replace(destination);
      router.refresh();
    } catch {
      setErrorKey("error");
      setOTPState("error");
      setOtpValue("");
    } finally {
      verificationInFlight.current = false;
      setIsLoading(false);
    }
  }, [destination, email, otpFlowContext?.email, password, router, setOTPFlowContext, setOTPState, supabase, username]);

  const handleResend = useCallback(async () => {
    setOtpValue("");
    setErrorKey(null);
    setCaptchaToken(null);
    await handleSendOTP();
  }, [handleSendOTP]);

  const requestRecoveryCode = useCallback(async (event?: React.FormEvent): Promise<boolean> => {
    event?.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(normalizedEmail)) {
      setErrorKey("email_invalid");
      return false;
    }
    try {
      setIsLoading(true);
      setErrorKey(null);
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
        ...(captchaToken ? { captchaToken } : {}),
      });
      if (error) {
        const message = error.message.toLowerCase();
        setErrorKey(message.includes("rate") ? "rate_limited" : message.includes("invalid api key") ? "service_configuration" : "email_delivery");
        return false;
      }
      setRecoveryNotice(true);
      setStage("recovery-code");
      setOtpValue("");
      setErrorKey(null);
      return true;
    } catch {
      setErrorKey("network");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [captchaToken, email, supabase]);

  const verifyRecoveryCode = useCallback(async (event?: React.FormEvent) => {
    event?.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const code = otpValue.replace(/\D/g, "").slice(0, AUTH_OTP_LENGTH);
    if (code.length !== AUTH_OTP_LENGTH) return;
    try {
      setIsLoading(true);
      setErrorKey(null);
      const { error } = await supabase.auth.verifyOtp({ email: normalizedEmail, token: code, type: "recovery" });
      if (error) {
        const message = error.message.toLowerCase();
        setErrorKey(message.includes("expired") ? "expired" : message.includes("rate") ? "rate_limited" : "invalid");
        setOtpValue("");
        return;
      }
      setStage("recovery-password");
    } catch {
      setErrorKey("network");
    } finally {
      setIsLoading(false);
    }
  }, [email, otpValue, supabase]);

  const saveRecoveredPassword = useCallback(async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (recoveryPassword.length < 8 || !/[A-Z]/.test(recoveryPassword) || !/[a-z]/.test(recoveryPassword) || !/[^\sA-Za-z0-9]/.test(recoveryPassword)) {
      setErrorKey("weak_password");
      return;
    }
    if (recoveryPassword !== recoveryPasswordConfirm) {
      setErrorKey("recovery_mismatch");
      return;
    }
    try {
      setIsLoading(true);
      setErrorKey(null);
      const { error } = await supabase.auth.updateUser({ password: recoveryPassword });
      if (error) {
        setErrorKey(error.message.toLowerCase().includes("rate") ? "rate_limited" : "error");
        return;
      }
      setSignInPassword("");
      setRecoveryPassword("");
      setRecoveryPasswordConfirm("");
      setOtpValue("");
      setStage("credentials");
      setErrorKey(null);
      setRecoveryNotice(false);
      await supabase.auth.signOut();
      router.replace("/login?passwordReset=success");
      router.refresh();
    } catch {
      setErrorKey("network");
    } finally {
      setIsLoading(false);
    }
  }, [recoveryPassword, recoveryPasswordConfirm, router, supabase]);

  const currentError = errorKey ? AUTH_ERRORS[errorKey] : null;
  const passwordRules = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter", met: /[a-z]/.test(password) },
    { label: "One special symbol", met: /[^\sA-Za-z0-9]/.test(password) },
  ];
  const passwordValid = passwordRules.every((rule) => rule.met);
  const usernameValid = /^[A-Za-z0-9_]{3,30}$/.test(username.trim());
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const confirmValid = password.length > 0 && password === confirmPassword;
  const signupReady = usernameValid && emailValid && passwordValid && confirmValid && privacyAgreed && (!captchaEnabled || Boolean(captchaToken));
  const emailAlreadyRegistered = intent === "signup" && (errorKey === "account_exists" || availability.email === "taken");
  const emailFieldClass = emailAlreadyRegistered
    ? "border-[#e5485f] bg-white text-[#21152d] ring-2 ring-[#ff6478]/15 focus-visible:border-[#e5485f] focus-visible:ring-[#ff6478]/30"
    : "border-[#ded0ef] bg-white text-[#21152d] shadow-[0_2px_8px_rgba(40,20,55,.035)] transition-all duration-200 placeholder:text-[#a49aaa] hover:border-[#c5a9e8] focus-visible:border-[#a879e8] focus-visible:ring-2 focus-visible:ring-[#c4a7ff]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaff]";

  if (intent === "signin" && stage === "credentials") {
    return <form onSubmit={handlePasswordSignIn} className="space-y-4" noValidate>
      {passwordReset && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Your password has been reset. Please sign in with your new password.</p>}
      <div className="space-y-1.5"><Label htmlFor="signin-email" className="font-quicksand font-bold text-[#43364f]">Email</Label><Input id="signin-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@email.com" className="border-[#ded0ef] bg-white/90 text-[#21152d] shadow-[0_2px_8px_rgba(40,20,55,.035)] transition-all duration-200 placeholder:text-[#a49aaa] hover:border-[#c5a9e8] focus-visible:border-[#a879e8] focus-visible:ring-2 focus-visible:ring-[#c4a7ff]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaff]" autoComplete="email" autoFocus disabled={isLoading} required /></div>
      <div className="space-y-1.5"><Label htmlFor="signin-password" className="font-quicksand font-bold text-[#43364f]">Password</Label><PasswordInput id="signin-password" value={signInPassword} onChange={event => setSignInPassword(event.target.value)} placeholder="Your RecallMate password" className="border-[#ded0ef] bg-white/90 text-[#21152d] shadow-[0_2px_8px_rgba(40,20,55,.035)] transition-all duration-200 placeholder:text-[#a49aaa] hover:border-[#c5a9e8] focus-visible:border-[#a879e8] focus-visible:ring-2 focus-visible:ring-[#c4a7ff]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaff]" autoComplete="current-password" disabled={isLoading} required /></div>
      <div className="flex justify-end -mt-1"><button type="button" onClick={() => { setErrorKey(null); setOtpValue(""); setRecoveryNotice(false); setStage("recovery-email"); }} className="rounded-md text-xs font-bold text-[#9465cf] underline-offset-4 hover:text-[#d34c69] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4a7ff]">Forgot password?</button></div>
      {currentError && <p id={errorId} role="alert" className="text-sm text-[#bd4668]">{currentError}</p>}
      <Button type="submit" className="font-fredoka h-12 w-full rounded-xl border border-[#b69ae8] bg-gradient-to-r from-[#a78bfa] via-[#c4a7ff] to-[#ff7185] font-bold text-[#1b1025] shadow-[0_8px_24px_rgba(167,139,250,.24)] transition-all hover:-translate-y-0.5 hover:brightness-105" disabled={isLoading || !email.trim() || !signInPassword}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LockKeyhole className="h-4 w-4" />Sign in</>}</Button>
    </form>;
  }

  if (stage === "recovery-email") {
    return <form onSubmit={requestRecoveryCode} className="space-y-4" noValidate>
      <div className="space-y-1 text-center">
        <h2 className="font-fredoka text-2xl font-semibold text-[#21152d]">Forgot your password?</h2>
        <p className="font-quicksand text-sm font-semibold text-[#746a80]">Enter the email linked to your RecallMate account. We’ll send a one-time recovery code.</p>
      </div>
      <div className="space-y-1.5"><Label htmlFor="recovery-email" className="font-quicksand font-bold text-[#43364f]">Email</Label><Input id="recovery-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@email.com" autoComplete="email" disabled={isLoading} required className="border-[#ded0ef] bg-white text-[#21152d] placeholder:text-[#a49aaa]" /></div>
      {captchaEnabled && <TurnstileCaptcha onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} onError={() => { setCaptchaToken(null); setErrorKey("captcha_failed"); }} />}
      {currentError && <p id={errorId} role="alert" className="text-sm text-[#bd4668]">{currentError}</p>}
      <Button type="submit" disabled={isLoading || !email.trim() || (captchaEnabled && !captchaToken)} className="font-fredoka h-12 w-full rounded-xl bg-gradient-to-r from-[#a78bfa] via-[#c4a7ff] to-[#ff7185] font-bold text-[#1b1025] disabled:opacity-40">{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send recovery code"}</Button>
      <button type="button" onClick={() => { setStage("credentials"); setErrorKey(null); }} className="w-full text-center text-xs font-semibold text-[#81758c] hover:text-[#d34c69]">Back to sign in</button>
    </form>;
  }

  if (stage === "recovery-code") {
    return <form onSubmit={verifyRecoveryCode} className="space-y-5" noValidate>
      <div className="space-y-2 text-center">
        <h2 className="font-fredoka text-2xl font-semibold text-[#21152d]">Reset your password</h2>
        <p className="font-quicksand text-sm font-semibold text-[#746a80]">Enter the 6-digit recovery code sent to your email address.</p>
        <p className="text-sm font-bold text-[#21152d]">{maskEmail(email)}</p>
        {recoveryNotice && <p role="status" className="rounded-xl border border-[#b9a1e8] bg-[#f2ecff] px-3 py-2 text-xs font-semibold text-[#59416f]">If this email is registered, a recovery code is on its way. Check your inbox and spam folder.</p>}
      </div>
      <OTPInput length={AUTH_OTP_LENGTH} value={otpValue} onChange={setOtpValue} disabled={isLoading} hasError={Boolean(currentError)} aria-describedby={currentError ? errorId : undefined} />
      {currentError && <p id={errorId} role="alert" className="text-center text-sm text-[#bd4668]">{currentError}</p>}
      <Button type="submit" disabled={isLoading || otpValue.length !== AUTH_OTP_LENGTH} className="font-fredoka h-12 w-full rounded-xl bg-gradient-to-r from-[#a78bfa] via-[#c4a7ff] to-[#ff7185] font-bold text-[#1b1025] disabled:opacity-40">{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify recovery code"}</Button>
      <div className="flex items-center justify-between text-xs font-semibold"><ResendButton onResend={requestRecoveryCode} cooldownSeconds={120} disabled={isLoading} /><button type="button" disabled={isLoading} onClick={() => { setStage("credentials"); setErrorKey(null); setRecoveryNotice(false); }} className="text-[#81758c] hover:text-[#d34c69] disabled:opacity-50">Back to sign in</button></div>
    </form>;
  }

  if (stage === "recovery-password") {
    const rulesMet = recoveryPassword.length >= 8 && /[A-Z]/.test(recoveryPassword) && /[a-z]/.test(recoveryPassword) && /[^\sA-Za-z0-9]/.test(recoveryPassword);
    return <form onSubmit={saveRecoveredPassword} className="space-y-4" noValidate>
      <div className="text-center"><h2 className="font-fredoka text-2xl font-semibold text-[#21152d]">Choose a new password</h2><p className="font-quicksand text-sm text-[#746a80]">Your email code is verified. Create a fresh password for RecallMate.</p></div>
      <div className="space-y-1.5"><Label htmlFor="recovery-new-password" className="font-quicksand font-bold text-[#43364f]">New password</Label><PasswordInput id="recovery-new-password" value={recoveryPassword} onChange={event => setRecoveryPassword(event.target.value)} autoComplete="new-password" disabled={isLoading} required /></div>
      <div className="space-y-1.5"><Label htmlFor="recovery-confirm-password" className="font-quicksand font-bold text-[#43364f]">Confirm new password</Label><PasswordInput id="recovery-confirm-password" value={recoveryPasswordConfirm} onChange={event => setRecoveryPasswordConfirm(event.target.value)} autoComplete="new-password" disabled={isLoading} required /></div>
      <p className={`text-xs font-semibold ${rulesMet ? "text-emerald-700" : "text-[#81758c]"}`}>At least 8 characters, uppercase, lowercase, and one special symbol.</p>
      {currentError && <p id={errorId} role="alert" className="text-sm text-[#bd4668]">{currentError}</p>}
      <Button type="submit" disabled={isLoading || !rulesMet || recoveryPassword !== recoveryPasswordConfirm} className="font-fredoka h-12 w-full rounded-xl bg-gradient-to-r from-[#a78bfa] via-[#c4a7ff] to-[#ff7185] font-bold text-[#1b1025] disabled:opacity-40">{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save new password"}</Button>
    </form>;
  }

  if (stage === "credentials") {
    return <form onSubmit={handleSendOTP} className="space-y-4" noValidate>
      <div className="space-y-1.5"><Label htmlFor="username-input" className="font-quicksand font-bold text-[#43364f]">Username</Label><Input id="username-input" value={username} onChange={event => { onUsernameChange?.(event.target.value); setAvailability(current => ({ ...current, username: null })); if (errorKey === "username_exists") setErrorKey(null); }} onBlur={() => void checkIdentityAvailability()} placeholder="e.g., your_username" className={errorKey === "username_exists" ? "border-[#e5485f] bg-white text-[#21152d] ring-2 ring-[#ff6478]/15" : "border-[#ded0ef] bg-white/90 text-[#21152d] shadow-[0_2px_8px_rgba(40,20,55,.035)] transition-all duration-200 placeholder:text-[#a49aaa] hover:border-[#c5a9e8] focus-visible:border-[#a879e8] focus-visible:ring-2 focus-visible:ring-[#c4a7ff]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaff]"} autoComplete="username" disabled={isLoading} required aria-invalid={errorKey === "username_exists"} />{(errorKey === "username_exists" || availability.username === "taken") ? <p role="alert" className="text-xs font-bold text-[#d93650]">This username is already being used. Please choose another one.</p> : availability.username === "available" ? <p role="status" className="text-xs font-bold text-emerald-700">Username is available.</p> : null}</div>
      <div className="space-y-1.5"><Label htmlFor="signup-email" className="font-quicksand font-bold text-[#43364f]">Email</Label><Input id="signup-email" type="email" value={email} onChange={event => { setEmail(event.target.value); setAvailability(current => ({ ...current, email: null })); if (errorKey === "account_exists" || errorKey === "email_invalid") setErrorKey(null); }} onBlur={() => void checkIdentityAvailability()} placeholder="you@email.com" className={emailFieldClass} autoComplete="email" disabled={isLoading} required aria-invalid={emailAlreadyRegistered} aria-describedby={emailAlreadyRegistered ? "signup-email-error" : undefined} />{emailAlreadyRegistered ? <p id="signup-email-error" role="alert" className="mt-1 flex flex-wrap items-center gap-x-1 text-xs font-bold text-[#d93650]"><span>This email is already registered.</span><Link href="/login" className="underline decoration-[#d93650]/50 underline-offset-2 transition-colors hover:text-[#9b315e]">Sign in instead</Link></p> : availability.email === "available" ? <p role="status" className="font-quicksand text-xs font-bold text-emerald-700">Email address is available.</p> : <p className="font-quicksand text-xs font-medium text-[#81758c]">Use your preferred email address. Gmail and other trusted email providers work.</p>}</div>
      <div className="space-y-1.5"><Label htmlFor="password-input" className="font-quicksand font-bold text-[#43364f]">Password</Label><PasswordInput id="password-input" value={password} onChange={event => onPasswordChange?.(event.target.value)} placeholder="Create a strong password" className="border-[#ded0ef] bg-white/90 text-[#21152d] shadow-[0_2px_8px_rgba(40,20,55,.035)] transition-all duration-200 placeholder:text-[#a49aaa] hover:border-[#c5a9e8] focus-visible:border-[#a879e8] focus-visible:ring-2 focus-visible:ring-[#c4a7ff]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaff]" autoComplete="new-password" disabled={isLoading} required /></div>
      <ul aria-label="Password requirements" className="grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-2xl border border-[#dfd0f3] bg-[linear-gradient(115deg,#f1eaff_0%,#faf5ff_58%,#fff0f3_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.9)]">
        {passwordRules.map((rule) => (
          <li key={rule.label} className={`flex items-center gap-2 text-xs font-bold transition-colors duration-200 sm:text-[13px] ${rule.met ? "text-[#187b62]" : "text-[#82778e]"}`}>
            {rule.met ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Circle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>
      <div className="space-y-1.5"><Label htmlFor="confirm-password-input" className="font-quicksand font-bold text-[#43364f]">Confirm password</Label><PasswordInput id="confirm-password-input" value={confirmPassword} onChange={event => onConfirmPasswordChange?.(event.target.value)} className="border-[#ded0ef] bg-white/90 text-[#21152d] shadow-[0_2px_8px_rgba(40,20,55,.035)] transition-all duration-200 placeholder:text-[#a49aaa] hover:border-[#c5a9e8] focus-visible:border-[#a879e8] focus-visible:ring-2 focus-visible:ring-[#c4a7ff]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaff]" autoComplete="new-password" disabled={isLoading} required />{confirmPassword.length > 0 && <p className={`text-xs font-semibold ${confirmValid ? "text-emerald-700" : "text-[#bd4668]"}`}>{confirmValid ? "Passwords match" : "Passwords do not match yet"}</p>}</div>
      {privacyControl}
      {captchaEnabled && <TurnstileCaptcha onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} onError={() => { setCaptchaToken(null); setErrorKey("captcha_failed"); }} />}
      {currentError && <p id={errorId} role="alert" className="text-sm text-[#bd4668]">{currentError}</p>}
      <Button type="submit" className="font-fredoka h-12 w-full rounded-xl border border-[#b69ae8] bg-gradient-to-r from-[#a78bfa] via-[#c4a7ff] to-[#ff7185] font-bold text-[#1b1025] shadow-[0_8px_24px_rgba(167,139,250,.24)] transition-all hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40" disabled={isLoading || !signupReady}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign up"}</Button>
      <p className="font-quicksand text-center text-xs font-medium text-[#81758c]">We’ll email you a one-time code to verify your address.</p>
    </form>;
  }

  const changeEmail = () => {
    setStage("credentials"); setOtpValue(""); setErrorKey(null); setOTPState("idle"); setOTPFlowContext(null); setCaptchaToken(null);
  };
  const maskedEmail = maskEmail(otpFlowContext?.email ?? email);
  return <form onSubmit={event => { event.preventDefault(); void verifyCode(otpValue); }} className="space-y-6" noValidate>
    <div className="space-y-2 text-center">
      <p className="text-sm text-[#746a80]">Enter the verification code sent to</p>
      <p className="text-sm font-semibold text-[#21152d]">{maskedEmail}</p>
      <p className="text-xs text-[#81758c]">Check your inbox for your {AUTH_OTP_LENGTH}-digit RecallMate code. Paste or type only the newest code if you requested more than one. Resend becomes available after one minute.</p>
      <p className="text-xs font-medium text-[#d8cce8]">The verification email is automated. Please do not reply to it.</p>
      <p className="rounded-xl border border-[#ff7185]/30 bg-[#ff526b]/10 px-3 py-2 text-xs font-medium leading-relaxed text-[#ffd4dc]">
        No code yet? Check your Spam or Junk folder. If you find it there, mark it as not spam so future RecallMate codes reach your inbox.
      </p>
    </div>
    <div className="space-y-3"><OTPInput length={AUTH_OTP_LENGTH} value={otpValue} onChange={value => { setOtpValue(value); if (value.length === AUTH_OTP_LENGTH) void verifyCode(value); }} disabled={isLoading} hasError={Boolean(currentError)} aria-describedby={currentError ? errorId : undefined} />{currentError && <p id={errorId} role="alert" aria-live="assertive" className="text-center text-sm text-[#bd4668]">{currentError}</p>}</div>
    <Button type="submit" className="font-fredoka h-12 w-full rounded-xl border border-[#b69ae8] bg-gradient-to-r from-[#a78bfa] via-[#c4a7ff] to-[#ff7185] font-bold text-[#1b1025] shadow-[0_8px_24px_rgba(167,139,250,.24)] transition-all hover:-translate-y-0.5 hover:brightness-105 disabled:opacity-40" disabled={isLoading || otpValue.length !== AUTH_OTP_LENGTH}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify code & continue"}</Button>
    <div className="flex items-center justify-between text-sm"><ResendButton onResend={handleResend} disabled={isLoading} /><button type="button" onClick={changeEmail} className="rounded text-[#bdb3cc] transition-colors hover:text-[#ff7185]">Change email</button></div>
  </form>;
}
