type GoogleOAuthPurpose = "sign-in" | "calendar-sync";

type GoogleOAuthVerificationOptions = {
  purpose?: GoogleOAuthPurpose;
  requiredScopes?: readonly string[];
  allowedCalendarScopes?: readonly string[];
  featureLabel?: string;
};

const calendarScopePrefix = "https://www.googleapis.com/auth/calendar";
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

function toUrl(value: string, base?: string) {
  try {
    return new URL(value, base);
  } catch {
    return null;
  }
}

function isLocalhostUrl(url: URL) {
  return localHosts.has(url.hostname.toLowerCase());
}

function collectOAuthScopes(url: URL) {
  const scopes = new Set<string>();
  for (const key of ["scope", "scopes"]) {
    for (const value of url.searchParams.getAll(key)) {
      value
        .split(/\s+/)
        .map((scope) => scope.trim())
        .filter(Boolean)
        .forEach((scope) => scopes.add(scope));
    }
  }
  return scopes;
}

function assertNoLocalhostRedirects(url: URL, featureLabel: string) {
  if (isLocalhostUrl(url)) {
    throw new Error(`${featureLabel} is misconfigured: OAuth is redirecting to localhost instead of the production RecallMate site.`);
  }

  for (const key of ["redirect_to", "redirectTo", "redirect_uri", "return_to", "returnTo"]) {
    for (const value of url.searchParams.getAll(key)) {
      const nested = toUrl(value);
      if (nested && isLocalhostUrl(nested)) {
        throw new Error(`${featureLabel} is misconfigured: OAuth is redirecting to localhost instead of the production RecallMate site.`);
      }
    }
  }
}

function assertScopePolicy(url: URL, options: GoogleOAuthVerificationOptions) {
  const purpose = options.purpose ?? "calendar-sync";
  const featureLabel = options.featureLabel ?? (purpose === "sign-in" ? "Google sign-in" : "Google Calendar");
  const scopes = collectOAuthScopes(url);
  const calendarScopes = [...scopes].filter((scope) => scope.startsWith(calendarScopePrefix));

  if (purpose === "sign-in" && calendarScopes.length > 0) {
    throw new Error("Google sign-in is misconfigured: it must request only profile scopes. Calendar permission belongs in Google Calendar sync.");
  }

  if (purpose === "calendar-sync") {
    const allowedCalendarScopes = new Set(options.allowedCalendarScopes ?? options.requiredScopes ?? []);
    const disallowed = calendarScopes.filter((scope) => !allowedCalendarScopes.has(scope));
    if (disallowed.length > 0) {
      throw new Error(`${featureLabel} is misconfigured: it is requesting broader Calendar access than RecallMate needs.`);
    }

    const requiredScopes = options.requiredScopes ?? [];
    const missing = requiredScopes.filter((scope) => !scopes.has(scope));
    if (missing.length > 0) {
      throw new Error(`${featureLabel} is misconfigured: the OAuth request is missing the required Calendar permission.`);
    }
  }
}

export function assertGoogleOAuthUrlIsSafe(oauthUrl: string, options: GoogleOAuthVerificationOptions = {}) {
  const url = toUrl(oauthUrl);
  const featureLabel = options.featureLabel ?? (options.purpose === "sign-in" ? "Google sign-in" : "Google Calendar");
  if (!url) throw new Error(`${featureLabel} could not start because the OAuth URL is invalid.`);
  assertNoLocalhostRedirects(url, featureLabel);
  assertScopePolicy(url, options);
}

export async function verifyGoogleOAuthProvider(
  oauthUrl: string,
  fetchImpl: typeof fetch = fetch,
  options: GoogleOAuthVerificationOptions = {},
) {
  const featureLabel = options.featureLabel ?? (options.purpose === "sign-in" ? "Google sign-in" : "Google Calendar");
  assertGoogleOAuthUrlIsSafe(oauthUrl, options);

  const response = await fetchImpl(oauthUrl, { redirect: "manual", headers: { Accept: "application/json" } });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) throw new Error(`${featureLabel} could not start because Google did not return a redirect URL.`);
    const redirectedUrl = toUrl(location, oauthUrl);
    if (!redirectedUrl) throw new Error(`${featureLabel} could not start because Google returned an invalid redirect URL.`);
    assertNoLocalhostRedirects(redirectedUrl, featureLabel);
    assertScopePolicy(redirectedUrl, options);
    return;
  }

  let providerMessage = "";
  try {
    const payload = await response.json() as { msg?: string; error_description?: string };
    providerMessage = payload.msg || payload.error_description || "";
  } catch {
    providerMessage = await response.text().catch(() => "");
  }

  if (/provider.*not enabled|unsupported provider/i.test(providerMessage)) {
    throw new Error(`${featureLabel} is not configured yet. RecallMate needs its Google OAuth client enabled before this can work.`);
  }
  throw new Error(`${featureLabel} could not start the connection. Please try again.`);
}
