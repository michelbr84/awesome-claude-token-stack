import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { resolveStoreDir } from "@acts/core";
import type { Command } from "commander";

import { openFromCli } from "../util/db.js";

const IGNORE_ENTRY = ".acts/\n";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a .acts/ store in the current project and add it to .gitignore.")
    .option("--db <path>", "override the SQLite database path")
    .action((opts) => {
      const storeDir = resolveStoreDir({ create: true });
      const handle = openFromCli(opts);
      const cwd = process.cwd();
      const gitignorePath = join(cwd, ".gitignore");

      let gitignoreStatus = "unchanged";
      if (existsSync(gitignorePath)) {
        let content = "";
        try {
          content = readFileSync(gitignorePath, "utf8");
        } catch {
          content = "";
        }
        if (!content.includes(".acts/")) {
          writeFileSync(gitignorePath, `${content.replace(/\s*$/, "")}\n${IGNORE_ENTRY}`, {
            encoding: "utf8",
          });
          gitignoreStatus = "updated";
        }
      } else {
        writeFileSync(gitignorePath, IGNORE_ENTRY, { encoding: "utf8" });
        gitignoreStatus = "created";
      }

      process.stdout.write(
        `acts initialized.\n  store dir: ${storeDir}\n  database:  ${handle.path}\n  schema:    v${handle.schemaVersion}\n  .gitignore: ${gitignoreStatus}\n`,
      );
      handle.close();
    });
}
