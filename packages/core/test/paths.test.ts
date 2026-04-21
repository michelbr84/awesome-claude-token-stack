import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveStoreDbPath, resolveStoreDir } from "../src/paths.js";

let tmpRoot: string;

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "acts-paths-"));
});

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true });
});

describe("resolveStoreDir", () => {
  it("finds an existing .acts in the start dir", () => {
    const actsDir = join(tmpRoot, ".acts");
    mkdirSync(actsDir);
    expect(resolveStoreDir({ startDir: tmpRoot })).toBe(actsDir);
  });

  it("walks up the tree to find a parent .acts", () => {
    const actsDir = join(tmpRoot, ".acts");
    mkdirSync(actsDir);
    const childDir = join(tmpRoot, "a", "b", "c");
    mkdirSync(childDir, { recursive: true });
    expect(resolveStoreDir({ startDir: childDir })).toBe(actsDir);
  });

  it("returns a fallback path when no .acts exists and create is false", () => {
    const result = resolveStoreDir({ startDir: tmpRoot });
    expect(result).toBe(join(tmpRoot, ".acts"));
    expect(existsSync(result)).toBe(false);
  });

  it("creates the directory when create is true", () => {
    const result = resolveStoreDir({ startDir: tmpRoot, create: true });
    expect(existsSync(result)).toBe(true);
  });
});

describe("resolveStoreDbPath", () => {
  it("appends store.db to the resolved dir", () => {
    const db = resolveStoreDbPath({ startDir: tmpRoot });
    expect(db).toBe(join(tmpRoot, ".acts", "store.db"));
  });
});
