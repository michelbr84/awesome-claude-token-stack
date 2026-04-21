import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const SUPPORTED_RUNTIMES = ["node", "bash", "sh", "python", "python3"] as const;
export type SandboxRuntime = (typeof SUPPORTED_RUNTIMES)[number];

export interface ExecuteOptions {
  /** Runtime to execute the script with. */
  runtime: SandboxRuntime;
  /** The script source code. */
  script: string;
  /** Working directory for the child process. Defaults to system temp. */
  cwd?: string;
  /** Environment variables to set (merged with inherited env). */
  env?: Record<string, string>;
  /** Max wall-clock time in ms. Defaults to 30_000. */
  timeoutMs?: number;
  /** Max bytes of stdout to capture (rest is truncated). Defaults to 1 MiB. */
  maxOutputBytes?: number;
  /** Extra argv passed to the runtime after the script. */
  args?: readonly string[];
}

export interface ExecuteResult {
  runtime: SandboxRuntime;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  truncated: boolean;
  timedOut: boolean;
}

function runtimeBinary(rt: SandboxRuntime): string {
  // On Windows, bash/sh rely on Git Bash or WSL being on PATH. We delegate the
  // lookup to the OS rather than hardcoding paths.
  return rt;
}

function fileExtension(rt: SandboxRuntime): string {
  switch (rt) {
    case "node":
      return ".mjs";
    case "python":
    case "python3":
      return ".py";
    case "bash":
    case "sh":
      return ".sh";
  }
}

/**
 * Executes a short script inside an isolated subprocess. The script body is
 * written to a temporary file (no shell interpolation) and the runtime is
 * invoked via {@link execFile}. This avoids `shell: true` entirely, which is
 * the primary attack surface for command-injection bugs.
 */
export async function executeScript(options: ExecuteOptions): Promise<ExecuteResult> {
  if (!SUPPORTED_RUNTIMES.includes(options.runtime)) {
    throw new Error(`Unsupported sandbox runtime: ${options.runtime}`);
  }

  const timeoutMs = options.timeoutMs ?? 30_000;
  const maxOutputBytes = options.maxOutputBytes ?? 1_048_576;

  const workDir = mkdtempSync(join(tmpdir(), "acts-sandbox-"));
  const scriptPath = join(workDir, `script${fileExtension(options.runtime)}`);
  writeFileSync(scriptPath, options.script, { encoding: "utf8" });

  const argv = [scriptPath, ...(options.args ?? [])];
  const start = Date.now();

  try {
    const { stdout, stderr } = await execFileAsync(runtimeBinary(options.runtime), argv, {
      cwd: options.cwd ?? workDir,
      env: { ...process.env, ...(options.env ?? {}) },
      timeout: timeoutMs,
      maxBuffer: maxOutputBytes,
      windowsHide: true,
      encoding: "utf8",
    });
    return {
      runtime: options.runtime,
      exitCode: 0,
      // encoding: "utf8" guarantees string output from promisified execFile.
      stdout: String(stdout ?? ""),
      stderr: String(stderr ?? ""),
      durationMs: Date.now() - start,
      truncated: false,
      timedOut: false,
    };
  } catch (err) {
    const e = err as Error & {
      code?: string | number;
      signal?: string;
      stdout?: unknown;
      stderr?: unknown;
    };
    const stdout =
      typeof e.stdout === "string"
        ? e.stdout
        : Buffer.isBuffer(e.stdout)
          ? e.stdout.toString("utf8")
          : "";
    const stderr =
      typeof e.stderr === "string"
        ? e.stderr
        : Buffer.isBuffer(e.stderr)
          ? e.stderr.toString("utf8")
          : String(err);
    const timedOut = e.signal === "SIGTERM" || e.code === "ETIMEDOUT";
    const truncated = /maxBuffer/i.test(stderr) || stdout.length >= maxOutputBytes;

    // If the child exited non-zero, execFile rejects — we still want the output.
    const exitCode = typeof e.code === "number" ? e.code : timedOut ? 124 : truncated ? 0 : 1;

    return {
      runtime: options.runtime,
      exitCode,
      stdout,
      stderr,
      durationMs: Date.now() - start,
      truncated,
      timedOut,
    };
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
