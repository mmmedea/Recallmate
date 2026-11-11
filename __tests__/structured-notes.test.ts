import { describe, expect, it } from "vitest";
import { buildEditableNotesHtml } from "@/lib/notes/structured-notes";

describe("editable study note structure", () => {
  it("preserves hierarchy, formulas, and bullets without generic concept placeholders", () => {
    const html = buildEditableNotesHtml({
      fileName: "Instrumentation.pdf",
      summary: "A complete overview of laboratory instrumentation.",
      notes: [
        "1 COLORIMETRY",
        "• Measures light absorbed by a solution.",
        "Absorbance = incident light - transmitted light",
        "Loading...",
      ],
    });

    expect(html).toContain("<h2>1 COLORIMETRY</h2>");
    expect(html).toContain("<li>Measures light absorbed by a solution.</li>");
    expect(html).toContain("<strong>FORMULA</strong>");
    expect(html).not.toContain("Concept 1");
    expect(html).not.toContain("Loading");
  });

  it("de-duplicates flat extraction dumps and restores inline bullets and factor tables", () => {
    const html = buildEditableNotesHtml({
      fileName: "LESSON_3_SC.pdf",
      summary: "LESSON_3_SC.pdf Loading...",
      notes: [
        "Lesson 3: Specimen Variables Loading... Specimen Variables • Exercise • Diet • Stress",
        "Lesson 3: Specimen Variables Loading... Specimen Variables • Exercise • Diet • Stress",
        "Factors Effects Exercise Increased (Short-term): FA, Lactate, CK. Decreased: Testosterone. Diet Increased: Glucose, TAG.",
      ],
    });

    expect(html.match(/Lesson 3: Specimen Variables/g)).toHaveLength(1);
    expect(html).not.toMatch(/Loading/i);
    expect(html).toContain("<li>Exercise</li>");
    expect(html).toContain("<li>Diet</li>");
    expect(html).toContain("<table>");
    expect(html).toContain("<th>Factor</th>");
    expect(html).toContain("<td>Exercise</td>");
  });
});
