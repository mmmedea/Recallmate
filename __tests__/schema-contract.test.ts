// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("document schema contract", () => {
  it("ships an idempotent migration for fields required by uploads and document chat", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260830030000_document_upload_contract.sql"), "utf8");
    expect(migration).toMatch(/add column if not exists content_type text/i);
    expect(migration).toMatch(/add column if not exists title text/i);
  });
});
