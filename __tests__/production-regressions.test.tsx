// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const serverClient = vi.hoisted(() => ({
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(serverClient),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((destination: string) => { throw new Error(`REDIRECT:${destination}`); }),
  usePathname: () => "/dashboard",
}));
vi.mock("@/components/FeynmanRechargeModal", () => ({ default: () => null }));
vi.mock("@/components/shell/AccountMenu", () => ({ AccountMenu: () => null }));
vi.mock("@/components/shell/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/ThemeToggle", () => ({ default: () => null }));
vi.mock("@/lib/store", () => ({
  useAppStore: () => ({
    setMobileNavOpen: vi.fn(), hearts: 15, isPremium: false, lastHeartLostAt: null, regenHearts: vi.fn(),
  }),
}));

import ChatPage from "@/app/(app)/chat/page";
import { TopBar } from "@/components/shell/TopBar";

describe("production regressions", () => {
  it("awaits the server Supabase client before reading the chat user", async () => {
    await expect(ChatPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/login");
    expect(serverClient.auth.getUser).toHaveBeenCalled();
  });

  it("shows quiz hearts as 15/15 rather than the account credit balance", () => {
    render(<TopBar user={{ id: "student-1", email: "student@example.com" }} credits={{ available: 0 }} />);
    expect(screen.getByText("15/15")).toBeTruthy();
    expect(screen.getByTitle("15/15 Hearts Full")).toBeTruthy();
  });
});
