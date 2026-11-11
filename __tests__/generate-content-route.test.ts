// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requireEntitlement: vi.fn(),
  requireDocumentOwner: vi.fn(),
  checkRateLimit: vi.fn(),
  getOrCreateIdempotentJob: vi.fn(),
  callGeminiRest: vi.fn(),
  callGroqChat: vi.fn(),
  generateQuiz: vi.fn(),
  adminFrom: vi.fn(),
}));

vi.mock("@/lib/security", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security")>();
  return {
    ...actual,
    requireUser: mocks.requireUser,
    requireEntitlement: mocks.requireEntitlement,
    requireDocumentOwner: mocks.requireDocumentOwner,
    checkRateLimit: mocks.checkRateLimit,
    getOrCreateIdempotentJob: mocks.getOrCreateIdempotentJob,
  };
});

vi.mock("@/lib/ai-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai-provider")>();
  return {
    ...actual,
    callGeminiRest: mocks.callGeminiRest,
    callGroqChat: mocks.callGroqChat,
  };
});

vi.mock("@/lib/quiz/generator", () => ({
  generateQuiz: mocks.generateQuiz,
  QUIZ_GENERATION_RETRY_MESSAGE: "We couldn't generate a good quiz right now. Please try again in a moment.",
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ from: mocks.adminFrom }),
}));

import * as generateContentRoute from "@/app/api/generate-content/route";

const SOURCE = `
Colorimetry is the measurement of color intensity used to estimate the concentration of a substance.
Spectrophotometry is the measurement of how much light a sample absorbs at selected wavelengths.
Calibration is the process of comparing instrument response with a known reference standard.
Quality control is the process used to verify that analytical results remain reliable over time.
`;

function request(overrides: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost/api/generate-content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: SOURCE,
      fileName: "Instrumentation.pdf",
      count: 5,
      difficulty: "easy",
      ...overrides,
    }),
  });
}

describe("generate-content provider failures", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "configured-test-key");
    vi.stubEnv("GEMINI_API_KEY_02", "");
    vi.stubEnv("GROQ_API_KEY", "");

    mocks.requireUser.mockResolvedValue({
      supabase: {},
      user: { id: "11111111-1111-4111-8111-111111111111" },
    });
    mocks.requireEntitlement.mockResolvedValue({ isPremium: false });
    mocks.requireDocumentOwner.mockResolvedValue(undefined);
    mocks.checkRateLimit.mockResolvedValue(undefined);
    mocks.callGeminiRest.mockRejectedValue(
      new Error("This model is currently experiencing high demand."),
    );
    mocks.callGroqChat.mockRejectedValue(
      new Error("GROQ_API_KEY is not configured."),
    );
    mocks.generateQuiz.mockRejectedValue(new Error("All providers failed."));
    mocks.adminFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns a retryable error instead of returning local template questions when providers fail", async () => {
    const response = await generateContentRoute.POST(request());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "We couldn't generate a good quiz right now. Please try again in a moment.",
    });
    expect(body.questions).toBeUndefined();
  });

  it("forwards the selected count, mixed difficulty, and format to the shared quiz generator", async () => {
    mocks.generateQuiz.mockResolvedValue({
      summary: "Generated quiz.",
      questions: [],
      protectedAnswers: [],
      difficulty: "mixed",
      format: "identification",
      requestedCount: 5,
      report: { acceptedCount: 5, rejectedCount: 0, attempts: 1 },
    });

    const response = await generateContentRoute.POST(request({
      documentId: "22222222-2222-4222-8222-222222222222",
      count: 5,
      difficulty: "mixed",
      format: "identification",
    }));

    expect(response.status).toBe(200);
    expect(mocks.generateQuiz).toHaveBeenCalledWith(expect.objectContaining({
      fileName: "Instrumentation.pdf",
      count: 5,
      difficulty: "mixed",
      format: "identification",
      sourceText: expect.stringContaining("Calibration"),
    }));
  });

  it("samples long source text from the beginning, middle, and end", async () => {
    mocks.generateQuiz.mockResolvedValue({
      summary: "Generated quiz.",
      questions: [],
      protectedAnswers: [],
      difficulty: "easy",
      format: "multiple_choice",
      requestedCount: 5,
      report: { acceptedCount: 5, rejectedCount: 0, attempts: 1 },
    });
    const repeatedSource = "Calibration compares instrument response with a known reference standard. ".repeat(1000);
    const longText = `BEGINNING_MARKER ${repeatedSource} MIDDLE_MARKER ${repeatedSource} END_MARKER`;

    const response = await generateContentRoute.POST(request({ text: longText }));

    expect(response.status).toBe(200);
    const [generationInput] = mocks.generateQuiz.mock.calls[0];
    expect(generationInput.sourceText).toContain("BEGINNING_MARKER");
    expect(generationInput.sourceText).toContain("MIDDLE_MARKER");
    expect(generationInput.sourceText).toContain("END_MARKER");
    expect(generationInput.sourceText.length).toBeLessThanOrEqual(12_000);
  });

  it("stores identification keys server-side and returns only the opaque answer id", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    mocks.adminFrom.mockReturnValue({ insert });
    mocks.generateQuiz.mockResolvedValue({
      summary: "Generated quiz.",
      questions: [{
        id: "question-id",
        type: "identification",
        difficulty: "easy",
        question: "What does calibration compare?",
        answerId: "opaque-answer-id",
      }],
      protectedAnswers: [{
        id: "opaque-answer-id",
        answer: "instrument response",
        acceptedAnswers: ["instrument response"],
        explanation: "The source defines calibration this way.",
        sourceEvidence: "Calibration compares instrument response with a known reference standard",
      }],
      difficulty: "easy",
      format: "identification",
      requestedCount: 1,
      report: { acceptedCount: 1, rejectedCount: 0, attempts: 1 },
    });

    const response = await generateContentRoute.POST(request({
      documentId: "22222222-2222-4222-8222-222222222222",
      count: 1,
      format: "identification",
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.questions[0]).toEqual(expect.objectContaining({ answerId: "opaque-answer-id" }));
    expect(JSON.stringify(body)).not.toContain("instrument response");
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({
      id: "opaque-answer-id",
      user_id: "11111111-1111-4111-8111-111111111111",
      document_id: "22222222-2222-4222-8222-222222222222",
      answer_text: "instrument response",
    })]);
  });

  it("rejects identification format without a saved document before generation", async () => {
    const response = await generateContentRoute.POST(request({ format: "identification" }));
    expect(response.status).toBe(400);
    expect(mocks.generateQuiz).not.toHaveBeenCalled();
  });
});
