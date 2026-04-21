import { describe, expect, it } from "vitest";

import { estimateTokens, estimateTokensForMessages } from "../src/tokens.js";

describe("estimateTokens", () => {
  it("returns 0 for empty input", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("scales roughly linearly with input size", () => {
    const small = estimateTokens("a".repeat(100));
    const big = estimateTokens("a".repeat(10_000));
    expect(big).toBeGreaterThan(small * 90);
    expect(big).toBeLessThan(small * 110);
  });

  it("counts code at a reasonable rate", () => {
    const code = "function foo(x) { return x + 1; }";
    const est = estimateTokens(code);
    // One-line function should fall in a sensible range
    expect(est).toBeGreaterThanOrEqual(8);
    expect(est).toBeLessThanOrEqual(20);
  });

  it("picks the larger of char- vs word-based estimate", () => {
    const natural = "the quick brown fox jumps over the lazy dog"; // 9 words
    const byChars = Math.ceil(natural.length / 4);
    const byWords = Math.ceil(9 / 0.75);
    expect(estimateTokens(natural)).toBe(Math.max(byChars, byWords));
  });
});

describe("estimateTokensForMessages", () => {
  it("sums per-message estimates", () => {
    const a = "hello there";
    const b = "general kenobi";
    expect(estimateTokensForMessages([a, b])).toBe(estimateTokens(a) + estimateTokens(b));
  });

  it("handles an empty list", () => {
    expect(estimateTokensForMessages([])).toBe(0);
  });
});
