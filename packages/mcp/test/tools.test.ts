import { openDatabase } from "@acts/core";
import type { ActsDatabase } from "@acts/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MAX_TOOL_COUNT, TOOL_NAMES, buildToolRegistry } from "../src/tools/index.js";

let handle: ActsDatabase;

beforeEach(() => {
  handle = openDatabase({ memory: true });
});

afterEach(() => {
  handle.close();
});

describe("tool registry", () => {
  it("respects the MAX_TOOL_COUNT cap from PLAN.md §17", () => {
    const tools = buildToolRegistry(handle.db);
    expect(tools.length).toBeLessThanOrEqual(MAX_TOOL_COUNT);
  });

  it("exposes exactly the declared tool names", () => {
    const tools = buildToolRegistry(handle.db);
    const registered = tools.map((t) => t.name).sort();
    const expected = [...TOOL_NAMES].sort();
    expect(registered).toEqual(expected);
  });

  it("gives every tool a description and a typed input schema", () => {
    const tools = buildToolRegistry(handle.db);
    for (const t of tools) {
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.inputSchema.type).toBe("object");
      expect(typeof t.inputSchema.properties).toBe("object");
    }
  });

  it("invokes acts_memory_save end-to-end", async () => {
    const tools = buildToolRegistry(handle.db);
    const save = tools.find((t) => t.name === "acts_memory_save")!;
    const result = await save.handler({
      kind: "decision",
      title: "Ship MIT",
      body: "We chose MIT for broad compatibility.",
      tags: ["legal"],
    });
    expect(result).toHaveProperty("id");
  });

  it("invokes acts_compress_claude_md end-to-end", async () => {
    const tools = buildToolRegistry(handle.db);
    const compress = tools.find((t) => t.name === "acts_compress_claude_md")!;
    const result = (await compress.handler({
      text: "Please note that we do things.\n\n\n\nLine.",
    })) as { output: string; savings: number };
    expect(result.output).not.toContain("Please note");
    expect(result.savings).toBeGreaterThanOrEqual(0);
  });
});
