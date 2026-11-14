import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const calendarMocks = vi.hoisted(() => ({
  getCalendarEvents: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

const topicsMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  order: vi.fn(),
}));

vi.mock("@/app/actions/calendar-actions", () => ({
  getCalendarEvents: calendarMocks.getCalendarEvents,
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: topicsMocks.getUser },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ order: topicsMocks.order })),
      })),
    })),
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
  redirect: vi.fn((destination: string) => {
    throw new Error(`REDIRECT:${destination}`);
  }),
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
    useAppStore.setState({ chatDrawerOpen: false });
    topicsMocks.getUser.mockResolvedValue({ data: { user: { id: "student-1" } } });
    topicsMocks.order.mockResolvedValue({ data: [], error: null });
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
    expect(await screen.findByRole("heading", { name: /detailed two-column reviewer/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /choose lesson file/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /download pdf/i })).toBeNull();
  });

  it("renders the authenticated library route with its current workspace actions", async () => {
    render(await TopicsPage());
    expect(screen.getByRole("heading", { name: "My Library" })).toBeDefined();
    expect(screen.getByRole("link", { name: /add material/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /create flashcards/i })).toBeDefined();
  });
});
