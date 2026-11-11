import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: authMocks,
    from: authMocks.from,
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/integrations/google-calendar", () => ({
  syncEventsToGoogle: vi.fn(),
}));

import { GET } from "@/app/auth/callback/route";
import { syncEventsToGoogle } from "@/lib/integrations/google-calendar";

describe("OAuth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://recallmate-ai.vercel.app");
  });

  it("redirects missing OAuth codes to login with a visible error", async () => {
    const response = await GET(new Request("https://recallmate-ai.vercel.app/auth/callback"));

    expect(response.headers.get("location")).toBe(
      "https://recallmate-ai.vercel.app/login?error=missing_oauth_code"
    );
    expect(authMocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("redirects failed OAuth exchanges to login with a visible error", async () => {
    authMocks.exchangeCodeForSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: "invalid request: both auth code and code verifier should be non-empty" },
    });

    const response = await GET(
      new Request("https://recallmate-ai.vercel.app/auth/callback?code=bad-code")
    );

    expect(authMocks.exchangeCodeForSession).toHaveBeenCalledWith("bad-code");
    expect(response.headers.get("location")).toBe(
      "https://recallmate-ai.vercel.app/login?error=google_auth_failed"
    );
  });

  it("sends completed Google sign-in sessions to a validated internal next path", async () => {
    authMocks.exchangeCodeForSession.mockResolvedValueOnce({
      data: { session: { provider_token: "google-token" } },
      error: null,
    });
    authMocks.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "user-1",
          user_metadata: {
            username: "student",
            recallmate_account_completed: true,
          },
        },
      },
    });

    const response = await GET(
      new Request("https://recallmate-ai.vercel.app/auth/callback?code=good-code&next=%2Fquiz")
    );

    expect(response.headers.get("location")).toBe("https://recallmate-ai.vercel.app/quiz");
  });

  it("falls back to dashboard for unsafe OAuth next paths", async () => {
    authMocks.exchangeCodeForSession.mockResolvedValueOnce({
      data: { session: { provider_token: "google-token" } },
      error: null,
    });
    authMocks.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "user-1",
          user_metadata: {
            username: "student",
            recallmate_account_completed: true,
          },
        },
      },
    });

    const response = await GET(
      new Request("https://recallmate-ai.vercel.app/auth/callback?code=good-code&next=https%3A%2F%2Fevil.example")
    );

    expect(response.headers.get("location")).toBe("https://recallmate-ai.vercel.app/dashboard");
  });

  it("syncs Calendar with the authenticated user session instead of a service-role client", async () => {
    authMocks.exchangeCodeForSession.mockResolvedValueOnce({
      data: { session: { provider_token: "google-token" } },
      error: null,
    });
    authMocks.getUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "user-1",
          user_metadata: {
            username: "student",
            recallmate_account_completed: true,
          },
        },
      },
    });

    const order = vi.fn().mockResolvedValueOnce({
      data: [
        {
          id: "event-1",
          title: "Review",
          description: null,
          starts_at: "2026-09-10T12:00:00.000Z",
          ends_at: null,
          all_day: true,
          event_type: "review",
          priority: "normal",
          google_calendar_id: null,
          google_event_id: null,
        },
      ],
      error: null,
    });
    const selectEq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq: selectEq }));
    const updateEqUser = vi.fn().mockResolvedValueOnce({ error: null });
    const updateEqId = vi.fn(() => ({ eq: updateEqUser }));
    const update = vi.fn(() => ({ eq: updateEqId }));
    authMocks.from
      .mockReturnValueOnce({ select })
      .mockReturnValueOnce({ update });

    vi.mocked(syncEventsToGoogle).mockResolvedValueOnce({
      synced: 1,
      mappings: [{ recallmateEventId: "event-1", googleCalendarId: "calendar-1", googleEventId: "google-1" }],
    });

    const response = await GET(
      new Request("https://recallmate-ai.vercel.app/auth/callback?code=good-code&integration=google-calendar&next=%2Fcalendar")
    );

    expect(authMocks.from).toHaveBeenCalledWith("calendar_events");
    expect(selectEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(updateEqId).toHaveBeenCalledWith("id", "event-1");
    expect(updateEqUser).toHaveBeenCalledWith("user_id", "user-1");
    expect(syncEventsToGoogle).toHaveBeenCalledWith({
      accessToken: "google-token",
      events: expect.arrayContaining([expect.objectContaining({ id: "event-1" })]),
    });
    expect(response.headers.get("location")).toBe(
      "https://recallmate-ai.vercel.app/calendar?google=connected&synced=1"
    );
  });
});
