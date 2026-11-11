import { describe, expect, it } from "vitest";
import { planQuiz } from "@/lib/quiz/planner";

describe("quiz planner", () => {
  it("allocates mixed level and format slots without losing requested questions", () => {
    const plan = planQuiz(10, "mixed", "mixed");

    expect(plan).toHaveLength(10);
    expect(plan.filter((slot) => slot.difficulty === "easy")).toHaveLength(3);
    expect(plan.filter((slot) => slot.difficulty === "medium")).toHaveLength(4);
    expect(plan.filter((slot) => slot.difficulty === "hard")).toHaveLength(3);
    expect(plan.filter((slot) => slot.type === "multiple_choice")).toHaveLength(6);
    expect(plan.filter((slot) => slot.type === "identification")).toHaveLength(4);
  });

  it("keeps a selected fixed difficulty and format for every slot", () => {
    expect(planQuiz(5, "hard", "identification")).toEqual(
      Array.from({ length: 5 }, (_, index) => ({ index, difficulty: "hard", type: "identification" })),
    );
  });
});
