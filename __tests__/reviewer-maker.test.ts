import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { shouldExcludeReviewerSection } from "@/lib/reviewer/source-filter";
import { extractPptxReviewerSections } from "@/lib/reviewer/browser-reviewer";

describe("reviewer source filtering", () => {
  it("removes only administrative and closing slides", () => {
    expect(shouldExcludeReviewerSection("Course Overview")).toBe(true);
    expect(shouldExcludeReviewerSection("Learning Outcomes\nAt the end of this lesson..." )).toBe(true);
    expect(shouldExcludeReviewerSection("Thank you!" )).toBe(true);
  });

  it("does not remove lesson content just because it contains the word course", () => {
    expect(shouldExcludeReviewerSection("Clinical course and prognosis of dengue fever")).toBe(false);
    expect(shouldExcludeReviewerSection("The ureter follows a retroperitoneal course.")).toBe(false);
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
});
