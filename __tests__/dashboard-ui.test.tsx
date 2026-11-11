// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardData } from "@/lib/dashboard/get-dashboard-data";

const deleteDocumentMock = vi.hoisted(() => vi.fn());
const navigationMock = vi.hoisted(() => ({
  search: "",
  replace: vi.fn(),
}));

vi.mock("@/app/actions/document-actions", () => ({
  deleteDocument: deleteDocumentMock,
}));

vi.mock('idb-keyval', () => ({ get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined), del: vi.fn().mockResolvedValue(undefined) }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ refresh: vi.fn(), replace: navigationMock.replace }),
  useSearchParams: () => new URLSearchParams(navigationMock.search),
}));

import { DashboardHome } from "@/components/dashboard/DashboardHome";
import { DeleteDocumentButton } from "@/components/dashboard/DeleteDocumentButton";
import { useAppStore } from '@/lib/store';

const baseDashboardData: DashboardData = {
  documents: [],
  documentsState: "ok",
  reviews: { total: 0, due: 0, overdue: 0, new: 0, nextDueAt: null },
  reviewsState: "ok",
  upcomingEvents: [],
  eventsState: "ok",
  recentQuizAttempts: [],
  quizState: "ok",
  economy: {
    coins: 1000,
    hearts: 18,
    heartCap: 15,
    streak: 3,
    longestStreak: 5,
    canRestoreStreak: false,
    restoreCostCoins: 200,
    canClaimDailyReward: true,
    lastClaimedDay: "2026-09-08",
    studyDay: "2026-09-09",
    state: "ok",
  },
};

describe("dashboard UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigationMock.search = "";
    useAppStore.setState({ chatDrawerOpen: false, medeaRequest: null });
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('opens the dashboard hero and suggestion in the canonical drawer', () => {
    render(<DashboardHome name="Maricris" data={{ ...baseDashboardData, economy: { ...baseDashboardData.economy, canClaimDailyReward: false } }} />);
    const buttons = screen.getAllByRole('button', { name: /^ask medea$/i });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    expect(useAppStore.getState().chatDrawerOpen).toBe(true);
    expect(useAppStore.getState().medeaRequest).toMatchObject({ source: 'dashboard' });
    expect(useAppStore.getState().medeaRequest?.documentId).toBeUndefined();
    fireEvent.click(buttons[1]);
    expect(useAppStore.getState().medeaRequest).toMatchObject({ source: 'dashboard' });
    expect(useAppStore.getState().medeaRequest?.suggestedPrompt).toBeTruthy();
    expect(screen.queryByRole('link', { name: /^ask medea$/i })).toBeNull();
  });

  it("renders the redesigned dashboard shell without exposing the build marker in the hero", () => {
    render(<DashboardHome name="Maricris" data={baseDashboardData} />);

    expect(screen.getByText(/study command center/i)).toBeTruthy();
    expect(screen.getByRole("heading", { name: /good day, maricris/i })).toBeTruthy();
    expect(screen.getByText(/your study space is ready/i)).toBeTruthy();
    expect(screen.queryByText("18/15")).toBeNull();
    expect(screen.getByRole("dialog", { name: /^streak$/i })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: /check in today/i })).toBeNull();
    expect(screen.getByText(/reset at 8:00 AM UTC\+8/i)).toBeTruthy();
    expect(screen.queryByText(/Philippines time|GMT\+8|8:00 AM PH/i)).toBeNull();
    expect(screen.queryByText(/Rewards can overflow; regen stops at 15/i)).toBeNull();
    expect(screen.queryByText(/Use for hearts and reviewers/i)).toBeNull();
    expect(screen.queryByText(/^Build /i)).toBeNull();
  });

  it("does not auto-open the daily reward modal after today's reward is claimed", () => {
    render(
      <DashboardHome
        name="Maricris"
        data={{
          ...baseDashboardData,
          economy: {
            ...baseDashboardData.economy,
            canClaimDailyReward: false,
            lastClaimedDay: "2026-09-09",
            studyDay: "2026-09-09",
          },
        }}
      />,
    );

    expect(screen.queryByRole("dialog", { name: /check in today/i })).toBeNull();
    expect(screen.queryByRole("dialog", { name: /^streak$/i })).toBeNull();
  });

  it("keeps the daily reward modal closed for the same UTC+8 reward day after a browser-recorded claim", () => {
    window.localStorage.setItem("recallmate:daily-reward-claimed:2026-09-09", "true");

    render(<DashboardHome name="Maricris" data={baseDashboardData} />);

    expect(screen.queryByRole("dialog", { name: /check in today/i })).toBeNull();
    expect(screen.getByRole("dialog", { name: /^streak$/i })).toBeTruthy();
  });

  it("opens the daily streak window separately from the daily reward window", () => {
    navigationMock.search = "streak=1";

    render(<DashboardHome name="Maricris" data={baseDashboardData} />);

    expect(screen.getByRole("dialog", { name: /^streak$/i })).toBeTruthy();
    expect(screen.getByText(/one goal\. every day\. keep the fire alive\./i)).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: /check in today/i })).toBeNull();
    expect(screen.getByRole("button", { name: /open daily reward/i })).toBeTruthy();
  });

  it("opens the daily reward window only after an explicit reward request", () => {
    navigationMock.search = "reward=1";

    render(<DashboardHome name="Maricris" data={baseDashboardData} />);

    expect(screen.getByRole("dialog", { name: /check in today/i })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: /^streak$/i })).toBeNull();
  });

  it("uses compact dashboard error and empty states", () => {
    render(
      <DashboardHome
        name="Maricris"
        data={{
          ...baseDashboardData,
          documentsState: "error",
          reviewsState: "error",
        }}
      />,
    );

    expect(screen.getByText("No recent materials are available.")).toBeTruthy();
    expect(screen.getByText("You're all caught up.")).toBeTruthy();
    expect(screen.getByText(/couldn't verify your library/i)).toBeTruthy();
    expect(screen.queryByText("Couldn't load recent materials.")).toBeNull();
    expect(screen.queryByText(/Other dashboard sections are still available/i)).toBeNull();
    expect(screen.queryByText(/Try refreshing or opening Topics/i)).toBeNull();
  });

  it("replaces the hero counters with the authoritative clickable streak", () => {
    const { rerender } = render(<DashboardHome name="Maricris" data={baseDashboardData} />);
    const streak = screen.getByRole("link", { name: "Open daily streak" });
    expect(streak.getAttribute("href")).toBe("/dashboard?streak=1");
    expect(streak.textContent).toContain("3");
    expect(screen.queryByText(/^Ready$/i)).toBeNull();
    rerender(<DashboardHome name="Maricris" data={{ ...baseDashboardData, economy: { ...baseDashboardData.economy, state: "unavailable" } }} />);
    expect(screen.getByRole("link", { name: "Open daily streak" }).textContent).toContain("—");
  });

  it("requires confirmation before deleting a dashboard document", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    render(<DeleteDocumentButton documentId="doc-1" filename="Hematology.pdf" />);

    fireEvent.click(screen.getByRole("button", { name: /delete hematology\.pdf/i }));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Delete "Hematology.pdf"?'));
    expect(deleteDocumentMock).not.toHaveBeenCalled();
  });
});
