// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import QuizCard from "@/components/QuizCard";

const item = {
  id: "question-1",
  type: "identification",
  difficulty: "easy",
  question: "What does calibration compare in analytical testing?",
  answerId: "opaque-answer-id",
};

describe("identification quiz card", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("submits the typed answer to the checker and reveals feedback only after the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      correct: true,
      answer: "instrument response",
      explanation: "Calibration compares it with a reference.",
      sourceEvidence: "Calibration compares instrument response with a known reference standard",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<QuizCard item={item} difficulty="easy" onResult={vi.fn()} />);

    expect(screen.queryByText("instrument response")).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: /your answer/i }), { target: { value: "Instrument response." } });
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));

    expect(await screen.findByText("Correct!")).toBeDefined();
    expect(await screen.findByText(/answer:\s*instrument response/i)).toBeDefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/quiz/identify", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ answerId: "opaque-answer-id", answer: "Instrument response." }),
    }));
  });

  it("allows the learner to self-correct a false negative before continuing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      correct: false,
      answer: "instrument response",
      explanation: "Calibration compares it with a reference.",
      sourceEvidence: "Calibration compares instrument response with a known reference standard",
    }), { status: 200 })));
    const onResult = vi.fn();
    render(<QuizCard item={item} difficulty="easy" onResult={onResult} />);

    fireEvent.change(screen.getByRole("textbox", { name: /your answer/i }), { target: { value: "instrument response" } });
    fireEvent.click(screen.getByRole("button", { name: /check answer/i }));
    await screen.findByText("Incorrect.");
    fireEvent.click(screen.getByRole("button", { name: /i was right/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });
});
