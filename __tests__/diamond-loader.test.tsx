import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiamondLoader } from "@/components/DiamondLoader";

describe("DiamondLoader", () => {
  it("renders the full-page loading variant with an accessible status", () => {
    const { container } = render(
      <DiamondLoader
        variant="page"
        label="Preparing Medea"
        sublabel="Loading your workspace"
      />,
    );

    expect(screen.getByRole("status", { name: "Preparing Medea" })).toBeTruthy();
    expect(screen.getByText("Loading your workspace")).toBeTruthy();
    expect(container.querySelector('[data-variant="page"]')).toBeTruthy();
  });

  it("supports contextual section loaders and supplementary progress content", () => {
    render(
      <DiamondLoader variant="section" label="Processing file">
        <span>Extracting document text</span>
      </DiamondLoader>,
    );

    expect(screen.getByRole("status", { name: "Processing file" })).toBeTruthy();
    expect(screen.getByText("Extracting document text")).toBeTruthy();
  });

  it("renders a compact inline diamond for button and action states", () => {
    const { container } = render(
      <button type="button">
        <DiamondLoader variant="inline" label="Saving profile" />
        Saving…
      </button>,
    );

    expect(screen.getByRole("status", { name: "Saving profile" })).toBeTruthy();
    expect(container.querySelector('[data-variant="inline"]')).toBeTruthy();
    expect(container.querySelector('[data-variant="inline"]')?.tagName).toBe("SPAN");
  });

  it("can render a decorative inline diamond without a nested status announcement", () => {
    const { container } = render(
      <div role="status">
        <DiamondLoader variant="inline" decorative label="Working on step" />
      </div>,
    );

    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(container.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });
});
