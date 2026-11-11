import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), economy: vi.fn() }));
vi.mock("@/utils/supabase/server", () => ({ createClient: async () => ({ from: mocks.from }) }));
vi.mock("@/lib/economy/server", () => ({ getEconomySnapshot: mocks.economy, ECONOMY_FALLBACK: { state: "unavailable" } }));
import { getDashboardData } from "@/lib/dashboard/get-dashboard-data";

describe("dashboard production query compatibility", () => {
  let documentError: unknown;
  beforeEach(() => {
    documentError = null;
    mocks.economy.mockResolvedValue({ state: "ok", streak: 7 });
    mocks.from.mockImplementation((table: string) => {
      let selection = "";
      const query: any = {
        select: (value: string) => { selection = value; return query; },
        eq: () => query, order: () => query, gte: () => query, lt: () => query,
        limit: () => {
          if (table !== "documents") return Promise.resolve({ data: [], error: null });
          // Match the real production schema: ai_jobs has no error_message.
          const invalid = /ai_jobs\s*\([^)]*error_message/.test(selection);
          const error = invalid ? { code: "42703" } : documentError;
          return Promise.resolve({ error, data: error ? null : [{
            id: "doc-1", filename: "Lesson.pdf", created_at: "2026-09-10T00:00:00Z",
            status: "completed", ai_jobs: [], notes: [], questions: [], conversations: [],
          }] });
        },
      };
      return query;
    });
  });

  it("loads recent materials using columns available in production", async () => {
    const result = await getDashboardData("user-1");
    expect(result.documentsState).toBe("ok");
    expect(result.documents[0].document.filename).toBe("Lesson.pdf");
    expect(result.economy.streak).toBe(7);
    expect(result.reviewsState).toBe("ok");
    expect(result.reviews.due).toBe(0);
  });

  it("retains failure state and logs a safe code instead of private content", async () => {
    documentError = { code: "42501", message: "private study content" };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await getDashboardData("user-1");
      expect(result.documentsState).toBe("error");
      expect(result.documents).toEqual([]);
      expect(log).toHaveBeenCalledWith("dashboard_query_failed", { section: "recent_materials", code: "42501" });
      expect(JSON.stringify(log.mock.calls)).not.toContain("private study content");
    } finally { log.mockRestore(); }
  });
});
