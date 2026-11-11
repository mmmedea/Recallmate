const allowedAuthenticatedPrefixes = [
  "/dashboard",
  "/upload",
  "/quiz",
  "/documents",
  "/topics",
  "/notes",
  "/calendar",
  "/chat",
  "/settings",
  "/help",
];

export function safeAuthenticatedNextPath(value: string | null, fallback = "/dashboard") {
  if (!value) return fallback;
  let decoded = value.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return fallback;
  }

  if (!decoded.startsWith("/") || decoded.startsWith("//")) return fallback;
  if (decoded.includes("\\") || /[\u0000-\u001f]/.test(decoded)) return fallback;
  if (/^\/(?:auth|login|signup|onboarding)(?:\/|\?|#|$)/i.test(decoded)) return fallback;

  const path = decoded.split(/[?#]/, 1)[0] || "/";
  const allowed = allowedAuthenticatedPrefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

  return allowed ? decoded : fallback;
}
