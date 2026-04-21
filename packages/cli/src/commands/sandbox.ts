import { readFileSync } from "node:fs";

import {
  SUPPORTED_RUNTIMES,
  executeScript,
  indexContent,
  searchContent,
  type SandboxRuntime,
} from "@acts/sandbox";
import type { Command } from "commander";

import { openFromCli, printJson } from "../util/db.js";

export function registerSandboxCommand(program: Command): void {
  const cmd = program
    .command("sandbox")
    .description("Off-context script execution and content indexing.");

  cmd
    .command("exec")
    .description("Execute a script in an isolated subprocess.")
    .requiredOption("--runtime <runtime>", `one of: ${SUPPORTED_RUNTIMES.join(", ")}`)
    .option("-f, --file <file>", "read script from a file instead of stdin")
    .option("--timeout <ms>", "timeout in milliseconds", "30000")
    .option("--json", "emit result as JSON")
    .action(async (opts: { runtime: string; file?: string; timeout: string; json?: boolean }) => {
      if (!SUPPORTED_RUNTIMES.includes(opts.runtime as never)) {
        process.stderr.write(
          `acts sandbox exec: invalid --runtime ${JSON.stringify(opts.runtime)}.\n`,
        );
        process.exit(2);
      }
      const script = opts.file ? readFileSync(opts.file, "utf8") : await readStdin();
      if (!script) {
        process.stderr.write("acts sandbox exec: empty script input\n");
        process.exit(2);
      }
      const result = await executeScript({
        runtime: opts.runtime as SandboxRuntime,
        script,
        timeoutMs: Number.parseInt(opts.timeout, 10),
      });
      if (opts.json) {
        printJson(result);
      } else {
        if (result.stdout) process.stdout.write(result.stdout);
        if (result.stderr) process.stderr.write(result.stderr);
      }
      process.exit(result.exitCode);
    });

  cmd
    .command("index")
    .description("Index a file (or stdin) into the content store.")
    .option("-f, --file <file>", "read content from a file")
    .requiredOption("--source <source>", "logical source key")
    .option("--title <title>")
    .option("--ttl <seconds>")
    .option("--db <path>")
    .option("--json")
    .action(
      async (opts: {
        file?: string;
        source: string;
        title?: string;
        ttl?: string;
        db?: string;
        json?: boolean;
      }) => {
        const text = opts.file ? readFileSync(opts.file, "utf8") : await readStdin();
        const handle = openFromCli(opts);
        const result = indexContent(handle.db, {
          source: opts.source,
          text,
          title: opts.title,
          ttlSeconds: opts.ttl ? Number.parseInt(opts.ttl, 10) : undefined,
        });
        if (opts.json) {
          printJson(result);
        } else {
          process.stdout.write(
            `indexed ${result.id} (${result.chunks} chunks, ${result.bytes} bytes, replaced=${result.replaced})\n`,
          );
        }
        handle.close();
      },
    );

  cmd
    .command("search")
    .description("FTS5 BM25 search over indexed content.")
    .argument("<query>")
    .option("--source <source>")
    .option("--limit <n>", "default 10", "10")
    .option("--db <path>")
    .option("--json")
    .action(
      (query: string, opts: { source?: string; limit: string; db?: string; json?: boolean }) => {
        const handle = openFromCli(opts);
        const hits = searchContent(handle.db, query, {
          source: opts.source,
          limit: Number.parseInt(opts.limit, 10),
        });
        if (opts.json) {
          printJson(hits);
        } else if (hits.length === 0) {
          process.stdout.write("no results\n");
        } else {
          for (const h of hits) {
            process.stdout.write(`${h.source} [chunk ${h.chunkId}]  ${h.snippet}\n`);
          }
        }
        handle.close();
      },
    );
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
