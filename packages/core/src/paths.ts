import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const STORE_DIR_NAME = ".acts";

export interface ResolveStoreOptions {
  /** Start directory to walk upward from. Defaults to process.cwd(). */
  startDir?: string;
  /** If true, create the store dir when missing. Defaults to false. */
  create?: boolean;
}

/**
 * Locates the `.acts/` directory for the current project by walking up the
 * directory tree from `startDir` (default: cwd). Returns the first match.
 *
 * If no existing `.acts/` is found and `create` is true, creates one in
 * `startDir` and returns its path. Otherwise returns `startDir/.acts`.
 */
export function resolveStoreDir(options: ResolveStoreOptions = {}): string {
  const startDir = resolve(options.startDir ?? process.cwd());

  let dir = startDir;
  for (;;) {
    const candidate = join(dir, STORE_DIR_NAME);
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  const fallback = join(startDir, STORE_DIR_NAME);
  if (options.create) {
    mkdirSync(fallback, { recursive: true });
  }
  return fallback;
}

/** Returns the default path to the SQLite database file for this project. */
export function resolveStoreDbPath(options: ResolveStoreOptions = {}): string {
  return join(resolveStoreDir(options), "store.db");
}
