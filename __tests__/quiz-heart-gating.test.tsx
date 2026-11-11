// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const routerMock = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/components/QuizCard", () => ({
  default: () => <div>Quiz question ready</div>,
}));

vi.mock("@/components/PremiumModal", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div role="dialog">Premium modal</div> : null),
}));

import QuizPage from "@/app/(app)/quiz/page";

const quizContent = {
  fileName: "Lesson 3",
  summary: "Quiz summary",
  difficulty: "hard",
  questions: [{ question: "Q1", answer: "A1" }],
};

function mockWallet(hearts: number, premium = false) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        premium,
        economy: {
          coins: 1000,
          hearts,
          heartCap: 15,
          state: "ok",
        },
      }),
    }),
  );
}

describe("quiz heart gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    window.sessionStorage.setItem("recallmate-content", JSON.stringify(quizContent));
  });

  it("allows quiz access when server hearts overflow the normal cap", async () => {
    mockWallet(18, false);

    render(<QuizPage />);

    await waitFor(() => expect(screen.getByText("Quiz question ready")).toBeTruthy());
    expect(screen.queryByText(/you're out of hearts/i)).toBeNull();
  });

  it("blocks non-premium quiz access only at zero server hearts", async () => {
    mockWallet(0, false);

    render(<QuizPage />);

    await waitFor(() => expect(screen.getByText(/you're out of hearts/i)).toBeTruthy());
    expect(screen.getByRole("button", { name: /❤️ \+5 hearts · 200 coins/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /refill to 15 · 500 coins/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /go premium/i })).toBeTruthy();
  });

  it("allows premium quiz access even with zero hearts", async () => {
    mockWallet(0, true);

    render(<QuizPage />);

    await waitFor(() => expect(screen.getByText("Quiz question ready")).toBeTruthy());
    expect(screen.queryByText(/you're out of hearts/i)).toBeNull();
  });

  it("shows a completion state when unique useful questions are exhausted", async () => {
    mockWallet(18, false);
    window.sessionStorage.setItem(
      "recallmate-content",
      JSON.stringify({
        ...quizContent,
        questions: [],
        quizEngine: { exhausted: true },
        notice: "No safe non-repeating questions remain.",
      }),
    );

    render(<QuizPage />);

    await waitFor(() => expect(screen.getByText(/all unique useful questions are exhausted/i)).toBeTruthy());
    expect(screen.getByText(/No safe non-repeating questions remain/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /generate deeper applications/i })).toBeTruthy();
  });
});
