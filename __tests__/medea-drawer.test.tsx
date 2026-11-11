import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/store", () => ({
  useAppStore: () => ({
    isPremium: false,
    activeChatContext: [],
    addChatContext: vi.fn(),
    chatDrawerOpen: true,
    setChatDrawerOpen: vi.fn(),
  }),
}));

import OmniChatDrawer from "@/components/OmniChatDrawer";

describe("Medea drawer", () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("shows one unified Medea AI experience without separate mode tabs", async () => {
    render(<OmniChatDrawer />);

    expect(await screen.findByText("Medea AI", { selector: "h2" })).toBeTruthy();
    expect(screen.getByText("One assistant for every subject")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Tutor" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Socratic" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Dictionary" })).toBeNull();
  });
});
