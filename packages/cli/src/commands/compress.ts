import { readFileSync, writeFileSync } from "node:fs";

import { compressClaudeMd, compressCommand, terseSkillMarkdown } from "@acts/compress";
import type { Command } from "commander";

import { printJson } from "../util/db.js";

export function registerCompressCommand(program: Command): void {
  const cmd = program.command("compress").description("Output compression utilities.");

  cmd
    .command("cmd")
    .description("Compress the stdout of a shell command (read from the terminal via stdin).")
    .argument("<argv...>", "command argv, e.g. git status")
    .option("--json", "emit the result as JSON (with savings info)")
    .option("--exit <code>", "the exit code of the source command (for diagnostics)")
    .action(async (argv: string[], opts: { json?: boolean; exit?: string }) => {
      const output = await readStdin();
      const result = compressCommand({
        command: argv,
        output,
        exitCode: opts.exit ? Number.parseInt(opts.exit, 10) : undefined,
      });
      if (opts.json) {
        printJson(result);
      } else {
        process.stdout.write(result.output);
        if (!result.output.endsWith("\n")) process.stdout.write("\n");
        process.stderr.write(
          `[acts] ${result.applied}: ${result.rawTokens} -> ${result.compressedTokens} tokens (${(result.savings * 100).toFixed(1)}% savings)\n`,
        );
      }
    });

  cmd
    .command("claude-md")
    .description("Compress a CLAUDE.md / instructions file.")
    .argument("<file>", "path to the file")
    .option("-o, --out <path>", "write the compressed output to this path")
    .option("--json", "emit the result as JSON")
    .action((file: string, opts: { out?: string; json?: boolean }) => {
      const source = readFileSync(file, "utf8");
      const result = compressClaudeMd(source);
      if (opts.out) {
        writeFileSync(opts.out, result.output, { encoding: "utf8" });
      }
      if (opts.json) {
        printJson(result);
      } else {
        if (!opts.out) process.stdout.write(result.output);
        process.stderr.write(
          `[acts] ${result.rawTokens} -> ${result.compressedTokens} tokens (${(result.savings * 100).toFixed(1)}% savings, ${result.preservedCodeBlocks} code blocks preserved)\n`,
        );
      }
    });

  cmd
    .command("terse-skill")
    .description("Emit the acts-terse skill markdown for a given intensity.")
    .option("--level <level>", "lite | full | ultra", "full")
    .action((opts: { level: "lite" | "full" | "ultra" }) => {
      process.stdout.write(terseSkillMarkdown(opts.level));
    });
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
