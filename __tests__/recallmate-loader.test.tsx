import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecallMateBrandLogo } from "@/components/brand/RecallMateLogo";
import { RecallMateLogoReveal } from "@/components/brand/RecallMateLogoReveal";
import RecallMateLoader from "@/components/brand/RecallMateLoader";

describe("RecallMateLoader", () => {
  it("uses the canonical uploaded logo asset instead of the old drawn mark", () => {
    const { container } = render(<RecallMateBrandLogo size="md" animated={false} showWordmark />);

    const logo = container.querySelector("img");
    expect(logo?.getAttribute("src")).toContain("recallmate-logo-ui.png");
    expect(screen.queryByText("R")).toBeNull();
  });

  it("renders the Recall Core brand loader with stage labels", () => {
    render(
      <RecallMateLoader
        title="Creating your quiz"
        status="Generating 20 hard questions"
        steps={[
          "Saving the original lesson file",
          "Extracting source text safely",
          "Generating 20 hard questions",
          "Checking answers and explanations",
        ]}
      />
    );

    expect(screen.getByRole("status").textContent).toContain("Recall Core");
    expect(screen.getByText("Creating your quiz")).toBeTruthy();
    expect(screen.getAllByText("Generating 20 hard questions").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Checking answers and explanations")).toBeTruthy();
  });

  it("does not invent a percentage when the caller has no real percent", () => {
    render(
      <RecallMateLoader
        title="Creating your reviewer"
        status="Formatting reviewer"
        steps={["Reading sources", "Formatting reviewer", "Preparing download"]}
      />
    );

    expect(screen.queryByText("Known progress")).toBeNull();
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("shows a percentage only when provided by the caller", () => {
    render(
      <RecallMateLoader
        title="Processing Workspace"
        status="Formatting pages"
        percent={68}
        steps={["Reading material", "Formatting pages", "Finalizing"]}
      />
    );

    expect(screen.getByText("Known progress")).toBeTruthy();
    expect(screen.getByText("68%")).toBeTruthy();
  });

  it("renders the dedicated logo reveal without generation progress copy", () => {
    render(<RecallMateLogoReveal caption="Opening your dashboard" />);

    expect(screen.getByRole("status").textContent).toContain("RecallMate");
    expect(screen.getByText("Opening your dashboard")).toBeTruthy();
    expect(screen.queryByText("Known progress")).toBeNull();
  });
});
