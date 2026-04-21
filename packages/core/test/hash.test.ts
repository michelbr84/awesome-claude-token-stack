import { describe, expect, it } from "vitest";

import { sha256, shortHash } from "../src/hash.js";

describe("sha256", () => {
  it("is stable for the same input", () => {
    expect(sha256("hello")).toBe(sha256("hello"));
  });

  it("produces 64-char hex output", () => {
    const digest = sha256("anything");
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for different inputs", () => {
    expect(sha256("a")).not.toBe(sha256("b"));
  });
});

describe("shortHash", () => {
  it("defaults to 12 chars", () => {
    expect(shortHash("foo")).toHaveLength(12);
  });

  it("clamps very short requests to 4 chars", () => {
    expect(shortHash("foo", 1)).toHaveLength(4);
  });

  it("is a prefix of the full sha256", () => {
    const full = sha256("foo");
    expect(full.startsWith(shortHash("foo"))).toBe(true);
  });
});
