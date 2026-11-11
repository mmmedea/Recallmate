// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import QuizFormatPicker from "@/components/study/QuizFormatPicker";

describe("quiz question format picker", () => {
  it("offers multiple choice, identification, and mixed formats", () => {
    const onChange = vi.fn();
    render(<QuizFormatPicker value="multiple_choice" onChange={onChange} />);

    expect(screen.getByRole("button", { name: /multiple choice/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /identification/i })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /^mixed/i }));
    expect(onChange).toHaveBeenCalledWith("mixed");
  });
});
