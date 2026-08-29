import { describe, expect, it } from "vitest";
import { parseMedeaChatRequest } from "@/lib/ai/chat-request";
import { buildMedeaGeneralPrompt, MEDEA_GENERAL_SYSTEM_PROMPT } from "@/lib/ai/chat-request";

describe("Medea chat request contract", () => {
  it("accepts the dashboard drawer payload that previously returned Invalid request payload", () => {
    const result = parseMedeaChatRequest({
      mode: "tutor",
      documentContext: "",
      messages: [
        { role: "assistant", content: "Hello! I'm Medea." },
        { role: "user", content: "11+11" },
      ],
    });

    expect(result).toMatchObject({
      kind: "general",
      question: "11+11",
      documentContext: "",
    });
  });

  it("gives Medea broad, friendly math and science reasoning instructions", () => {
    const request = parseMedeaChatRequest({
      mode: "tutor",
      documentContext: "Force equals mass times acceleration.",
      messages: [{ role: "user", content: "How do I calculate force?" }],
    });
    expect(request.kind).toBe("general");
    if (request.kind !== "general") return;

    const prompt = buildMedeaGeneralPrompt(request);
    expect(MEDEA_GENERAL_SYSTEM_PROMPT).toContain("mathematics");
    expect(MEDEA_GENERAL_SYSTEM_PROMPT).toContain("science problems");
    expect(MEDEA_GENERAL_SYSTEM_PROMPT).toContain("friendly AI tutor");
    expect(prompt).toContain("Force equals mass times acceleration.");
    expect(prompt).toContain("How do I calculate force?");
  });
});
