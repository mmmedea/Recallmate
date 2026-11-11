import { existsSync, readFileSync } from "node:fs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  createReviewerArtifacts,
  readReviewerFileWithReport,
  repairReviewerTableTranspositions,
  type ReviewerSection,
} from "@/lib/reviewer/browser-reviewer";

const lesson3Path = "C:\\Users\\PC\\Downloads\\LESSON_3_SC.pdf";
const runIfLesson3Exists = existsSync(lesson3Path) ? it : it.skip;

function lessonFile() {
  const buffer = readFileSync(lesson3Path);
  return new File([buffer], "LESSON_3_SC.pdf", { type: "application/pdf" });
}

function sectionWithText(text: string, title = "Physiologic Factors"): ReviewerSection {
  return { title, text, images: [], tables: [] };
}

function tableText(sections: ReviewerSection[]) {
  return (sections.flatMap(section => section.tables || []))
    .map(table => table.map(row => row.join(" -> ")).join("\n"))
    .join("\n\n");
}

describe("LESSON_3_SC reviewer acceptance", () => {
  it("exports the Listeria heading and bullet case to PDF and DOCX without a false table failure", async () => {
    const source = [sectionWithText([
      "Laboratory Diagnosis", "Microscopy", "• Facultative anaerobe", "Motility:",
      "• Hanging Drop: tumbling motility (RT)",
      "• Semisolid medium (SIM): Umbrella-like pattern (RT)",
    ].join("\n"), "Listeria monocytogenes")];
    const artifacts = await createReviewerArtifacts(new File(["fixture"], "listeria.pptx"), source);
    expect(artifacts.qualityReport.layoutQA).toBe("pass");
    expect(artifacts.qualityReport.repairs).toEqual([]);
    const zip = await JSZip.loadAsync(await artifacts.docx.arrayBuffer());
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).not.toContain("<w:tbl>");
    expect(xml).toContain("Facultative anaerobe");
    expect(xml).toContain("tumbling motility (RT)");
    expect(xml).toContain("Umbrella-like pattern (RT)");
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.js");
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await artifacts.pdf.arrayBuffer()), disableWorker: true } as any).promise;
    try {
      const texts: string[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        texts.push(content.items.map((item: any) => item.str || "").join(" "));
      }
      expect(texts.join(" ")).toContain("Facultative anaerobe");
      expect(texts.join(" ")).toContain("tumbling motility (RT)");
      expect(texts.join(" ")).toContain("Umbrella-like pattern (RT)");
    } finally { await pdf.destroy(); }
  });

  runIfLesson3Exists("extracts the real source without shipping transposed physiologic-factor text", async () => {
    const report = await readReviewerFileWithReport(lessonFile());
    const repaired = repairReviewerTableTranspositions(report.sections);
    const corpus = tableText(repaired.sections);

    expect(corpus).toContain("Stress -> Increased: ACTH, Cortisol, Catecholamines");
    expect(corpus).toContain("Hyperventilation -> Increased: Total Cholesterol, PRL");
    expect(corpus).toContain("Posture -> Decreased: HDL");
    expect(corpus).not.toContain("Posture -> Decreased: HDL Increased:");
    expect(corpus).not.toMatch(/Posture -> .*Age Increased/i);
    expect(corpus).toContain("Diurnal Variation -> Peaks: Early morning");
    expect(corpus).toContain("Cortisol -> Lowest: 8 pm to 12 am");
    expect(corpus).toContain("ACTH -> Lower at night");
  }, 120_000);

  it("keeps the screenshot regression as actual table rows and not corrected prose", async () => {
    const repaired = repairReviewerTableTranspositions([
      sectionWithText([
        "Stress",
        "Hyperventilation",
        "Posture",
        "Increased: ACTH, Cortisol, Catecholamines",
        "Increased: Total Cholesterol, PRL",
        "Decreased: HDL",
      ].join("\n")),
      sectionWithText([
        "Diurnal Variation",
        "Cortisol",
        "ACTH",
        "Peaks: Early morning",
        "Lowest: 8 pm to 12 am",
        "Lower at night",
      ].join("\n"), "Diurnal Variation"),
    ]);

    expect(repaired.sections[0].text).toBe("");
    expect(repaired.sections[0].tables?.[0]).toEqual([
      ["Factors", "Effects"],
      ["Stress", "Increased: ACTH, Cortisol, Catecholamines"],
      ["Hyperventilation", "Increased: Total Cholesterol, PRL"],
      ["Posture", "Decreased: HDL"],
    ]);
    expect(repaired.sections[1].text).toBe("");
    expect(repaired.sections[1].tables?.[0]).toEqual([
      ["Analyte / factor", "Diurnal variation"],
      ["Diurnal Variation", "Peaks: Early morning"],
      ["Cortisol", "Lowest: 8 pm to 12 am"],
      ["ACTH", "Lower at night"],
    ]);
  });

  it("records repaired tables in the artifact quality report and DOCX table XML", async () => {
    const source = [
      sectionWithText([
        "Stress",
        "Hyperventilation",
        "Posture",
        "Increased: ACTH, Cortisol, Catecholamines",
        "Increased: Total Cholesterol, PRL",
        "Decreased: HDL",
      ].join("\n")),
    ];
    const file = new File(["fixture"], "physiologic-factors.pdf", { type: "application/pdf" });
    const artifacts = await createReviewerArtifacts(file, source);
    const docxZip = await JSZip.loadAsync(await artifacts.docx.arrayBuffer());
    const documentXml = await docxZip.file("word/document.xml")?.async("string");

    expect(artifacts.qualityReport.repairs).toEqual([
      "Repaired column-major table transposition in \"Physiologic Factors\" (3 rows).",
    ]);
    expect(documentXml).toContain("<w:tbl>");
    expect(documentXml).toContain("Stress");
    expect(documentXml).toContain("Increased: ACTH, Cortisol, Catecholamines");
    expect(documentXml).toContain("Hyperventilation");
    expect(documentXml).toContain("Increased: Total Cholesterol, PRL");
    expect(documentXml).toContain("Posture");
    expect(documentXml).toContain("Decreased: HDL");
  });

  it("still fails safely instead of inventing pairings for unequal label/value counts", () => {
    const repaired = repairReviewerTableTranspositions([
      sectionWithText([
        "Stress",
        "Hyperventilation",
        "Posture",
        "Exercise",
        "Increased: ACTH, Cortisol",
        "Increased: Total Cholesterol",
        "Decreased: HDL",
      ].join("\n")),
    ]);

    expect(repaired.repairs).toEqual([]);
    expect(repaired.warnings[0]).toContain("Automatic repair skipped because label/value counts do not match");
    expect(repaired.sections[0].tables).toEqual([]);
  });
});
