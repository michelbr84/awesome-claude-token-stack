import { describe, expect, it } from "vitest";

import { analyzeClaudeMd, compressClaudeMd } from "../src/claudeMd.js";

describe("compressClaudeMd", () => {
  it("preserves fenced code blocks verbatim", () => {
    const src = [
      "# Heading",
      "",
      "Please note that we do this.",
      "",
      "```ts",
      "const   x    =   1; // spaces preserved inside code",
      "```",
    ].join("\n");
    const result = compressClaudeMd(src);
    expect(result.output).toContain("const   x    =   1; // spaces preserved inside code");
    expect(result.preservedCodeBlocks).toBe(1);
  });

  it("strips filler phrases in prose", () => {
    const src = "Please note that we must write tests.";
    const result = compressClaudeMd(src);
    expect(result.output.toLowerCase()).not.toContain("please note that");
    expect(result.output).toMatch(/we must write tests/i);
  });

  it("collapses multiple blank lines to one", () => {
    const src = "line1\n\n\n\n\nline2\n";
    const result = compressClaudeMd(src);
    expect(result.output).toBe("line1\n\nline2\n");
  });

  it("drops HTML comments", () => {
    const src = "before <!-- secret comment --> after";
    const result = compressClaudeMd(src);
    expect(result.output).not.toContain("secret comment");
    expect(result.output).toContain("before");
    expect(result.output).toContain("after");
  });

  it("reports positive savings on padded input", () => {
    const padded = Array(40).fill("Please note that this is a reminder.\n\n\n").join("");
    const result = compressClaudeMd(padded);
    expect(result.savings).toBeGreaterThan(0.05);
  });

  it("returns trivial result for empty input", () => {
    const result = compressClaudeMd("");
    expect(result.rawTokens).toBe(0);
    expect(result.compressedTokens).toBe(0);
    expect(result.savings).toBe(0);
  });
});

describe("analyzeClaudeMd", () => {
  it("counts headings, prose, and code lines", () => {
    const src = [
      "# Title",
      "",
      "Some prose.",
      "",
      "```",
      "code",
      "code",
      "```",
      "More prose.",
    ].join("\n");
    const a = analyzeClaudeMd(src);
    expect(a.headings).toBe(1);
    expect(a.codeLines).toBe(2);
    expect(a.proseLines).toBeGreaterThanOrEqual(2);
  });

  it("captures the attention tail", () => {
    const src = "start\n" + "x".repeat(800);
    const a = analyzeClaudeMd(src);
    expect(a.attentionTail.length).toBeLessThanOrEqual(500);
    expect(a.attentionTail.endsWith("x".repeat(20))).toBe(true);
  });
});
