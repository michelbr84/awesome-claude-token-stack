import { Command } from "commander";

import { CLI_VERSION } from "./version.js";
import { registerCompressCommand } from "./commands/compress.js";
import { registerDbCommand } from "./commands/db.js";
import { registerInitCommand } from "./commands/init.js";
import { registerMcpCommand } from "./commands/mcp.js";
import { registerMemoryCommand } from "./commands/memory.js";
import { registerObserveCommand } from "./commands/observe.js";
import { registerSandboxCommand } from "./commands/sandbox.js";
import { registerStatusCommand } from "./commands/status.js";

export async function runCli(argv: readonly string[] = process.argv): Promise<void> {
  const program = new Command();
  program
    .name("acts")
    .description(
      "awesome-claude-token-stack — local-first toolkit for AI coding agents (compression, sandbox, memory, observability).",
    )
    .version(CLI_VERSION, "-v, --version", "print the acts version");

  registerInitCommand(program);
  registerStatusCommand(program);
  registerCompressCommand(program);
  registerMemoryCommand(program);
  registerSandboxCommand(program);
  registerObserveCommand(program);
  registerMcpCommand(program);
  registerDbCommand(program);

  program.showHelpAfterError("(use --help for available commands)");

  await program.parseAsync(argv as string[]);
}
