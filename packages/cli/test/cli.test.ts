import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { runCli } from "../src/cli.js";

let tmpHome: string;
let dbPath: string;
const originalStdout = process.stdout.write.bind(process.stdout);
let captured = "";

beforeEach(() => {
  tmpHome = mkdtempSync(join(tmpdir(), "acts-cli-"));
  dbPath = join(tmpHome, "store.db");
  captured = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    captured += typeof chunk === "string" ? chunk : String(chunk);
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(tmpHome, { recursive: true, force: true });
  // Ensure nothing leaked to the real stdout from the mock cleanup
  originalStdout("");
});

describe("runCli", () => {
  it("prints the version", async () => {
    try {
      await runCli(["node", "acts", "--version"]);
    } catch {
      /* commander may call process.exit(0) — swallow for tests */
    }
    expect(captured).toMatch(/\d+\.\d+\.\d+/);
  });

  it("runs `db info` against a custom database path", async () => {
    await runCli(["node", "acts", "db", "info", "--db", dbPath, "--json"]);
    expect(captured).toContain(`"schemaVersion": 1`);
    expect(captured).toContain(dbPath.replace(/\\/g, "\\\\"));
  });

  it("saves and retrieves a memory observation via the CLI", async () => {
    await runCli([
      "node",
      "acts",
      "memory",
      "save",
      "--kind",
      "decision",
      "--title",
      "Use SQLite",
      "--body",
      "Local-first, single file, FTS5.",
      "--db",
      dbPath,
    ]);
    expect(captured).toContain("saved");

    captured = "";
    await runCli(["node", "acts", "memory", "list", "--db", dbPath]);
    expect(captured).toMatch(/decision.*Use SQLite/);
  });
});
