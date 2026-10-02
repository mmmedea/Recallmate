import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Footer } from "@/components/Footer";
import { PrivacyContent } from "@/components/legal/PrivacyContent";
import { TermsContent } from "@/components/legal/TermsContent";

describe("public legal content", () => {
  it("shows privacy disclosures, official rights guidance, and the shared contact", () => {
    render(<PrivacyContent />);

    expect(screen.getByRole("heading", { name: /information we process/i })).toBeTruthy();
    expect(screen.getByText(/Google Gemini, Anthropic \(Claude\), DeepSeek, and Groq/i)).toBeTruthy();
    expect(screen.getByText(/do not currently use third-party analytics or advertising trackers/i)).toBeTruthy();
    expect(screen.queryByText(/current app build does not load a third-party analytics or advertising tracker/i)).toBeNull();
    expect(screen.getByRole("link", { name: /National Privacy Commission/i }).getAttribute("href")).toBe(
      "https://privacy.gov.ph/data-subject-rights/",
    );
    const contactLinks = screen.getAllByRole("link", { name: "recallmate.verify@gmail.com" });
    expect(contactLinks.length).toBeGreaterThanOrEqual(1);
    contactLinks.forEach((link) => expect(link.getAttribute("href")).toBe("mailto:recallmate.verify@gmail.com"));
    expect(screen.getByText(/Account deletion removes your account and associated study records/i)).toBeTruthy();
    expect(screen.getByText(/Uploaded files can take additional time to be fully removed/i)).toBeTruthy();
    expect(screen.queryByText(/within 30 days/i)).toBeNull();
  });

  it("keeps terms aligned with the current credits/Premium model and shared contact", () => {
    render(<TermsContent />);

    expect(screen.getByRole("heading", { name: /credits and premium features/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: "recallmate.verify@gmail.com" }).getAttribute("href")).toBe(
      "mailto:recallmate.verify@gmail.com",
    );
    expect(screen.queryByText(/subscriptions are billed in advance on a recurring basis/i)).toBeNull();
  });

  it("provides a shared footer with the contact address", () => {
    render(<Footer />);

    expect(screen.getByRole("navigation", { name: "Footer" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Contact" }).getAttribute("href")).toBe(
      "mailto:recallmate.verify@gmail.com",
    );
  });
});
