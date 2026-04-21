import { openDatabase } from "@acts/core";
import type { ActsDatabase } from "@acts/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  endSession,
  getSessionStats,
  listSessions,
  recordTurn,
  startSession,
} from "../src/session.js";

let handle: ActsDatabase;

beforeEach(() => {
  handle = openDatabase({ memory: true });
});

afterEach(() => {
  handle.close();
});

describe("startSession / endSession", () => {
  it("creates a session with a stable id", () => {
    const id = startSession(handle.db, { agent: "claude", cwd: "/tmp" });
    expect(id).toMatch(/^[0-9a-f]{16}$/);
  });

  it("ends the session and sets ended_at", () => {
    const id = startSession(handle.db, { agent: "claude", cwd: "/tmp" });
    expect(endSession(handle.db, id)).toBe(true);
    // Ending again is a no-op
    expect(endSession(handle.db, id)).toBe(false);
  });
});

describe("recordTurn + getSessionStats", () => {
  it("aggregates turn metrics", () => {
    const id = startSession(handle.db, { agent: "claude", cwd: "/tmp" });
    recordTurn(handle.db, {
      sessionId: id,
      turnIndex: 1,
      inputTokens: 1000,
      outputTokens: 200,
      toolTokens: 50,
      contextFill: 0.1,
    });
    recordTurn(handle.db, {
      sessionId: id,
      turnIndex: 2,
      inputTokens: 500,
      outputTokens: 100,
      toolTokens: 10,
      contextFill: 0.2,
    });
    const stats = getSessionStats(handle.db, id);
    expect(stats).not.toBeNull();
    expect(stats!.turns).toBe(2);
    expect(stats!.totalInputTokens).toBe(1500);
    expect(stats!.totalOutputTokens).toBe(300);
    expect(stats!.avgContextFill).toBeCloseTo(0.15, 5);
  });
});

describe("listSessions", () => {
  it("returns sessions ordered newest-first", () => {
    startSession(handle.db, { agent: "a", cwd: "/a" });
    startSession(handle.db, { agent: "b", cwd: "/b" });
    const list = listSessions(handle.db);
    expect(list.length).toBe(2);
    expect(list[0]!.started_at).toBeGreaterThanOrEqual(list[1]!.started_at);
  });
});
