import { openDatabase } from "@acts/core";
import type { ActsDatabase } from "@acts/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getMemory, indexMemory, searchMemory } from "../src/disclosure.js";
import { saveObservation, supersedeObservation } from "../src/observations.js";

let handle: ActsDatabase;

beforeEach(() => {
  handle = openDatabase({ memory: true });
  saveObservation(handle.db, {
    kind: "decision",
    title: "JWT auth",
    body: "We use JWT tokens signed with RS256. Tokens live 1h; refresh tokens live 30d.",
    tags: ["auth", "jwt"],
  });
  saveObservation(handle.db, {
    kind: "convention",
    title: "Naming: snake_case for DB",
    body: "All database columns use snake_case; all TypeScript fields use camelCase.",
    tags: ["naming", "db"],
  });
  saveObservation(handle.db, {
    kind: "bugfix",
    title: "Login race condition",
    body: "Two simultaneous logins could create duplicate sessions. Fixed with a DB unique constraint.",
    tags: ["auth", "bug"],
  });
});

afterEach(() => {
  handle.close();
});

describe("indexMemory (layer 1)", () => {
  it("returns id/kind/title/tags only", () => {
    const hits = indexMemory(handle.db, "auth");
    expect(hits.length).toBeGreaterThan(0);
    for (const hit of hits) {
      expect(hit).toHaveProperty("id");
      expect(hit).toHaveProperty("kind");
      expect(hit).toHaveProperty("title");
      expect(hit).toHaveProperty("tags");
      expect(hit).not.toHaveProperty("body");
    }
  });

  it("filters by kind", () => {
    const hits = indexMemory(handle.db, "auth", { kind: "decision" });
    expect(hits.every((h) => h.kind === "decision")).toBe(true);
  });

  it("excludes superseded observations", () => {
    const old = saveObservation(handle.db, {
      kind: "decision",
      title: "old auth",
      body: "deprecated",
    });
    const newer = saveObservation(handle.db, {
      kind: "decision",
      title: "new auth",
      body: "current",
    });
    supersedeObservation(handle.db, old.id, newer.id);
    const hits = indexMemory(handle.db, "auth");
    expect(hits.find((h) => h.id === old.id)).toBeUndefined();
  });
});

describe("searchMemory (layer 2)", () => {
  it("returns a summary body", () => {
    const hits = searchMemory(handle.db, "JWT");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.summary.length).toBeGreaterThan(0);
  });
});

describe("getMemory (layer 3)", () => {
  it("returns full body and bumps access count", () => {
    const [hit] = searchMemory(handle.db, "JWT");
    expect(hit).toBeDefined();
    const full = getMemory(handle.db, hit!.id);
    expect(full?.body).toContain("RS256");
  });

  it("returns null for unknown id", () => {
    expect(getMemory(handle.db, "nope")).toBeNull();
  });
});
