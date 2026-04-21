import type { Database } from "better-sqlite3";

export interface PruneResult {
  deleted: number;
}

export interface DecayResult {
  updated: number;
}

/**
 * Deletes observations whose TTL has elapsed. Observations with `ttl_seconds`
 * of NULL live forever (the default for user-saved memories).
 */
export function pruneExpired(db: Database, now: number = Date.now()): PruneResult {
  const result = db
    .prepare(
      "DELETE FROM observations WHERE ttl_seconds IS NOT NULL AND (created_at + ttl_seconds * 1000) < ?",
    )
    .run(now);
  return { deleted: result.changes };
}

/**
 * Decays the `validity` score of observations that haven't been accessed in
 * a long time. The idea: memories that stop being referenced become less
 * trustworthy over time. Returns the number of rows updated.
 */
export function decayValidity(
  db: Database,
  options: { factorPerWeek?: number; minValidity?: number; now?: number } = {},
): DecayResult {
  const factor = options.factorPerWeek ?? 0.95;
  const minValidity = options.minValidity ?? 0.1;
  const now = options.now ?? Date.now();
  const weekMs = 7 * 24 * 3600 * 1000;

  const rows = db
    .prepare("SELECT id, validity, accessed_at, updated_at FROM observations WHERE validity > ?")
    .all(minValidity) as Array<{
    id: string;
    validity: number;
    accessed_at: number | null;
    updated_at: number;
  }>;

  let updated = 0;
  const update = db.prepare("UPDATE observations SET validity = ? WHERE id = ?");
  const tx = db.transaction(() => {
    for (const row of rows) {
      const lastTouch = row.accessed_at ?? row.updated_at;
      const weeksIdle = Math.max(0, (now - lastTouch) / weekMs);
      if (weeksIdle < 1) continue;
      const decayed = Math.max(minValidity, row.validity * Math.pow(factor, weeksIdle));
      if (Math.abs(decayed - row.validity) > 1e-4) {
        update.run(decayed, row.id);
        updated += 1;
      }
    }
  });
  tx();

  return { updated };
}
