// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import QuizDifficultyPicker from "@/components/study/QuizDifficultyPicker";

describe("quiz difficulty picker", () => {
  it("offers easy, medium, and hard before a lesson is uploaded", () => {
    const onChange = vi.fn();
    render(<QuizDifficultyPicker value="medium" onChange={onChange} />);

    expect(screen.getByRole("button", { name: /easy/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /medium/i }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /hard/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /mixed/i })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /hard/i }));
    expect(onChange).toHaveBeenCalledWith("hard");
  });

  it("allows selecting Mixed difficulty", () => {
    const onChange = vi.fn();
    render(<QuizDifficultyPicker value={"easy" as any} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /mixed/i }));

    expect(onChange).toHaveBeenCalledWith("mixed");
  });
});
