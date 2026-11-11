import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calendarMocks = vi.hoisted(() => ({
  getCalendarEvents: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("@/app/actions/calendar-actions", () => ({
  getCalendarEvents: calendarMocks.getCalendarEvents,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

vi.mock("idb-keyval", () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}));

import CalendarPage from "@/app/(app)/calendar/page";
import NotesPage from "@/app/(app)/notes/page";
import TopicsPage from "@/app/(app)/topics/page";
import { useAppStore } from "@/lib/store";

describe("study workspace navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    useAppStore.setState({ chatDrawerOpen: false, medeaRequest: null });
  });

  it("renders the calendar workspace even when event storage is temporarily unavailable", async () => {
    calendarMocks.getCalendarEvents.mockRejectedValueOnce(new Error("calendar_events unavailable"));
    render(await CalendarPage());

    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
    expect(screen.getByText(/could not load saved events/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /add event/i })).toBeDefined();
  }, 10_000);

  it("keeps Notes open with editable notes and reviewer maker tools", async () => {
    render(<NotesPage />);

    await waitFor(() => expect(routerMocks.push).not.toHaveBeenCalled());
    expect(screen.getByRole("heading", { name: /study notes & reviewer maker/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /editable notes/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /upload a lesson to generate editable notes/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /explore study tools/i })).toBeNull();
  });

  it("opens reviewer creation inside Study Notes", async () => {
    render(<NotesPage />);
    fireEvent.click(screen.getByRole("tab", { name: /reviewer maker/i }));
    expect(await screen.findByRole("heading", { name: /exam-ready pdf & docx reviewer/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /upload study materials/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /download pdf/i })).toBeNull();
  });

  it("opens the Medea chat drawer from the Ask Medea topic card", () => {
    render(<TopicsPage />);
    fireEvent.click(screen.getByRole("button", { name: /ask medea/i }));
    expect(useAppStore.getState().chatDrawerOpen).toBe(true);
    expect(useAppStore.getState().medeaRequest).toMatchObject({ source: "topics" });
    expect(useAppStore.getState().medeaRequest?.documentId).toBeUndefined();
  });
});
