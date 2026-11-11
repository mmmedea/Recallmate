export type OAuthProviderId = "google" | "github" | "facebook";

// RecallMate deliberately uses one fixed OTP format. Keeping this constant
// prevents a stale deployment environment variable from rendering a different
// number of boxes than Supabase accepts.
export const AUTH_OTP_LENGTH = 6 as const;

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


