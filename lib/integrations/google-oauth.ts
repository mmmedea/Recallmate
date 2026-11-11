export async function verifyGoogleOAuthProvider(oauthUrl: string, fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl(oauthUrl, { redirect: "manual", headers: { Accept: "application/json" } });
  if (response.status >= 300 && response.status < 400) return;

  let providerMessage = "";
  try {
    const payload = await response.json() as { msg?: string; error_description?: string };
    providerMessage = payload.msg || payload.error_description || "";
  } catch {
    providerMessage = await response.text().catch(() => "");
  }

  if (/provider.*not enabled|unsupported provider/i.test(providerMessage)) {
    throw new Error("Google Calendar is not configured yet. RecallMate needs its Google OAuth client enabled before accounts can sync.");
  }
  throw new Error("Google Calendar could not start the connection. Please try again.");
}
