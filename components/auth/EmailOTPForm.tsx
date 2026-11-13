"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
}

type FormStage = "credentials" | "otp";

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
  error: "Something went wrong. Please try again.",
};

function safeInternalPath(path: string) {
  return path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard";
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
}: EmailOTPFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { setOTPState, setOTPFlowContext, otpFlowContext, otpState } = useOTPStore();
  const [stage, setStage] = useState<FormStage>("credentials");
  const [email, setEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
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
        const key = message.includes("invalid login credentials") || message.includes("user not found")
          ? "invalid_credentials"
          : message.includes("email not confirmed")
            ? "email_unconfirmed"
            : message.includes("rate")
              ? "rate_limited"
              : "service_unavailable";
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
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[^A-Za-z0-9]/.test(password)) return setErrorKey("weak_password");
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
      const availability = await availabilityResponse.json() as { emailExists?: boolean; usernameExists?: boolean; error?: string };
      if (!availabilityResponse.ok) {
        setErrorKey(availabilityResponse.status === 429 ? "rate_limited" : "service_unavailable");
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
        const key = message.includes("already") || message.includes("registered") || message.includes("exists")
          ? "account_exists"
          : message.includes("invalid") && message.includes("email")
            ? "email_invalid"
            : message.includes("rate")
              ? "rate_limited"
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

  const currentError = errorKey ? AUTH_ERRORS[errorKey] : null;
  const passwordRules = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter", met: /[a-z]/.test(password) },
    { label: "One special symbol", met: /[^A-Za-z0-9]/.test(password) },
  ];
  const passwordValid = passwordRules.every((rule) => rule.met);
  const usernameValid = /^[A-Za-z0-9_]{3,30}$/.test(username.trim());
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const confirmValid = password.length > 0 && password === confirmPassword;
  const signupReady = usernameValid && emailValid && passwordValid && confirmValid && privacyAgreed && (!captchaEnabled || Boolean(captchaToken));

  if (intent === "signin") {
    return <form onSubmit={handlePasswordSignIn} className="space-y-4" noValidate>
      <div className="space-y-1.5"><Label htmlFor="signin-email" className="font-quicksand font-bold text-[#43364f]">Email</Label><Input id="signin-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@email.com" className="border-[#ddd4e7] bg-white text-[#21152d] placeholder:text-[#a49aaa] focus-visible:ring-[#a78bfa] focus-visible:ring-offset-white" autoComplete="email" autoFocus disabled={isLoading} required /></div>
      <div className="space-y-1.5"><Label htmlFor="signin-password" className="font-quicksand font-bold text-[#43364f]">Password</Label><PasswordInput id="signin-password" value={signInPassword} onChange={event => setSignInPassword(event.target.value)} placeholder="Your RecallMate password" className="border-[#ddd4e7] bg-white text-[#21152d] placeholder:text-[#a49aaa] focus-visible:ring-[#a78bfa] focus-visible:ring-offset-white" autoComplete="current-password" disabled={isLoading} required /></div>
      {currentError && <p id={errorId} role="alert" className="text-sm text-[#ff8293]">{currentError}</p>}
      <Button type="submit" className="font-fredoka h-12 w-full rounded-xl border border-[#b69ae8] bg-gradient-to-r from-[#a78bfa] via-[#c4a7ff] to-[#ff7185] font-bold text-[#1b1025] shadow-[0_8px_24px_rgba(167,139,250,.24)] transition-all hover:-translate-y-0.5 hover:brightness-105" disabled={isLoading || !email.trim() || !signInPassword}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LockKeyhole className="h-4 w-4" />Sign in</>}</Button>
    </form>;
  }

  if (stage === "credentials") {
    return <form onSubmit={handleSendOTP} className="space-y-4" noValidate>
      <div className="space-y-1.5"><Label htmlFor="username-input" className="font-quicksand font-bold text-[#43364f]">Username</Label><Input id="username-input" value={username} onChange={event => onUsernameChange?.(event.target.value)} placeholder="e.g., your_username" className="border-[#ddd4e7] bg-white text-[#21152d] placeholder:text-[#a49aaa] focus-visible:ring-[#a78bfa] focus-visible:ring-offset-white" autoComplete="username" disabled={isLoading} required /></div>
      <div className="space-y-1.5"><Label htmlFor="signup-email" className="font-quicksand font-bold text-[#43364f]">Email</Label><Input id="signup-email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@email.com" className="border-[#ddd4e7] bg-white text-[#21152d] placeholder:text-[#a49aaa] focus-visible:ring-[#a78bfa] focus-visible:ring-offset-white" autoComplete="email" disabled={isLoading} required /><p className="text-xs text-[#81758c]">Gmail and other valid email addresses are supported.</p></div>
      <div className="space-y-1.5"><Label htmlFor="password-input" className="font-quicksand font-bold text-[#43364f]">Password</Label><PasswordInput id="password-input" value={password} onChange={event => onPasswordChange?.(event.target.value)} placeholder="Create a strong password" className="border-[#ddd4e7] bg-white text-[#21152d] placeholder:text-[#a49aaa] focus-visible:ring-[#a78bfa] focus-visible:ring-offset-white" autoComplete="new-password" disabled={isLoading} required /></div>
      <ul aria-label="Password requirements" className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-[#e7def0] bg-[#f5f0fa] p-3">
        {passwordRules.map((rule) => (
          <li key={rule.label} className={`flex items-center gap-2 text-xs font-semibold transition-colors ${rule.met ? "text-emerald-700" : "text-[#8a8292]"}`}>
            {rule.met ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Circle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>
      <div className="space-y-1.5"><Label htmlFor="confirm-password-input" className="font-quicksand font-bold text-[#43364f]">Confirm password</Label><PasswordInput id="confirm-password-input" value={confirmPassword} onChange={event => onConfirmPasswordChange?.(event.target.value)} className="border-[#ddd4e7] bg-white text-[#21152d] placeholder:text-[#a49aaa] focus-visible:ring-[#a78bfa] focus-visible:ring-offset-white" autoComplete="new-password" disabled={isLoading} required />{confirmPassword.length > 0 && <p className={`text-xs font-semibold ${confirmValid ? "text-emerald-700" : "text-[#bd4668]"}`}>{confirmValid ? "Passwords match" : "Passwords do not match yet"}</p>}</div>
      {privacyControl}
      {captchaEnabled && <TurnstileCaptcha onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} onError={() => { setCaptchaToken(null); setErrorKey("captcha_failed"); }} />}
      {currentError && <p id={errorId} role="alert" className="text-sm text-[#bd4668]">{currentError}</p>}
      <Button type="submit" className="font-fredoka h-12 w-full rounded-xl border border-[#b69ae8] bg-gradient-to-r from-[#a78bfa] via-[#c4a7ff] to-[#ff7185] font-bold text-[#1b1025] shadow-[0_8px_24px_rgba(167,139,250,.24)] transition-all hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40" disabled={isLoading || !signupReady}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign up"}</Button>
      <p className="text-center text-xs text-[#81758c]">We’ll email you a one-time code to verify your address.</p>
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
    <div className="space-y-3"><OTPInput length={AUTH_OTP_LENGTH} value={otpValue} onChange={value => { setOtpValue(value); if (value.length === AUTH_OTP_LENGTH) void verifyCode(value); }} disabled={isLoading} hasError={Boolean(currentError)} aria-describedby={currentError ? errorId : undefined} />{currentError && <p id={errorId} role="alert" aria-live="assertive" className="text-center text-sm text-rose-600 dark:text-rose-400">{currentError}</p>}</div>
    <Button type="submit" className="h-11 w-full bg-indigo-600 font-semibold hover:bg-indigo-700" disabled={isLoading || otpValue.length !== AUTH_OTP_LENGTH}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify code & continue"}</Button>
    <div className="flex items-center justify-between text-sm"><ResendButton onResend={handleResend} disabled={isLoading} /><button type="button" onClick={changeEmail} className="rounded text-[#bdb3cc] transition-colors hover:text-[#ff7185]">Change email</button></div>
  </form>;
}
