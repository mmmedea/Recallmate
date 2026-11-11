// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import QuizCountPicker, { quizCountOptions } from "@/components/study/QuizCountPicker";

describe("quiz count picker", () => {
  it("limits free users to 30 questions", () => {
    expect(quizCountOptions(false)).toEqual([5, 10, 15, 20, 25, 30]);
    render(<QuizCountPicker value={10} isPremium={false} onChange={vi.fn()} />);
    const slider = screen.getByRole("slider", { name: /quiz question count/i });
    expect(slider.getAttribute("max")).toBe("30");
    expect(screen.queryByText("50")).toBeNull();
  });

  it("allows premium users to slide up to 50 questions", () => {
    const onChange = vi.fn();
    render(<QuizCountPicker value={30} isPremium onChange={onChange} />);
    const slider = screen.getByRole("slider", { name: /quiz question count/i });
    expect(slider.getAttribute("max")).toBe("50");
    fireEvent.change(slider, { target: { value: "50" } });
    expect(onChange).toHaveBeenCalledWith(50);
  });
});
