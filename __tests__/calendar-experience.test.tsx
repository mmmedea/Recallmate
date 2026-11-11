// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/calendar-actions", () => ({
  getCalendarEvents: vi.fn(async () => []),
  saveCalendarEvent: vi.fn(),
  deleteCalendarEvent: vi.fn(),
  toggleCalendarEventCompletion: vi.fn(),
}));
import YearCalendar from "@/components/calendar/YearCalendar";
import { navigationConfig } from "@/lib/navigation";

describe("responsive calendar experience", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/calendar");
  });

  it("offers working month, year, agenda, add-event, and Google sync controls", () => {
    render(<YearCalendar initialEvents={[]} initialYear={2026} />);
    expect(screen.getByRole("button", { name: /month view/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /year view/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /agenda view/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /sync google calendar/i })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /add event/i }));
    expect(screen.getByRole("heading", { name: /new event/i })).toBeTruthy();
  }, 60_000);

  it("starts Google Calendar sync through a direct server redirect link instead of fetching JSON", () => {
    render(<YearCalendar initialEvents={[]} initialYear={2026} />);
    const link = screen.getByRole("link", { name: /sync google calendar/i }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/api/integrations/google-calendar/connect");
  });

  it("keeps provider setup errors inside RecallMate after callback redirects", () => {
    window.history.pushState({}, "", "/calendar?google=error&reason=setup");
    render(<YearCalendar initialEvents={[]} initialYear={2026} />);
    expect(screen.getByRole("alert").textContent).toMatch(/could not start/i);
  });

  it("explains Calendar permission callback failures clearly", () => {
    window.history.pushState({}, "", "/calendar?google=error&reason=permission");
    render(<YearCalendar initialEvents={[]} initialYear={2026} />);
    expect(screen.getByRole("alert").textContent).toMatch(/Calendar permission was not granted/i);
  });

  it("keeps the Help center routed from authenticated navigation", () => {
    expect(navigationConfig.footer.find((item) => item.label === "Help")?.href).toBe("/help");
  });
});
