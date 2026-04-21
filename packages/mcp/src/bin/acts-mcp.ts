#!/usr/bin/env node
import { startMcpServer } from "../server.js";

async function main(): Promise<void> {
  const dbPath = process.env.ACTS_DB_PATH;
  await startMcpServer(dbPath ? { dbPath } : {});
}

main().catch((err) => {
  // MCP servers must log to stderr — stdout is the JSON-RPC channel.
  process.stderr.write(`acts-mcp: fatal: ${(err as Error).stack ?? err}\n`);
  process.exit(1);
});
