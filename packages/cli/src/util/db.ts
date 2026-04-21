import { openDatabase } from "@acts/core";
import type { ActsDatabase } from "@acts/core";

export interface DbOptions {
  db?: string;
}

/** Opens the database according to CLI global flags. */
export function openFromCli(opts: DbOptions): ActsDatabase {
  return openDatabase(opts.db ? { path: opts.db } : {});
}

export function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}
