import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DocumentLifecycleSummary } from "@/app/actions/document-lifecycle";

const channel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  }),
}));

vi.mock("@/app/actions/document-actions", () => ({
  getDocumentLifecycle: vi.fn(),
}));

import WorkspaceClient from "@/app/(app)/documents/[id]/process/WorkspaceClient";

const summary: DocumentLifecycleSummary = {
  document: {
    id: "doc-1",
    filename: "Instrumentation.pdf",
    createdAt: "2026-08-31T00:00:00.000Z",
    status: "completed",
    errorMessage: null,
  },
  extraction: { status: "completed", errorMessage: null },
  notes: { status: "ready", outputId: "notes-1", errorMessage: null },
  quiz: { status: "ready", outputId: "quiz-1", errorMessage: null },
  chat: { status: "ready", lastDiscussedAt: null },
};

describe("processing workspace lifecycle contract", () => {
  it("renders a valid lifecycle summary without reading a nested document.extraction field", () => {
    render(<WorkspaceClient initialSummary={summary} />);
    expect(screen.getByRole("heading", { name: /processing workspace/i })).toBeDefined();
    expect(screen.getByText("Instrumentation.pdf")).toBeDefined();
  });
});
