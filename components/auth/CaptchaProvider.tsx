"use client";

import { useEffect, useRef, useCallback } from "react";

// CaptchaProvider abstraction — EmailOTPForm knows only that it needs a token.
// The concrete provider (Turnstile, hCaptcha) is swappable without touching auth forms.
export interface CaptchaHandle {
  reset: () => void;
}

export interface CaptchaProviderProps {
  onVerify: (token: string) => void;
  onExpire: () => void;
  onError: () => void;
}

// ------------------------------------------------------------------
// TurnstileCaptcha — concrete implementation
// Only rendered when AUTH_CAPTCHA_UI_ENABLED=true.
// Requires NEXT_PUBLIC_TURNSTILE_SITE_KEY to be set.
// ------------------------------------------------------------------
export function TurnstileCaptcha({
  onVerify,
  onExpire,
  onError,
}: CaptchaProviderProps) {
  const enabled = process.env.NEXT_PUBLIC_AUTH_CAPTCHA_UI_ENABLED === "true";
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  if (!enabled || !siteKey) return null;

  // Dynamically import to avoid SSR issues
  return (
    <TurnstileWidget
      siteKey={siteKey}
      onVerify={onVerify}
      onExpire={onExpire}
      onError={onError}
    />
  );
}

function TurnstileWidget({
  siteKey,
  onVerify,
  onExpire,
  onError,
}: {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire: () => void;
  onError: () => void;
}) {
  // Lazy load react-turnstile to keep it out of the main bundle when disabled
  const Turnstile = require("react-turnstile").default;

  return (
    <div className="flex justify-center">
      <Turnstile
        sitekey={siteKey}
        onVerify={onVerify}
        onExpire={onExpire}
        onError={onError}
        theme="auto"
        size="normal"
      />
    </div>
  );
}
