import { describe, expect, it } from "vitest";
import { parseMedeaChatRequest } from "@/lib/ai/chat-request";
import { buildMedeaGeneralPrompt, MEDEA_GENERAL_SYSTEM_PROMPT } from "@/lib/ai/chat-request";

describe("Medea chat request contract", () => {
  const validSavedDocumentRequest = {
    documentId:
      "22222222-2222-4222-8222-222222222222",

    message:
      "Explain this document",

    requestId:
      "33333333-3333-4333-8333-333333333333",
  };

  it(
    "accepts exactly the saved-document request contract",
    () => {
      expect(
        parseMedeaChatRequest(
          validSavedDocumentRequest,
        ),
      ).toEqual({
        kind: "document",
        ...validSavedDocumentRequest,
      });
    },
  );

  it.each([
    [
      "userId",
      "11111111-1111-4111-8111-111111111111",
    ],

    [
      "fileName",
      "lecture-notes.pdf",
    ],

    [
      "extractedText",
      "Client supplied document text must not be trusted.",
    ],

    [
      "chunks",
      [
        {
          content:
            "Client supplied chunk content",
        },
      ],
    ],

    [
      "documentContext",
      "CLIENT_CONTROLLED_LEGACY_CONTEXT",
    ],
  ])(
    "rejects saved-document requests containing client-supplied %s",
    (
      field,
      value,
    ) => {
      expect(
        () =>
          parseMedeaChatRequest({
            ...validSavedDocumentRequest,
            [field]:
              value,
          }),
      ).toThrow();
    },
  );

  it("accepts the dashboard drawer payload that previously returned Invalid request payload", () => {
    const result = parseMedeaChatRequest({
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
      documentContext: "Force equals mass times acceleration.",
      messages: [{ role: "user", content: "How do I calculate force?" }],
    });
    expect(request.kind).toBe("general");
    if (request.kind !== "general") return;

    const prompt = buildMedeaGeneralPrompt(request);
    expect(MEDEA_GENERAL_SYSTEM_PROMPT).toContain("mathematics");
    expect(MEDEA_GENERAL_SYSTEM_PROMPT).toContain("science problems");
    expect(MEDEA_GENERAL_SYSTEM_PROMPT).toContain("friendly all-purpose learning assistant");
    expect(prompt).toContain("Force equals mass times acceleration.");
    expect(prompt).toContain("How do I calculate force?");
  });

  it("uses one unified assistant instead of exposing separate teaching modes", () => {
    const request = parseMedeaChatRequest({
      documentContext: "",
      messages: [{ role: "user", content: "Compare quantum mechanics and relativity." }],
    });
    expect(request.kind).toBe("general");
    if (request.kind !== "general") return;

    const prompt = buildMedeaGeneralPrompt(request);
    expect(prompt).toContain("Choose the most useful response style automatically");
    expect(prompt).not.toContain("Teach Socratically");
    expect(prompt).not.toContain("crisp definition");
  });
});
