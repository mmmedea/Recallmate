import { describe, expect, it } from "vitest";
import { getReviewerStructuralIssues, normalizePdfReviewerItems, repairReviewerTableTranspositions, shouldRenderPdfPageSnapshot } from "@/lib/reviewer/browser-reviewer";

describe("PDF reviewer structure recovery", () => {
  it("sorts positioned text into readable rows and removes render placeholders", () => {
    const result = normalizePdfReviewerItems([
      { str: "Specimen Variables", transform: [1, 0, 0, 1, 40, 700], width: 120 },
      { str: "Loading...", transform: [1, 0, 0, 1, 40, 680], width: 50 },
      { str: "Factors", transform: [1, 0, 0, 1, 40, 650], width: 45 },
      { str: "Effects", transform: [1, 0, 0, 1, 220, 650], width: 45 },
      { str: "Exercise", transform: [1, 0, 0, 1, 40, 630], width: 50 },
      { str: "Increased: FA, Lactate, CK", transform: [1, 0, 0, 1, 220, 630], width: 160 },
    ]);

    expect(result.lines).toEqual(["Specimen Variables"]);
    expect(result.tables).toEqual([[["Factors", "Effects"], ["Exercise", "Increased: FA, Lactate, CK"]]]);
  });

  it("reads two-column PDFs by column instead of mixing unrelated same-height rows", () => {
    const result = normalizePdfReviewerItems([
      { str: "LEFT SECTION", transform: [1, 0, 0, 1, 40, 700], width: 90 },
      { str: "left first detail", transform: [1, 0, 0, 1, 40, 680], width: 90 },
      { str: "left second detail", transform: [1, 0, 0, 1, 40, 660], width: 90 },
      { str: "left third detail", transform: [1, 0, 0, 1, 40, 640], width: 90 },
      { str: "RIGHT SECTION", transform: [1, 0, 0, 1, 360, 700], width: 100 },
      { str: "right first detail", transform: [1, 0, 0, 1, 360, 680], width: 90 },
      { str: "right second detail", transform: [1, 0, 0, 1, 360, 660], width: 90 },
      { str: "right third detail", transform: [1, 0, 0, 1, 360, 640], width: 90 },
    ]);

    expect(result.lines).toEqual([
      "LEFT SECTION",
      "left first detail",
      "left second detail",
      "left third detail",
      "RIGHT SECTION",
      "right first detail",
      "right second detail",
      "right third detail",
    ]);
  });

  it("does not duplicate readable PDF text as a full-page snapshot", () => {
    expect(shouldRenderPdfPageSnapshot(["Specimen Variables"], [])).toBe(false);
    expect(shouldRenderPdfPageSnapshot([], [[["Factors", "Effects"]]])).toBe(false);
    expect(shouldRenderPdfPageSnapshot([], [])).toBe(true);
  });

  it("rebuilds two-column key-value tables instead of detaching labels from values", () => {
    const result = normalizePdfReviewerItems([
      { str: "Diurnal Variation", transform: [1, 0, 0, 1, 40, 700], width: 90 },
      { str: "Cortisol", transform: [1, 0, 0, 1, 40, 680], width: 42 },
      { str: "ACTH", transform: [1, 0, 0, 1, 40, 662], width: 30 },
      { str: "Renin", transform: [1, 0, 0, 1, 40, 644], width: 32 },
      { str: "Peaks: Early morning", transform: [1, 0, 0, 1, 220, 680], width: 116 },
      { str: "Lowest: 8 pm to 12 am", transform: [1, 0, 0, 1, 220, 662], width: 132 },
      { str: "Lower at night", transform: [1, 0, 0, 1, 220, 644], width: 82 },
    ]);

    expect(result.lines).toEqual([]);
    expect(result.tables).toEqual([
      [
        ["Diurnal Variation", "Details"],
        ["Cortisol", "Peaks: Early morning"],
        ["ACTH", "Lowest: 8 pm to 12 am"],
        ["Renin", "Lower at night"],
      ],
    ]);
  });

  it("splits inline bullet runs back into separate reviewer bullets", () => {
    const result = normalizePdfReviewerItems([
      { str: "Physiologic variation", transform: [1, 0, 0, 1, 40, 700], width: 120 },
      { str: "Exercise • Diet • Stress • Gender • Age", transform: [1, 0, 0, 1, 40, 680], width: 220 },
    ]);

    expect(result.lines).toEqual([
      "Physiologic variation",
      "• Exercise",
      "• Diet",
      "• Stress",
      "• Gender",
      "• Age",
    ]);
  });

  it("repairs broken character-run text and corrupted bullet glyphs", () => {
    const result = normalizePdfReviewerItems([
      { str: "D e s c r i b e", transform: [1, 0, 0, 1, 40, 700], width: 120 },
      { str: "â€¢ Complete source sentence", transform: [1, 0, 0, 1, 40, 680], width: 220 },
    ]);

    expect(result.lines).toEqual(["Describe", "• Complete source sentence"]);
  });

  it("flags table rows that are broken line-wrap fragments", () => {
    expect(getReviewerStructuralIssues([{
      title: "Big Data",
      text: "",
      images: [],
      tables: [[["Concept", "Details"], ["Volume", "the"], ["Velocity", "beyond"]]],
    }])).toEqual([
      "Table in \"Big Data\" row 2, cell 2 looks like a broken line-wrap fragment: the",
      "Table in \"Big Data\" row 3, cell 2 looks like a broken line-wrap fragment: beyond",
    ]);
  });

  it("does not treat blank or multiline cells in wide native tables as broken line-wrap fragments", () => {
    expect(getReviewerStructuralIssues([{
      title: "CORYNEBACTERIA",
      text: "",
      images: [],
      sourceOrigin: "native_table",
      tables: [[
        ["Organism", "Microscopy", "Oxygen use", "Motility", "Notes"],
        ["Listeria monocytogenes", "Laboratory Diagnosis", "Facultative anaerobe", "Motility: Hanging Drop; tumbling motility (RT)", ""],
        ["Corynebacterium diphtheriae", "Gram-positive bacilli", "Aerobic", "Non-motile", "Albert stain"],
      ]],
    }])).toEqual([]);
  });

  it("does not merge rows in wide native microbiology tables during normalization", () => {
    const repaired = repairReviewerTableTranspositions([{
      title: "AEROBIC GRAM-POSITIVE BACILLI",
      text: "",
      images: [],
      sourceOrigin: "native_table",
      tables: [[
        ["Organism", "Shape", "Arrangement", "Motility", "Culture"],
        ["CORYNEBACTERIA", "Pleomorphic", "Palisades", "", "Tellurite agar"],
        ["LISTERIA", "Short bacilli", "Singles/chains", "Umbrella-like pattern (RT)", "Semi-solid medium (SIM)"],
      ]],
    }]);

    expect(repaired.sections[0].tables?.[0]).toEqual([
      ["Organism", "Shape", "Arrangement", "Motility", "Culture"],
      ["CORYNEBACTERIA", "Pleomorphic", "Palisades", "", "Tellurite agar"],
      ["LISTERIA", "Short bacilli", "Singles/chains", "Umbrella-like pattern (RT)", "Semi-solid medium (SIM)"],
    ]);
    expect(getReviewerStructuralIssues(repaired.sections)).toEqual([]);
  });

  it("preserves Listeria headings and motility bullets without inventing a table", () => {
    const repaired = repairReviewerTableTranspositions([{
      title: "Listeria monocytogenes",
      text: [
        "Laboratory Diagnosis",
        "Microscopy",
        "Facultative anaerobe",
        "Motility:",
        "• Hanging Drop: tumbling motility (RT)",
        "• Semisolid medium (SIM): Umbrella-like pattern (RT)",
      ].join("\n"),
      images: [],
      tables: [],
    }]);

    expect(repaired.repairs).toEqual([]);
    expect(repaired.sections[0].text).toBe([
      "Laboratory Diagnosis", "Microscopy", "Facultative anaerobe", "Motility:",
      "• Hanging Drop: tumbling motility (RT)",
      "• Semisolid medium (SIM): Umbrella-like pattern (RT)",
    ].join("\n"));
    expect(repaired.sections[0].tables).toEqual([]);
    expect(getReviewerStructuralIssues(repaired.sections)).toEqual([]);
  });

  it("flags column-major table transposition before reviewer export", () => {
    const issues = getReviewerStructuralIssues([{
      title: "Diurnal Variation",
      text: [
        "Cortisol",
        "ACTH",
        "Renin",
        "Aldosterone",
        "Peaks: Early morning",
        "Lowest: 8 pm to 12 am",
        "Lower at night",
        "Lower at night",
      ].join("\n"),
      images: [],
      tables: [],
    }]);
    expect(issues).toEqual([
      expect.stringContaining("Possible column-major table transposition"),
    ]);
  });

  it("repairs column-major physiologic factor tables before final QA", () => {
    const repaired = repairReviewerTableTranspositions([{
      title: "Physiologic Factors",
      text: [
        "Stress",
        "Hyperventilation",
        "Posture",
        "Increased: ACTH, Cortisol, Catecholamines",
        "Increased: Total Cholesterol, PRL",
        "Decreased: HDL",
      ].join("\n"),
      images: [],
      tables: [],
    }]);

    expect(repaired.repairs).toEqual([
      "Repaired column-major table transposition in \"Physiologic Factors\" (3 rows).",
    ]);
    expect(repaired.sections[0].text).toBe("");
    expect(repaired.sections[0].tables).toEqual([
      [
        ["Factors", "Effects"],
        ["Stress", "Increased: ACTH, Cortisol, Catecholamines"],
        ["Hyperventilation", "Increased: Total Cholesterol, PRL"],
        ["Posture", "Decreased: HDL"],
      ],
    ]);
    expect(getReviewerStructuralIssues(repaired.sections)).toEqual([]);
  });

  it("repairs column-major diurnal variation tables without weakening QA", () => {
    const repaired = repairReviewerTableTranspositions([{
      title: "Diurnal Variation",
      text: [
        "Diurnal Variation",
        "Cortisol",
        "ACTH",
        "Peaks: Early morning",
        "Lowest: 8 pm to 12 am",
        "Lower at night",
      ].join("\n"),
      images: [],
      tables: [],
    }]);

    expect(repaired.sections[0].tables).toEqual([
      [
        ["Analyte / factor", "Diurnal variation"],
        ["Diurnal Variation", "Peaks: Early morning"],
        ["Cortisol", "Lowest: 8 pm to 12 am"],
        ["ACTH", "Lower at night"],
      ],
    ]);
    expect(getReviewerStructuralIssues(repaired.sections)).toEqual([]);
  });

  it("does not guess repairs when column-major label and value counts differ", () => {
    const repaired = repairReviewerTableTranspositions([{
      title: "Physiologic Factors",
      text: [
        "Stress",
        "Hyperventilation",
        "Posture",
        "Exercise",
        "Increased: ACTH, Cortisol",
        "Increased: Total Cholesterol",
        "Decreased: HDL",
      ].join("\n"),
      images: [],
      tables: [],
    }]);

    expect(repaired.repairs).toEqual([]);
    expect(repaired.warnings[0]).toContain("Automatic repair skipped because label/value counts do not match");
    expect(getReviewerStructuralIssues(repaired.sections)).toEqual([
      expect.stringContaining("Possible column-major table transposition"),
    ]);
  });

  it("flags broken reviewer structures before download", () => {
    expect(getReviewerStructuralIssues([{
      title: "Physiologic Factors",
      text: "Decreased:",
      images: [],
      tables: [[["Factors", "Effects"], ["Exercise"]]],
    }])).toEqual([
      "Table in \"Physiologic Factors\" row 2 has 1 cells instead of 2.",
      "Orphaned fragment in \"Physiologic Factors\": Decreased:",
    ]);
  });

  it("flags cross-block contamination inside table cells", () => {
    expect(getReviewerStructuralIssues([{
      title: "Physiologic Factors",
      text: "",
      images: [],
      tables: [[
        ["Factors", "Effects"],
        ["Posture", "Decreased: HDL Increased: WBC count, Lactate, FA, pH Age Increased:"],
      ]],
    }])).toEqual([
      "Table in \"Physiologic Factors\" row 2, cell 2 appears to contain merged content from another factor: Decreased: HDL Increased: WBC count, Lactate, FA, pH Age Increased:",
    ]);
  });
});
