import { openDatabase } from "@acts/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ActsDatabase } from "@acts/core";

import { getContent, indexContent, listContent } from "../src/indexer.js";
import { searchContent } from "../src/search.js";

let handle: ActsDatabase;

beforeEach(() => {
  handle = openDatabase({ memory: true });
});

afterEach(() => {
  handle.close();
});

describe("indexContent", () => {
  it("stores content and splits into chunks", () => {
    const text = Array.from({ length: 20 }, (_, i) => `Paragraph ${i}.`).join("\n\n");
    const result = indexContent(handle.db, {
      source: "docs/foo.md",
      text,
      title: "Foo",
      chunkSize: 500,
    });
    expect(result.chunks).toBeGreaterThanOrEqual(1);
    const rec = getContent(handle.db, result.id);
    expect(rec).not.toBeNull();
    expect(rec?.source).toBe("docs/foo.md");
  });

  it("is idempotent for unchanged content", () => {
    const input = { source: "s", text: "hello world" };
    const a = indexContent(handle.db, input);
    const b = indexContent(handle.db, input);
    expect(a.id).toBe(b.id);
    expect(b.replaced).toBe(false);
  });

  it("replaces content when the hash changes", () => {
    const a = indexContent(handle.db, { source: "s", text: "first" });
    const b = indexContent(handle.db, { source: "s", text: "second" });
    expect(b.replaced).toBe(true);
    expect(b.contentHash).not.toBe(a.contentHash);
  });

  it("lists content ordered by most recent first", () => {
    indexContent(handle.db, { source: "a", text: "a" });
    indexContent(handle.db, { source: "b", text: "b" });
    const items = listContent(handle.db);
    expect(items.length).toBe(2);
    expect(items[0]!.source).toBe("b");
  });
});

describe("searchContent", () => {
  it("finds chunks via FTS5 BM25", () => {
    indexContent(handle.db, {
      source: "one.md",
      text: "alpha beta gamma",
    });
    indexContent(handle.db, {
      source: "two.md",
      text: "delta epsilon gamma",
    });
    const hits = searchContent(handle.db, "gamma");
    expect(hits.length).toBe(2);
    expect(hits[0]!.snippet).toContain("gamma");
  });

  it("filters by source", () => {
    indexContent(handle.db, { source: "keep", text: "needle" });
    indexContent(handle.db, { source: "drop", text: "needle" });
    const hits = searchContent(handle.db, "needle", { source: "keep" });
    expect(hits.length).toBe(1);
    expect(hits[0]!.source).toBe("keep");
  });

  it("returns [] for empty queries", () => {
    expect(searchContent(handle.db, "")).toEqual([]);
  });

  it("handles FTS operator tokens without crashing", () => {
    indexContent(handle.db, { source: "x", text: "something to find" });
    const hits = searchContent(handle.db, "AND OR NOT find");
    expect(hits.length).toBeGreaterThan(0);
  });
});
