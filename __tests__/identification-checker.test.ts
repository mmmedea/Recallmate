import { describe, expect, it } from "vitest";
import { checkIdentificationAnswer, normalizeIdentificationAnswer } from "@/lib/quiz/identification-checker";

describe("identification answer checking", () => {
  it("normalizes case, accents, punctuation, and spacing", () => {
    expect(normalizeIdentificationAnswer("  INSTRUMENT—response! ")).toBe("instrument response");
    expect(checkIdentificationAnswer("Instrument response.", ["instrument response"])).toBe(true);
  });

  it("forgives a small typo only for longer answers", () => {
    expect(checkIdentificationAnswer("calibraton", ["calibration"])).toBe(true);
    expect(checkIdentificationAnswer("cat", ["bat"])).toBe(false);
  });
});
