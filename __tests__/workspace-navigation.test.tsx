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

import CalendarPage from "@/app/(app)/calendar/page";
import NotesPage from "@/app/(app)/notes/page";

describe("study workspace navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("renders the calendar workspace even when event storage is temporarily unavailable", async () => {
    calendarMocks.getCalendarEvents.mockRejectedValueOnce(new Error("calendar_events unavailable"));
    render(await CalendarPage());

    expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
    expect(screen.getByText(/could not load saved events/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /add event/i })).toBeDefined();
  }, 10_000);

  it("keeps Notes open with a useful empty state instead of silently redirecting", async () => {
    render(<NotesPage />);

    await waitFor(() => expect(routerMocks.push).not.toHaveBeenCalled());
    expect(screen.getByRole("heading", { name: /study notes/i })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /upload study material/i }));
    expect(routerMocks.push).toHaveBeenCalledWith("/upload");
  });

  it("offers reviewer PDF creation from Study Notes", async () => {
    render(<NotesPage />);
    expect(await screen.findByRole("button", { name: /create reviewer pdf/i })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /create reviewer pdf/i }));
    expect(routerMocks.push).toHaveBeenCalledWith("/upload?mode=reviewer");
  });
});
