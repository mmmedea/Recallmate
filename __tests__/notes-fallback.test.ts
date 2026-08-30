import { describe, expect, it } from "vitest";
import { buildDocumentNotesFallback } from "@/lib/ai/document-notes-fallback";

describe("editable notes provider fallback", () => {
  it("preserves readable document content when AI providers are unavailable", () => {
    const result = buildDocumentNotesFallback(
      "Loading...\nBig data systems distribute storage across nodes.\nNoSQL databases support flexible schemas for varied records.\nBig data systems distribute storage across nodes.",
      "Chapter 6.pdf",
    );

    expect(result.fileName).toBe("Chapter 6.pdf");
    expect(result.notes).toContain("Big data systems distribute storage across nodes.");
    expect(result.notes).toContain("NoSQL databases support flexible schemas for varied records.");
    expect(result.notes).not.toContain("Loading...");
    expect(result.generatedBy).toBe("document-fallback");
  });
});
