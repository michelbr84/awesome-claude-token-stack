import { openDatabase } from "@acts/core";
import type { ActsDatabase } from "@acts/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  SIGNAL_WEIGHTS,
  computeQuality,
  gradeForScore,
  latestQuality,
  persistQuality,
} from "../src/quality.js";
import { startSession } from "../src/session.js";

let handle: ActsDatabase;

beforeEach(() => {
  handle = openDatabase({ memory: true });
});

afterEach(() => {
  handle.close();
});

describe("gradeForScore", () => {
  it("maps the standard bands", () => {
    expect(gradeForScore(100)).toBe("S");
    expect(gradeForScore(90)).toBe("S");
    expect(gradeForScore(89)).toBe("A");
    expect(gradeForScore(80)).toBe("A");
    expect(gradeForScore(70)).toBe("B");
    expect(gradeForScore(60)).toBe("C");
    expect(gradeForScore(50)).toBe("D");
    expect(gradeForScore(49)).toBe("F");
    expect(gradeForScore(0)).toBe("F");
  });
});

describe("computeQuality", () => {
  it("returns 100/S for all-ideal inputs", () => {
    const r = computeQuality({});
    expect(r.score).toBe(100);
    expect(r.grade).toBe("S");
  });

  it("returns 0/F for all-worst inputs", () => {
    const r = computeQuality({
      contextFill: 0,
      freshReads: 0,
      leanToolUse: 0,
      shallowCompact: 0,
      uniqueContent: 0,
      decisionDense: 0,
      agentEfficient: 0,
    });
    expect(r.score).toBe(0);
    expect(r.grade).toBe("F");
  });

  it("clamps out-of-range inputs", () => {
    const r = computeQuality({ contextFill: 2, freshReads: -1 });
    expect(r.signals.contextFill).toBe(1);
    expect(r.signals.freshReads).toBe(0);
  });

  it("weights sum to ~1", () => {
    const sum = Object.values(SIGNAL_WEIGHTS).reduce((s, w) => s + w, 0);
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
  });
});

describe("persistQuality + latestQuality", () => {
  it("round-trips through the database", () => {
    const sessionId = startSession(handle.db, { agent: "test", cwd: "/tmp" });
    const result = computeQuality({ contextFill: 0.8 });
    persistQuality(handle.db, sessionId, 1, result);

    const latest = latestQuality(handle.db, sessionId);
    expect(latest).not.toBeNull();
    expect(latest!.score).toBe(result.score);
    expect(latest!.grade).toBe(result.grade);
  });

  it("returns null when no scores exist", () => {
    expect(latestQuality(handle.db, "missing-session")).toBeNull();
  });
});
