// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/calendar-actions", () => ({
  getCalendarEvents: vi.fn(async () => []),
  saveCalendarEvent: vi.fn(),
  deleteCalendarEvent: vi.fn(),
  toggleCalendarEventCompletion: vi.fn(),
}));
vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOAuth: vi.fn(async () => ({ error: null })) } }),
}));

import YearCalendar from "@/components/calendar/YearCalendar";
import { navigationConfig } from "@/lib/navigation";

describe("responsive calendar experience", () => {
  it("offers working month, year, agenda, add-event, and Google sync controls", () => {
    render(<YearCalendar initialEvents={[]} initialYear={2026} />);
    expect(screen.getByRole("button", { name: /month view/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /year view/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /agenda view/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /sync google calendar/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /add event/i }));
    expect(screen.getByRole("heading", { name: /new event/i })).toBeTruthy();
  });

  it("keeps the Help center routed from authenticated navigation", () => {
    expect(navigationConfig.footer.find((item) => item.label === "Help")?.href).toBe("/help");
  });
});
