// ============================================================
// AUTH TYPES — Phase 6.3
// Raw Supabase User objects stay inside the auth boundary.
// These canonical types are used throughout the application.
// ============================================================

// Canonical user type exposed to UI and shell components
export type AuthenticatedUser = {
  id: string;
  email: string | null;
};

// Bootstrap data loaded once after authentication.
// Scope is intentionally narrow: identity + credits + entitlements only.
// Documents, notes, quiz data belong to the features that own them.
export type AppBootstrap = {
  user: AuthenticatedUser;
  entitlements: {
    premium: boolean;
    canChat: boolean;
    canGenerateNotes: boolean;
    canGenerateQuiz: boolean;
  };
  credits: {
    available: number;
  };
};

// ============================================================
// OTP UI STATE — client UI state only (Zustand)
// OTP validity, expiry, and verification remain exclusively
// controlled by Supabase Auth. This state machine tracks
// the client interaction surface only.
// ============================================================

export type OTPState =
  | "idle"
  | "sending"
  | "sent"
  | "verifying"
  | "verified"
  | "expired"
  | "invalid"
  | "rate_limited"
  | "captcha_required"
  | "error";

// otpFlowId is UI correlation, not OTP security.
// It is regenerated on every new send/resend to prevent stale UI
// state (countdowns, expiry feedback) from bleeding into newer requests.
// OTP security is exclusively owned by Supabase Auth.
export type OTPFlowContext = {
  otpFlowId: string;     // uuid — new per send/resend
  email: string;         // stored in Zustand only — never placed in URL
  intent: "signin" | "signup";
  createdAt: number;
};

// OTP intent controls copy/UI only — never auth logic or authorization
export type OTPIntent = "signin" | "signup";
