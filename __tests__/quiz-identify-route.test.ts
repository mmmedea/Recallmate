// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  checkRateLimit: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  result: vi.fn(),
  eq: vi.fn(),
  eqSecond: vi.fn(),
  gt: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/security", () => ({
  requireUser: mocks.requireUser,
  checkRateLimit: mocks.checkRateLimit,
  SecurityError: class SecurityError extends Error { status = 401; },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

import * as identifyRoute from "@/app/api/quiz/identify/route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ANSWER_ID = "22222222-2222-4222-8222-222222222222";

function request(body: unknown) {
  return new NextRequest("http://localhost/api/quiz/identify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("identification answer endpoint", () => {
  beforeEach(() => {
    mocks.requireUser.mockResolvedValue({ user: { id: USER_ID } });
    mocks.checkRateLimit.mockResolvedValue(true);
    mocks.result.mockResolvedValue({
      data: {
        answer_text: "instrument response",
        accepted_answers: ["instrument response"],
        explanation: "Calibration compares response with a known standard.",
        source_evidence: "Calibration compares instrument response with a known reference standard",
      },
      error: null,
    });
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ eq: mocks.eqSecond, gt: mocks.gt });
    mocks.eqSecond.mockReturnValue({ gt: mocks.gt });
    mocks.gt.mockReturnValue({ maybeSingle: mocks.result });
    mocks.createSupabaseAdminClient.mockReturnValue({ from: mocks.from });
  });

  afterEach(() => vi.clearAllMocks());

  it("grades using the authenticated user's private answer key and reveals feedback only after submission", async () => {
    const response = await identifyRoute.POST(request({ answerId: ANSWER_ID, answer: "Instrument response." }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body).toEqual({
      correct: true,
      answer: "instrument response",
      explanation: "Calibration compares response with a known standard.",
      sourceEvidence: "Calibration compares instrument response with a known reference standard",
    });
    expect(mocks.from).toHaveBeenCalledWith("quiz_identification_answer_keys");
    expect(mocks.eq).toHaveBeenCalledWith("id", ANSWER_ID);
    expect(mocks.eqSecond).toHaveBeenCalledWith("user_id", USER_ID);
  });

  it("does not disclose whether another user's answer id exists", async () => {
    mocks.result.mockResolvedValue({ data: null, error: null });
    const response = await identifyRoute.POST(request({ answerId: ANSWER_ID, answer: "guess" }));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "This quiz answer is unavailable. Generate a new quiz to continue." });
  });

  it("rejects client-supplied answer-key fields", async () => {
    const response = await identifyRoute.POST(request({ answerId: ANSWER_ID, answer: "guess", correctAnswer: "secret" }));

    expect(response.status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
