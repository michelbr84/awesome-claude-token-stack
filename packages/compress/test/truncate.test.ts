import { describe, expect, it } from "vitest";

import { truncateMiddle } from "../src/truncate.js";

describe("truncateMiddle", () => {
  it("returns short text unchanged", () => {
    expect(truncateMiddle("hello")).toBe("hello");
  });

  it("keeps head and tail and marks omitted lines", () => {
    const lines = Array.from({ length: 200 }, (_, i) => `line ${i}`);
    const result = truncateMiddle(lines.join("\n"), {
      maxChars: 100,
      headLines: 3,
      tailLines: 3,
    });
    expect(result).toContain("line 0");
    expect(result).toContain("line 199");
    expect(result).toContain("lines omitted");
    expect(result).not.toContain("line 100");
  });

  it("falls back to char truncation when few lines but many chars", () => {
    const big = "a".repeat(10_000);
    const result = truncateMiddle(big, { maxChars: 200 });
    expect(result.length).toBeLessThan(big.length);
    expect(result).toContain("chars omitted");
  });
});
