import type { Command } from "commander";

import { startMcpServer } from "@acts/mcp";

export function registerMcpCommand(program: Command): void {
  program
    .command("mcp")
    .description(
      "Start the acts MCP server over stdio. Intended to be spawned by an MCP-compatible agent (Claude Code, Gemini CLI, Cursor, Codex, etc.).",
    )
    .option("--db <path>", "override the SQLite database path")
    .action(async (opts: { db?: string }) => {
      await startMcpServer(opts.db ? { dbPath: opts.db } : {});
      // Server runs on stdio — keep process alive until parent closes it.
      return new Promise<void>(() => {
        // never resolves; SIGTERM/SIGINT are handled by the server itself
      });
    });
}
