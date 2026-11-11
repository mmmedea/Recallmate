// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { RECALLMATE_PRODUCTION_ORIGIN } from "@/lib/app-origin";

const serverClient = vi.hoisted(() => ({
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
}));
const mockStore = vi.hoisted(() => ({
  setMobileNavOpen: vi.fn(),
  setChatDrawerOpen: vi.fn(),
  openMedea: vi.fn(),
  medeaRequest: null,
  hearts: 15,
  isPremium: false,
  lastHeartLostAt: null,
  regenHearts: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(serverClient),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((destination: string) => { throw new Error(`REDIRECT:${destination}`); }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/FeynmanRechargeModal", () => ({ default: () => null }));
vi.mock("@/components/shell/AccountMenu", () => ({ AccountMenu: () => null }));
vi.mock("@/components/shell/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/ThemeToggle", () => ({ default: () => null }));
vi.mock("@/components/PremiumModal", () => ({
  default: ({ open }: { open: boolean }) => open ? <div role="dialog">Premium modal</div> : null,
}));
vi.mock("@/lib/store", () => ({
  useAppStore: (selector?: (state: typeof mockStore) => unknown) =>
    selector ? selector(mockStore) : mockStore,
}));

import ChatPage from "@/app/(app)/chat/page";
import HomePage from "@/app/page";
import DemoPage from "@/app/demo/page";
import { TopBar } from "@/components/shell/TopBar";
import Navbar from "@/components/Navbar";

describe("production regressions", () => {
  it("awaits the server Supabase client before reading the chat user", async () => {
    await expect(ChatPage({ searchParams: {} })).rejects.toThrow("REDIRECT:/login");
    expect(serverClient.auth.getUser).toHaveBeenCalled();
  });

  it("shows the full account economy strip without falling back to credits", () => {
    render(
      <TopBar
        user={{ id: "student-1", email: "student@example.com" }}
        credits={{ available: 0 }}
        economy={{ coins: 1500, hearts: 15, heartCap: 15, streak: 6, state: "ok" }}
      />,
    );
    expect(screen.getByLabelText("Hearts: 15/15")).toBeTruthy();
    expect(screen.getByLabelText("Coins: 1,500")).toBeTruthy();
    expect(screen.getByLabelText("Streak: 6")).toBeTruthy();
    expect(screen.getByLabelText("Streak: 6").getAttribute("href")).toBe("/dashboard?streak=1");
    expect(screen.getByLabelText("Hearts: 15/15").querySelector("svg")).toBeTruthy();
    expect(screen.getByLabelText("Streak: 6").querySelector("svg")).toBeTruthy();
    expect(screen.getByLabelText("Hearts: 15/15").querySelector("svg")?.getAttribute("class")).toContain("fill-rose-500");
    expect(screen.getByLabelText("Streak: 6").querySelector("svg")?.getAttribute("class")).toContain("fill-orange-500");
  });

  it("does not invent wallet values when economy is unavailable", () => {
    render(<TopBar user={{ id: "student-1", email: "student@example.com" }} credits={{ available: 0 }} />);
    expect(screen.getByLabelText("Hearts: —")).toBeTruthy();
    expect(screen.getByLabelText("Coins: —")).toBeTruthy();
    expect(screen.getByLabelText("Streak: —")).toBeTruthy();
    expect(screen.queryByTitle("15/15 Hearts Full")).toBeNull();
  });

  it("does not show a fake hearts balance to signed-out landing visitors", () => {
    render(<Navbar />);
    expect(screen.queryByText("15/15")).toBeNull();
    expect(screen.queryByTitle("15/15 Hearts Full")).toBeNull();
  });

  it("shows demo CTA and product proof on the landing page without fake hearts", () => {
    render(<HomePage />);
    expect(screen.getByRole("link", { name: /try demo/i })).toBeTruthy();
    expect(screen.getByText(/quiz preview/i)).toBeTruthy();
    expect(screen.getByText(/reviewer preview/i)).toBeTruthy();
    expect(screen.queryByText("15/15")).toBeNull();
  });

  it("uses PNG as the primary social preview image", () => {
    const layoutSource = readFileSync("app/layout.tsx", "utf8");
    const expectedImageUrl = new URL("/og-image.png", RECALLMATE_PRODUCTION_ORIGIN).toString();

    expect(expectedImageUrl).toBe("https://recallmate-ai.vercel.app/og-image.png");
    expect(layoutSource).toContain('const OG_IMAGE_URL = new URL("/og-image.png", SITE_URL).toString();');
    expect(layoutSource).toContain("url: OG_IMAGE_URL");
    expect(layoutSource).toContain("images: [OG_IMAGE_URL]");
  });

  it("renders a safe static demo without upload controls", () => {
    render(<DemoPage />);
    expect(screen.getByText(/safe sample demo/i)).toBeTruthy();
    expect(screen.getByText(/does not call the AI generation pipeline/i)).toBeTruthy();
    expect(screen.queryByText(/drop a file or click to upload/i)).toBeNull();
  });

  it("opens the premium dialog from the authenticated top bar", () => {
    render(<TopBar user={{ id: "student-1", email: "student@example.com" }} credits={{ available: 0 }} />);
    fireEvent.click(screen.getByRole("button", { name: /go premium/i }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("keeps Medea visible in the authenticated top bar", () => {
    render(<TopBar user={{ id: "student-1", email: "student@example.com" }} credits={{ available: 0 }} />);
    expect(screen.getByRole("button", { name: /open medea ai/i })).toBeTruthy();
  });
});
