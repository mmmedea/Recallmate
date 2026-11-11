import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { classifyReviewerSectionDisposition, shouldExcludeReviewerSection } from "@/lib/reviewer/source-filter";
import { buildReviewerDocxBlob, extractDocxReviewerSections, extractPptxReviewerSections, getReviewerQualityReport, getReviewerSourceFacts, readReviewerFile, readReviewerFileWithReport } from "@/lib/reviewer/browser-reviewer";

describe("reviewer source filtering", () => {
  it("removes only administrative and closing slides", () => {
    expect(shouldExcludeReviewerSection("Course Overview")).toBe(true);
    expect(shouldExcludeReviewerSection("Learning Outcomes\nAt the end of this lesson..." )).toBe(true);
    expect(shouldExcludeReviewerSection("Thank you!" )).toBe(true);
    expect(shouldExcludeReviewerSection("Q&A\nQuestions?")).toBe(true);
    expect(shouldExcludeReviewerSection("Welcome\nPresenter contact")).toBe(true);
    expect(shouldExcludeReviewerSection("Agenda\nToday we will learn")).toBe(true);
  });

  it("does not remove lesson content just because it contains the word course", () => {
    expect(shouldExcludeReviewerSection("Clinical course and prognosis of dengue fever")).toBe(false);
    expect(shouldExcludeReviewerSection("The ureter follows a retroperitoneal course.")).toBe(false);
    expect(shouldExcludeReviewerSection("Objective lens\nMicroscopy component that magnifies the specimen.")).toBe(false);
    expect(shouldExcludeReviewerSection("Agenda\nColorimetry principles\nBeer-Lambert law formula A = abc")).toBe(false);
    expect(classifyReviewerSectionDisposition("Learning Objectives\nExplain Beer-Lambert law")).toBe("DROP_OBJECTIVES");
  });

  it("keeps complete PPTX lesson text and embedded pictures while dropping excluded slides", async () => {
    const zip = new JSZip();
    zip.file("ppt/slides/slide1.xml", '<p:sld xmlns:a="a" xmlns:r="r"><a:t>Learning Outcomes</a:t><a:t>Remove me</a:t></p:sld>');
    zip.file("ppt/slides/slide2.xml", '<p:sld xmlns:a="a" xmlns:r="r"><a:t>Routine Urinalysis</a:t><a:t>Color, clarity, specific gravity, and every source detail.</a:t><a:blip r:embed="rId1"/></p:sld>');
    zip.file("ppt/slides/_rels/slide2.xml.rels", '<Relationships><Relationship Id="rId1" Target="../media/image1.png"/></Relationships>');
    zip.file("ppt/media/image1.png", "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", { base64: true });

    const sections = await extractPptxReviewerSections(await zip.generateAsync({ type: "arraybuffer" }));
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Routine Urinalysis");
    expect(sections[0].text).toContain("every source detail");
    expect(sections[0].images[0]).toMatch(/^data:image\/png;base64,/);
  });

  it("joins styled PowerPoint runs into readable paragraphs and removes loading placeholders", async () => {
    const zip = new JSZip();
    zip.file("ppt/slides/slide1.xml", '<p:sld xmlns:a="a"><a:p><a:r><a:t>Lesson 3:</a:t></a:r></a:p><a:p><a:r><a:t>Specimen </a:t></a:r><a:r><a:t>Variables</a:t></a:r></a:p><a:p><a:r><a:t>Loading...</a:t></a:r></a:p><a:p><a:buChar char="•"/><a:r><a:t>Proper patient preparation and specimen transport</a:t></a:r></a:p></p:sld>');

    const sections = await extractPptxReviewerSections(await zip.generateAsync({ type: "arraybuffer" }));
    expect(sections[0].title).toBe("Lesson 3: Specimen Variables");
    expect(sections[0].text).toContain("• Proper patient preparation and specimen transport");
    expect(sections[0].text).not.toContain("Loading");
    expect(sections[0].text).not.toContain("Specimen\nVariables");
  });

  it("preserves the source hierarchy and merges consecutive slides with the same major topic", async () => {
    const zip = new JSZip();
    zip.file("ppt/slides/slide1.xml", '<p:sld xmlns:a="a"><a:p><a:r><a:t>2 SPECTROMETRY</a:t></a:r></a:p><a:p><a:r><a:t>BASIC COMPONENTS OF A SPECTROPHOTOMETER</a:t></a:r></a:p><a:p><a:buChar char="•"/><a:r><a:t>Light Source</a:t></a:r></a:p></p:sld>');
    zip.file("ppt/slides/slide2.xml", '<p:sld xmlns:a="a"><a:p><a:r><a:t>2 SPECTROMETRY</a:t></a:r></a:p><a:p><a:r><a:t>Detector / Photodetector</a:t></a:r></a:p><a:p><a:buChar char="•"/><a:r><a:t>Converts transmitted light into current</a:t></a:r></a:p></p:sld>');

    const sections = await extractPptxReviewerSections(await zip.generateAsync({ type: "arraybuffer" }));
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("2 SPECTROMETRY");
    expect(sections[0].text).toContain("BASIC COMPONENTS OF A SPECTROPHOTOMETER");
    expect(sections[0].text).toContain("Detector / Photodetector");
  });

  it("extracts PPTX speaker notes as source-grounded reviewer notes", async () => {
    const zip = new JSZip();
    zip.file("ppt/slides/slide1.xml", '<p:sld xmlns:a="a" xmlns:r="r"><a:p><a:r><a:t>MCHC</a:t></a:r></a:p><a:p><a:r><a:t>Mean cell hemoglobin concentration.</a:t></a:r></a:p></p:sld>');
    zip.file("ppt/slides/_rels/slide1.xml.rels", '<Relationships><Relationship Id="rIdNotes" Target="../notesSlides/notesSlide1.xml"/></Relationships>');
    zip.file("ppt/notesSlides/notesSlide1.xml", '<p:notes xmlns:a="a"><a:p><a:r><a:t>Normal value 30-35 g/dL.</a:t></a:r></a:p><a:p><a:r><a:t>Low MCHC may be associated with hypochromia.</a:t></a:r></a:p></p:notes>');

    const sections = await extractPptxReviewerSections(await zip.generateAsync({ type: "arraybuffer" }));
    expect(sections[0].text).toContain("NOTE: Normal value 30-35 g/dL.");
    expect(sections[0].text).toContain("NOTE: Low MCHC may be associated with hypochromia.");
  });

  it("does not promote placeholders or generic labels into reviewer sections", async () => {
    const zip = new JSZip();
    zip.file("ppt/slides/slide1.xml", '<p:sld xmlns:a="a"><a:p><a:r><a:t>Loading...</a:t></a:r></a:p><a:p><a:r><a:t>Factors</a:t></a:r></a:p><a:p><a:r><a:t>Effects</a:t></a:r></a:p><a:p><a:r><a:t>Exercise increases CK and lactate.</a:t></a:r></a:p></p:sld>');

    const sections = await extractPptxReviewerSections(await zip.generateAsync({ type: "arraybuffer" }));
    expect(sections[0].title).not.toMatch(/loading|factors|effects/i);
    expect(sections[0].text).not.toMatch(/^Factors$|^Effects$/m);
  });

  it("accepts DOCX sources and preserves native Word tables as tables", async () => {
    const zip = new JSZip();
    zip.file("word/document.xml", [
      '<w:document xmlns:w="w">',
      '<w:body>',
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Diurnal Variation</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>Hormones change across the day.</w:t></w:r></w:p>',
      '<w:tbl>',
      '<w:tr><w:tc><w:p><w:r><w:t>Hormone</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Pattern</w:t></w:r></w:p></w:tc></w:tr>',
      '<w:tr><w:tc><w:p><w:r><w:t>Cortisol</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Peaks: Early morning</w:t></w:r></w:p></w:tc></w:tr>',
      '<w:tr><w:tc><w:p><w:r><w:t>ACTH</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Lowest: 8 pm to 12 am</w:t></w:r></w:p></w:tc></w:tr>',
      '</w:tbl>',
      '</w:body>',
      '</w:document>',
    ].join(""));

    const sections = await extractDocxReviewerSections(await zip.generateAsync({ type: "arraybuffer" }), "lesson.docx");
    expect(sections[0].title).toBe("Diurnal Variation");
    expect(sections[0].text).toContain("Hormones change across the day");
    expect(sections[0].tables).toEqual([[
      ["Hormone", "Pattern"],
      ["Cortisol", "Peaks: Early morning"],
      ["ACTH", "Lowest: 8 pm to 12 am"],
    ]]);
  });

  it("accepts image files as source figures", async () => {
    const file = new File([new Uint8Array([137, 80, 78, 71])], "spectrophotometer.png", { type: "image/png" });

    const sections = await readReviewerFile(file);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("spectrophotometer");
    expect(sections[0].images[0]).toMatch(/^data:image\/png;base64,/);
  });

  it("creates a real two-column Word reviewer with running page fields", async () => {
    const file = new File(["lesson"], "Hematology.pptx", { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
    const blob = await buildReviewerDocxBlob(file, [{
      title: "Red Blood Cells",
      text: "Normal range: preserve every sourced figure.\nNOTE: Review the exception.",
      images: [],
      tables: [[
        ["Index", "Normal value"],
        ["MCV", "75-98 fL"],
        ["MCH", "27-33 pg"],
      ]],
    }], { name: "Rose", accent: "E11D48", tint: "FFE4E6" });
    const archive = await JSZip.loadAsync(await blob.arrayBuffer());
    const documentXml = await archive.file("word/document.xml")!.async("string");
    const footerXml = await archive.file("word/footer1.xml")!.async("string");
    const stylesXml = await archive.file("word/styles.xml")!.async("string");

    expect(documentXml).toMatch(/<w:cols[^>]*w:num="2"/);
    expect(documentXml).toContain("Red Blood Cells".toUpperCase());
    expect(documentXml).toContain("preserve every sourced figure");
    expect(stylesXml).toContain('w:color w:val="000000"');
    expect(documentXml).toContain('w:fill="FFE4E6"');
    expect(documentXml).toContain('w:fill="E11D48"');
    expect(documentXml).toContain('w:color w:val="FFFFFF"');
    expect(footerXml).toContain("PAGE");
    expect(footerXml).toContain("NUMPAGES");
  });

  it("reports source coverage separately from structural layout QA", () => {
    const report = getReviewerQualityReport([{
      title: "RBC Indices",
      text: "MCV = HCT / RBC x 10\nNormal value: 75-98 fL\nMCHC indicates hemoglobin concentration.\nNOTE: Low MCHC may be associated with hypochromia.",
      images: ["data:image/png;base64,aGVsbG8="],
      tables: [[["Index", "Normal value"], ["MCV", "75-98 fL"]]],
    }]);
    expect(report.contentQA).toBe("pass");
    expect(report.layoutQA).toBe("pass");
    expect(report.parityQA).toBe("pass");
    expect(report.coverage).toBe(1);
    expect(report.metrics.find(metric => metric.label === "Formulas")?.source).toBe(1);
    expect(report.metrics.find(metric => metric.label === "Numerical values")?.source).toBeGreaterThan(0);
    expect(report.metrics.find(metric => metric.label === "Speaker notes")?.source).toBe(1);
  });

  it("uses fact identity so duplicated formulas cannot hide a missing source formula", () => {
    const source = [{
      title: "RBC Indices",
      text: "MCV = HCT / RBC x 10\nMCH = HGB / RBC x 10\nMCHC indicates hemoglobin concentration.",
      images: [],
      tables: [],
    }];
    const output = [{
      title: "RBC Indices",
      text: "MCV = HCT / RBC x 10\nMCV = HCT / RBC x 10\nMCHC indicates hemoglobin concentration.",
      images: [],
      tables: [],
    }];

    const formulaFacts = getReviewerSourceFacts(source).filter(fact => fact.type === "formula");
    const report = getReviewerQualityReport(source, output);

    expect(formulaFacts).toHaveLength(2);
    expect(report.contentQA).toBe("fail");
    expect(report.metrics.find(metric => metric.label === "Formulas")?.missing).toContain("mch = hgb / rbc x 10");
  });

  it("reports removed administrative PPTX sections with source reasons for preview and restore", async () => {
    const zip = new JSZip();
    zip.file("ppt/slides/slide1.xml", '<p:sld xmlns:a="a"><a:p><a:r><a:t>Learning Objectives</a:t></a:r></a:p><a:p><a:r><a:t>Explain Beer-Lambert law.</a:t></a:r></a:p></p:sld>');
    zip.file("ppt/slides/slide2.xml", '<p:sld xmlns:a="a"><a:p><a:r><a:t>Colorimetry</a:t></a:r></a:p><a:p><a:r><a:t>Absorbance = incident light minus transmitted light.</a:t></a:r></a:p></p:sld>');
    const file = new File([await zip.generateAsync({ type: "arraybuffer" })], "instrumentation.pptx", { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });

    const report = await readReviewerFileWithReport(file);

    expect(report.sections).toHaveLength(1);
    expect(report.sections[0].title).toBe("Colorimetry");
    expect(report.removed).toEqual([expect.objectContaining({
      title: "Learning Objectives",
      reason: "DROP_OBJECTIVES",
      sourceFileName: "instrumentation.pptx",
      sourcePageOrSlide: 1,
    })]);
  });
});
