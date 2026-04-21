import { openDatabase } from "@acts/core";
import type { ActsDatabase } from "@acts/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  deleteObservation,
  getObservation,
  listObservations,
  saveObservation,
  supersedeObservation,
} from "../src/observations.js";

let handle: ActsDatabase;

beforeEach(() => {
  handle = openDatabase({ memory: true });
});

afterEach(() => {
  handle.close();
});

describe("saveObservation", () => {
  it("creates a new observation and assigns an id", () => {
    const obs = saveObservation(handle.db, {
      kind: "decision",
      title: "Use MIT",
      body: "MIT is permissive and broadly compatible.",
      tags: ["license", "legal"],
    });
    expect(obs.id).toMatch(/^[0-9a-f]{16}$/);
    expect(obs.tags).toContain("license");
  });

  it("upserts when (kind,title) match existing", () => {
    const a = saveObservation(handle.db, {
      kind: "convention",
      title: "Tests live in test/",
      body: "Original body",
    });
    const b = saveObservation(handle.db, {
      kind: "convention",
      title: "Tests live in test/",
      body: "Updated body",
    });
    expect(a.id).toBe(b.id);
    expect(b.body).toBe("Updated body");
  });
});

describe("getObservation", () => {
  it("returns null for unknown id", () => {
    expect(getObservation(handle.db, "nope")).toBeNull();
  });

  it("bumps access_count on read", () => {
    const obs = saveObservation(handle.db, {
      kind: "note",
      title: "Hi",
      body: "body",
    });
    expect(obs.accessCount).toBe(0);
    const read1 = getObservation(handle.db, obs.id);
    expect(read1?.accessCount).toBe(1);
    const read2 = getObservation(handle.db, obs.id);
    expect(read2?.accessCount).toBe(2);
  });
});

describe("listObservations", () => {
  it("filters by kind", () => {
    saveObservation(handle.db, { kind: "decision", title: "A", body: "a" });
    saveObservation(handle.db, { kind: "note", title: "B", body: "b" });
    const decisions = listObservations(handle.db, { kind: "decision" });
    expect(decisions.length).toBe(1);
    expect(decisions[0]!.kind).toBe("decision");
  });

  it("filters by tag (substring-JSON match)", () => {
    saveObservation(handle.db, {
      kind: "pattern",
      title: "with tag",
      body: "b",
      tags: ["alpha", "beta"],
    });
    saveObservation(handle.db, { kind: "pattern", title: "no tag", body: "b" });
    const matching = listObservations(handle.db, { tag: "beta" });
    expect(matching.length).toBe(1);
    expect(matching[0]!.tags).toContain("beta");
  });

  it("excludes superseded by default", () => {
    const a = saveObservation(handle.db, { kind: "decision", title: "old", body: "x" });
    const b = saveObservation(handle.db, { kind: "decision", title: "new", body: "y" });
    supersedeObservation(handle.db, a.id, b.id);
    const live = listObservations(handle.db);
    expect(live.find((o) => o.id === a.id)).toBeUndefined();
    const all = listObservations(handle.db, { includeSuperseded: true });
    expect(all.find((o) => o.id === a.id)).toBeDefined();
  });
});

describe("deleteObservation", () => {
  it("removes rows and returns true", () => {
    const obs = saveObservation(handle.db, { kind: "todo", title: "delete me", body: "b" });
    expect(deleteObservation(handle.db, obs.id)).toBe(true);
    expect(getObservation(handle.db, obs.id)).toBeNull();
  });
});
