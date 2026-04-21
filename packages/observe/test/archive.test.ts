import { openDatabase } from "@acts/core";
import type { ActsDatabase } from "@acts/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { archiveToolResult, getArchivedResult, listArchivedResults } from "../src/archive.js";
import { startSession } from "../src/session.js";

let handle: ActsDatabase;

beforeEach(() => {
  handle = openDatabase({ memory: true });
});

afterEach(() => {
  handle.close();
});

describe("archiveToolResult", () => {
  it("stores and returns a record with an id", () => {
    const { record, hint } = archiveToolResult(handle.db, {
      toolName: "ReadFile",
      input: { path: "/tmp/x" },
      output: "hello world",
    });
    expect(record.id).toMatch(/^[0-9a-f]{12}$/);
    expect(hint).toContain("acts-archive");
  });

  it("marks long output as truncated", () => {
    const big = "x".repeat(100_000);
    const { record, hint } = archiveToolResult(handle.db, {
      toolName: "Grep",
      input: { pattern: "x" },
      output: big,
    });
    expect(record.truncated).toBe(true);
    expect(hint).toContain("full output archived");
  });

  it("retrieves by id", () => {
    const { record } = archiveToolResult(handle.db, {
      toolName: "Read",
      input: {},
      output: "content",
    });
    const retrieved = getArchivedResult(handle.db, record.id);
    expect(retrieved?.output).toBe("content");
  });
});

describe("listArchivedResults", () => {
  it("filters by session id when provided", () => {
    const sessA = startSession(handle.db, { agent: "a", cwd: "/tmp" });
    const sessB = startSession(handle.db, { agent: "b", cwd: "/tmp" });
    archiveToolResult(handle.db, {
      toolName: "Read",
      input: {},
      output: "a",
      sessionId: sessA,
    });
    archiveToolResult(handle.db, {
      toolName: "Read",
      input: {},
      output: "b",
      sessionId: sessB,
    });
    const a = listArchivedResults(handle.db, { sessionId: sessA });
    expect(a.length).toBe(1);
    expect(a[0]!.output).toBe("a");
  });
});
