type AuthEventName =
  | "oauth_started"
  | "oauth_start_failed"
  | "callback_received"
  | "code_exchange_succeeded"
  | "code_exchange_failed"
  | "session_user_resolved"
  | "calendar_sync_started"
  | "calendar_sync_succeeded"
  | "calendar_sync_failed";

type AuthEventFields = Record<string, string | number | boolean | null | undefined>;

const blockedFieldPattern = /(^|_)(?:token|secret|code|verifier)$|authorizationcode|authcode|provider_token|access_token|refresh_token/i;
export const AUTH_FLOW_COOKIE = "recallmate_auth_flow";

export function createAuthFlowId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function logAuthEvent(event: AuthEventName, fields: AuthEventFields = {}) {
  const safeFields = Object.fromEntries(
    Object.entries(fields)
      .filter(([key]) => !blockedFieldPattern.test(key))
      .map(([key, value]) => [key, value ?? null]),
  );

  console.info("[AUTH_EVENT]", {
    event,
    ...safeFields,
  });
}
