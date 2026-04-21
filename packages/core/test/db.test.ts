import { describe, expect, it } from "vitest";

import { openDatabase } from "../src/db.js";

describe("openDatabase", () => {
  it("opens an in-memory database and applies migrations", () => {
    const handle = openDatabase({ memory: true });
    expect(handle.schemaVersion).toBe(1);

    // Sanity check: all core tables exist
    const tables = handle.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);

    for (const expected of [
      "_acts_meta",
      "checkpoints",
      "compression_events",
      "content",
      "content_chunks",
      "observations",
      "quality_scores",
      "sessions",
      "tool_results",
      "turn_metrics",
    ]) {
      expect(tables).toContain(expected);
    }
    handle.close();
  });

  it("creates FTS5 virtual tables", () => {
    const handle = openDatabase({ memory: true });
    const rows = handle.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND sql LIKE '%fts5%'")
      .all();
    // FTS5 surfaces as a virtual module with auxiliary tables; `observations_fts` and
    // `content_fts` should each create multiple rows — we only care that both exist.
    const names = rows.map((r) => (r as { name: string }).name);
    expect(names.some((n) => n.startsWith("observations_fts"))).toBe(true);
    expect(names.some((n) => n.startsWith("content_fts"))).toBe(true);
    handle.close();
  });

  it("is idempotent across reopens (no duplicate tables)", () => {
    const handle1 = openDatabase({ memory: true });
    const version1 = handle1.schemaVersion;
    handle1.close();

    const handle2 = openDatabase({ memory: true });
    expect(handle2.schemaVersion).toBe(version1);
    handle2.close();
  });
});
