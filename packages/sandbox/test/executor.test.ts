import { describe, expect, it } from "vitest";

import { executeScript } from "../src/executor.js";

describe("executeScript", () => {
  it("runs a simple Node script and captures stdout", async () => {
    const result = await executeScript({
      runtime: "node",
      script: "console.log('hello ' + (1 + 1));",
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello 2");
    expect(result.timedOut).toBe(false);
  });

  it("captures stderr and non-zero exit", async () => {
    const result = await executeScript({
      runtime: "node",
      script: "console.error('boom'); process.exit(2);",
    });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("boom");
  });

  it("times out scripts that run too long", async () => {
    const result = await executeScript({
      runtime: "node",
      script: "setInterval(() => {}, 10000);",
      timeoutMs: 200,
    });
    expect(result.timedOut).toBe(true);
  });

  it("rejects unsupported runtimes", async () => {
    await expect(
      executeScript({
        runtime: "perl" as never,
        script: "print 'nope'",
      }),
    ).rejects.toThrow();
  });

  it("passes env vars through to the child", async () => {
    const result = await executeScript({
      runtime: "node",
      script: "console.log(process.env.ACTS_TEST_FLAG);",
      env: { ACTS_TEST_FLAG: "present" },
    });
    expect(result.stdout.trim()).toBe("present");
  });
});
