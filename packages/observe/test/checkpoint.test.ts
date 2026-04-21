import { openDatabase } from "@acts/core";
import type { ActsDatabase } from "@acts/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createCheckpoint,
  deleteCheckpoint,
  getCheckpoint,
  listCheckpoints,
} from "../src/checkpoint.js";
import { startSession } from "../src/session.js";

let handle: ActsDatabase;

beforeEach(() => {
  handle = openDatabase({ memory: true });
});

afterEach(() => {
  handle.close();
});

describe("checkpoints", () => {
  it("creates, lists, and gets checkpoints", () => {
    const sessionId = startSession(handle.db, { agent: "x", cwd: "/y" });
    const cp = createCheckpoint(handle.db, {
      sessionId,
      contextFill: 0.35,
      label: "mid-session",
      payload: { note: "checkpoint contents" },
    });
    expect(cp.id).toMatch(/^[0-9a-f]{12}$/);
    expect(cp.payload).toEqual({ note: "checkpoint contents" });

    const list = listCheckpoints(handle.db, sessionId);
    expect(list.length).toBe(1);
    expect(list[0]!.id).toBe(cp.id);

    const fetched = getCheckpoint(handle.db, cp.id);
    expect(fetched?.label).toBe("mid-session");
  });

  it("deletes checkpoints", () => {
    const sessionId = startSession(handle.db, { agent: "x", cwd: "/y" });
    const cp = createCheckpoint(handle.db, {
      sessionId,
      contextFill: 0.2,
      payload: {},
    });
    expect(deleteCheckpoint(handle.db, cp.id)).toBe(true);
    expect(getCheckpoint(handle.db, cp.id)).toBeNull();
  });
});
