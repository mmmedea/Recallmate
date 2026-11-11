import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const reviewerMocks = vi.hoisted(() => ({
  REVIEWER_THEMES: [
    { name: "Slate", accent: "475569", tint: "E2E8F0" },
    { name: "Rose", accent: "E11D48", tint: "FFE4E6" },
  ],
  readReviewerFileWithReport: vi.fn(),
  createReviewerArtifacts: vi.fn(),
  downloadReviewerArtifact: vi.fn(),
}));

vi.mock("@/lib/reviewer/browser-reviewer", () => reviewerMocks);

import ReviewerPdfMaker from "@/components/reviewer/ReviewerPdfMaker";

describe("reviewer download controls", () => {
  it("prepares the files without downloading until the user clicks", async () => {
    const pdf = new Blob(["pdf"], { type: "application/pdf" });
    const docx = new Blob(["docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    reviewerMocks.readReviewerFileWithReport.mockResolvedValue({ sections: [{ title: "Hematology", text: "Full lesson", images: [] }], removed: [] });
    reviewerMocks.createReviewerArtifacts.mockResolvedValue({
      pdf,
      docx,
      baseName: "hematology",
      sectionCount: 1,
      qualityReport: {
        coverage: 1,
        contentQA: "pass",
        layoutQA: "pass",
        parityQA: "pass",
        metrics: [{ label: "Unique sections", source: 1, output: 1, missing: [], status: "pass" }],
        issues: [],
        repairs: [],
        warnings: [],
      },
    });

    const { container } = render(<ReviewerPdfMaker />);
    fireEvent.click(screen.getByRole("button", { name: /rose reviewer accents/i }));
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["pptx"], "hematology.pptx")] } });

    expect(await screen.findByRole("button", { name: /download pdf/i })).toBeDefined();
    expect(screen.getByText(/100% source coverage/i)).toBeDefined();
    expect(reviewerMocks.downloadReviewerArtifact).not.toHaveBeenCalled();
    expect(reviewerMocks.createReviewerArtifacts).toHaveBeenCalledWith(
      expect.any(File),
      expect.any(Array),
      expect.objectContaining({ name: "Rose", accent: "E11D48" }),
      { dedupeImages: true },
    );
    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));
    await waitFor(() => expect(reviewerMocks.downloadReviewerArtifact).toHaveBeenCalledWith(pdf, "hematology-reviewer.pdf"));
  });
});
