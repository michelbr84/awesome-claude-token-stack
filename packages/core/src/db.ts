import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import BetterSqlite3 from "better-sqlite3";
import type { Database } from "better-sqlite3";

import { runMigrations } from "./migrations.js";
import { resolveStoreDbPath } from "./paths.js";

export const DEFAULT_DB_FILENAME = "store.db";

export interface OpenDatabaseOptions {
  /** Path to the SQLite file. Defaults to resolved .acts/store.db. */
  path?: string;
  /** Open the DB in read-only mode. */
  readonly?: boolean;
  /** Set true to open an in-memory database. Overrides `path`. */
  memory?: boolean;
  /** When true, skip running migrations on open (rare; useful for tests). */
  skipMigrations?: boolean;
  /** When true, skip enabling WAL (required for :memory:). */
  skipWal?: boolean;
}

export interface ActsDatabase {
  readonly db: Database;
  readonly path: string;
  readonly schemaVersion: number;
  close(): void;
}

/**
 * Opens (and initializes) an acts SQLite database. Applies WAL mode, sensible
 * pragmas, and runs all pending migrations before returning.
 */
export function openDatabase(options: OpenDatabaseOptions = {}): ActsDatabase {
  const path = options.memory ? ":memory:" : (options.path ?? resolveStoreDbPath({ create: true }));

  if (!options.memory) {
    mkdirSync(dirname(path), { recursive: true });
  }

  const db = new BetterSqlite3(path, {
    readonly: options.readonly ?? false,
    fileMustExist: false,
  });

  db.pragma("foreign_keys = ON");

  if (!options.memory && !options.skipWal && !options.readonly) {
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("temp_store = MEMORY");
    db.pragma("mmap_size = 134217728"); // 128 MiB
  }

  let version = 0;
  if (!options.skipMigrations && !options.readonly) {
    version = runMigrations(db).version;
  }

  return {
    db,
    path,
    schemaVersion: version,
    close: () => db.close(),
  };
}

/** Convenience alias for callers that prefer a functional close. */
export function closeDatabase(handle: ActsDatabase): void {
  handle.close();
}
