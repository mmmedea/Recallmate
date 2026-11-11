import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(() => ({ rpc: mocks.rpc })),
  isSupabaseAdminConfigured: vi.fn(() => true),
}));

import { POST } from "@/app/api/auth/check-availability/route";

describe("signup availability route privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mocks.rpc.mockResolvedValue({
      data: { email_exists: true, username_exists: false },
      error: null,
    });
  });

  it("never returns whether an email address already has an account", async () => {
    const request = new NextRequest("http://localhost/api/auth/check-availability", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "198.51.100.241",
      },
      body: JSON.stringify({ email: "person@example.com", username: "student_18" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ usernameExists: false });
    expect(mocks.rpc).toHaveBeenCalledWith("check_signup_availability", {
      p_email: "person@example.com",
      p_username: "student_18",
      p_exclude_user_id: null,
    });
  });
});
