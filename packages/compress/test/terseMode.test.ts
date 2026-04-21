import { describe, expect, it } from "vitest";

import { TERSE_MODE_LEVELS, terseSkillMarkdown } from "../src/terseMode.js";

describe("terseSkillMarkdown", () => {
  it("returns skill markdown for every level", () => {
    for (const level of TERSE_MODE_LEVELS) {
      const md = terseSkillMarkdown(level);
      expect(md).toMatch(/^---\nname: acts-terse/);
      expect(md).toContain(`intensity: ${level}`);
      expect(md).toContain("## Rules");
    }
  });

  it("defaults to 'full' level", () => {
    expect(terseSkillMarkdown()).toContain("intensity: full");
  });

  it("ultra is stricter than lite", () => {
    const lite = terseSkillMarkdown("lite");
    const ultra = terseSkillMarkdown("ultra");
    expect(ultra).toContain("3 sentences or fewer");
    expect(lite).not.toContain("3 sentences or fewer");
  });
});
