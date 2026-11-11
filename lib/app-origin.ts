export const RECALLMATE_PRODUCTION_ORIGIN = "https://recallmate-ai.vercel.app";
export const RECALLMATE_PRODUCTION_HOST = new URL(RECALLMATE_PRODUCTION_ORIGIN).hostname;
export const RECALLMATE_LEGACY_HOSTS = new Set(["recallmate.vercel.app"]);

function normalizeOrigin(value?: string | null) {
  if (!value) return "";
  try {
    const url = value.startsWith("http") ? new URL(value) : new URL(`https://${value}`);
    if (RECALLMATE_LEGACY_HOSTS.has(url.hostname.toLowerCase())) {
      return RECALLMATE_PRODUCTION_ORIGIN;
    }
    return url.origin;
  } catch {
    return "";
  }
}

function isLocalOrigin(origin: string) {
  return /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin);
}

export function getConfiguredAppOrigin() {
  return (
    normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL) ||
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    normalizeOrigin(process.env.APP_URL) ||
    normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    normalizeOrigin(process.env.VERCEL_URL)
  );
}

export function getServerAppOrigin(requestOrigin?: string | null) {
  const configured = getConfiguredAppOrigin();
  const request = normalizeOrigin(requestOrigin);

  if (configured && !isLocalOrigin(configured)) return configured;
  if (request && !isLocalOrigin(request)) return request;
  if (process.env.NODE_ENV === "production") return RECALLMATE_PRODUCTION_ORIGIN;
  return request || configured || RECALLMATE_PRODUCTION_ORIGIN;
}

export function getBrowserAppOrigin(locationOrigin?: string) {
  const configured = getConfiguredAppOrigin();
  const current = normalizeOrigin(locationOrigin || (typeof window !== "undefined" ? window.location.origin : ""));

  if (configured && !isLocalOrigin(configured)) return configured;
  if (current && !isLocalOrigin(current)) return current;
  if (process.env.NODE_ENV === "production") return RECALLMATE_PRODUCTION_ORIGIN;
  return current || configured || RECALLMATE_PRODUCTION_ORIGIN;
}

export function getCanonicalProductionRedirectUrl(input: URL | string) {
  const url = typeof input === "string" ? new URL(input) : input;
  const host = url.hostname.toLowerCase();

  if (!RECALLMATE_LEGACY_HOSTS.has(host)) return null;

  const canonical = new URL(url.pathname + url.search, RECALLMATE_PRODUCTION_ORIGIN);
  return canonical;
}
