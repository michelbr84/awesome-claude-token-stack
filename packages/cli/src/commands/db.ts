import { currentSchemaVersion, runMigrations } from "@acts/core";
import type { Command } from "commander";

import { openFromCli, printJson } from "../util/db.js";

export function registerDbCommand(program: Command): void {
  const cmd = program.command("db").description("Low-level database tools.");

  cmd
    .command("info")
    .description("Show the resolved database path and schema version.")
    .option("--db <path>")
    .option("--json")
    .action((opts: { db?: string; json?: boolean }) => {
      const handle = openFromCli(opts);
      const info = { path: handle.path, schemaVersion: handle.schemaVersion };
      if (opts.json) {
        printJson(info);
      } else {
        process.stdout.write(
          `database:       ${info.path}\nschema version: ${info.schemaVersion}\n`,
        );
      }
      handle.close();
    });

  cmd
    .command("migrate")
    .description("Apply any pending schema migrations.")
    .option("--db <path>")
    .action((opts: { db?: string }) => {
      const handle = openFromCli({ ...opts });
      const before = currentSchemaVersion(handle.db);
      const result = runMigrations(handle.db);
      process.stdout.write(
        `migrate: ${result.applied} applied (v${before} -> v${result.version})\n`,
      );
      handle.close();
    });
}
