import { openDatabase } from "@acts/core";
import type { ActsDatabase } from "@acts/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { decayValidity, pruneExpired } from "../src/decay.js";
import { listObservations, saveObservation } from "../src/observations.js";

let handle: ActsDatabase;

beforeEach(() => {
  handle = openDatabase({ memory: true });
});

afterEach(() => {
  handle.close();
});

describe("pruneExpired", () => {
  it("deletes observations whose TTL has elapsed", () => {
    saveObservation(handle.db, {
      kind: "note",
      title: "short-lived",
      body: "body",
      ttlSeconds: 1,
    });
    // Wait-less: tell prune it's 10 minutes later.
    const future = Date.now() + 10 * 60 * 1000;
    const result = pruneExpired(handle.db, future);
    expect(result.deleted).toBe(1);
    expect(listObservations(handle.db).length).toBe(0);
  });

  it("keeps observations with no TTL", () => {
    saveObservation(handle.db, { kind: "convention", title: "forever", body: "x" });
    const result = pruneExpired(handle.db, Date.now() + 10 * 365 * 24 * 3600 * 1000);
    expect(result.deleted).toBe(0);
  });
});

describe("decayValidity", () => {
  it("decays validity of stale observations toward minValidity", () => {
    const obs = saveObservation(handle.db, {
      kind: "note",
      title: "old",
      body: "x",
      validity: 1.0,
    });
    const future = Date.now() + 30 * 24 * 3600 * 1000; // +30 days
    const result = decayValidity(handle.db, { factorPerWeek: 0.5, now: future });
    expect(result.updated).toBe(1);
    const stored = listObservations(handle.db);
    expect(stored[0]!.id).toBe(obs.id);
    expect(stored[0]!.validity).toBeLessThan(1.0);
  });

  it("does not decay observations accessed within a week", () => {
    saveObservation(handle.db, { kind: "note", title: "fresh", body: "x" });
    const result = decayValidity(handle.db, { factorPerWeek: 0.5 });
    expect(result.updated).toBe(0);
  });
});
