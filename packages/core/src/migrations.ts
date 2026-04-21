import type { Database } from "better-sqlite3";

import { SCHEMA_SQL } from "./schema.js";

export interface Migration {
  version: number;
  name: string;
  up: (db: Database) => void;
}

export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: "initial schema",
    up: (db) => {
      db.exec(SCHEMA_SQL);
    },
  },
];

function ensureMetaTable(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _acts_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

/** Returns the currently-applied schema version (0 if none). */
export function currentSchemaVersion(db: Database): number {
  ensureMetaTable(db);
  const row = db.prepare("SELECT value FROM _acts_meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;
  return row ? Number.parseInt(row.value, 10) : 0;
}

/**
 * Applies any pending migrations. Each migration runs inside a transaction;
 * a failure rolls back cleanly without corrupting the database.
 */
export function runMigrations(db: Database): { applied: number; version: number } {
  ensureMetaTable(db);
  let current = currentSchemaVersion(db);
  let applied = 0;

  const setVersion = db.prepare(
    "INSERT INTO _acts_meta(key, value) VALUES('schema_version', @v) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    const tx = db.transaction(() => {
      migration.up(db);
      setVersion.run({ v: String(migration.version) });
    });
    tx();
    current = migration.version;
    applied += 1;
  }

  return { applied, version: current };
}
