// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import ManualFlashcardBuilder from "@/components/study/ManualFlashcardBuilder";
import { navigationConfig } from "@/lib/navigation";

describe("combined study creation", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("combines upload and quizzes into one navigation destination", () => {
    expect(navigationConfig.main.filter((item) => item.href === "/upload")).toHaveLength(1);
    expect(navigationConfig.main.find((item) => item.href === "/upload")?.label).toBe("Quiz");
    expect(navigationConfig.main.some((item) => item.label === "Quizzes")).toBe(false);
    expect(navigationConfig.main.some((item) => item.href === "/progress")).toBe(false);
  });

  it("makes Topics and Library one destination", () => {
    const library = navigationConfig.main.find((item) => item.label === "Library");
    expect(library?.href).toBe("/dashboard#library");
    expect(navigationConfig.main.some((item) => item.label === "Topics")).toBe(false);
  });

  it("uses the simplified student navigation labels", () => {
    expect(navigationConfig.main.map((item) => item.label)).toEqual([
      "Dashboard",
      "Library",
      "Quiz",
      "Notes",
      "Calendar",
    ]);
    expect(navigationConfig.main.some((item) => item.label === "Study")).toBe(false);
    expect(navigationConfig.main.some((item) => item.label === "Schedule")).toBe(false);
    expect(navigationConfig.main.some((item) => item.label === "Progress")).toBe(false);
  });

  it("lets a student create, save, and review their own flashcards", () => {
    render(<ManualFlashcardBuilder />);

    fireEvent.change(screen.getByLabelText("Flashcard 1 front"), { target: { value: "What is mitosis?" } });
    fireEvent.change(screen.getByLabelText("Flashcard 1 back"), { target: { value: "Cell division producing two identical cells." } });
    fireEvent.click(screen.getByRole("button", { name: "Save flashcards" }));

    expect(screen.getByRole("status").textContent).toMatch(/saved 1 flashcard/i);
    expect(localStorage.getItem("recallmate-manual-flashcards")).toContain("What is mitosis?");

    fireEvent.click(screen.getByRole("button", { name: "Review flashcards" }));
    expect(screen.getByText("What is mitosis?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Flip flashcard" }));
    expect(screen.getByText("Cell division producing two identical cells.")).toBeTruthy();
  });
});
