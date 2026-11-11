export type OAuthProviderId = "google" | "github" | "facebook";

const configuredOtpLength = Number(process.env.NEXT_PUBLIC_AUTH_OTP_LENGTH ?? "8");

// Supabase supports email OTP lengths from 6 to 10 digits. This project sends
// eight-digit codes; keep the value configurable so the UI and Auth setting can
// remain aligned if that changes later.
export const AUTH_OTP_LENGTH = Number.isInteger(configuredOtpLength) && configuredOtpLength >= 6 && configuredOtpLength <= 10
  ? configuredOtpLength
  : 8;

export type OAuthProviderConfig = {
  id: OAuthProviderId;
  label: string;
  enabled: boolean;
  icon: string; // We'll handle SVG inside the component based on ID, or we can use strings if we map them
};

export const OAUTH_PROVIDERS: OAuthProviderConfig[] = [
  {
    id: "google",
    label: "Continue with Google",
    enabled: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED !== "false", // default to true unless explicitly disabled
    icon: "google",
  },
  {
    id: "github",
    label: "Continue with GitHub",
    enabled: process.env.NEXT_PUBLIC_AUTH_GITHUB_ENABLED === "true",
    icon: "github",
  },
  {
    id: "facebook",
    label: "Continue with Facebook",
    enabled: process.env.NEXT_PUBLIC_AUTH_FACEBOOK_ENABLED === "true",
    icon: "facebook",
  },
  
];


