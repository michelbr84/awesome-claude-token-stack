import { shortHash } from "@acts/core";
import type { CheckpointRow } from "@acts/core";
import type { Database } from "better-sqlite3";

/**
 * Progressive checkpoint thresholds (fractions of the context window).
 *
 * Instead of waiting for emergency compaction at 100%, we capture compact
 * snapshots at increasing fill ratios so that post-compaction restoration
 * has something useful to work with regardless of which boundary was crossed.
 */
export const CHECKPOINT_THRESHOLDS = [0.2, 0.35, 0.5, 0.65, 0.8] as const;

export interface CheckpointInput {
  sessionId: string;
  contextFill: number;
  label?: string;
  payload: Record<string, unknown>;
}

export interface Checkpoint {
  id: string;
  sessionId: string;
  createdAt: number;
  contextFill: number;
  label: string | null;
  payload: Record<string, unknown>;
}

function rowToCheckpoint(row: CheckpointRow): Checkpoint {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.payload_json) as Record<string, unknown>;
  } catch {
    payload = { raw: row.payload_json };
  }
  return {
    id: row.id,
    sessionId: row.session_id,
    createdAt: row.created_at,
    contextFill: row.context_fill,
    label: row.label,
    payload,
  };
}

export function createCheckpoint(db: Database, input: CheckpointInput): Checkpoint {
  const id = shortHash(`${input.sessionId}:${Date.now()}:${Math.random()}`, 12);
  const payloadJson = JSON.stringify(input.payload);
  db.prepare(
    `INSERT INTO checkpoints(id, session_id, created_at, context_fill, label, payload_json)
     VALUES(@id, @session_id, @at, @fill, @label, @payload)`,
  ).run({
    id,
    session_id: input.sessionId,
    at: Date.now(),
    fill: input.contextFill,
    label: input.label ?? null,
    payload: payloadJson,
  });
  const row = db.prepare("SELECT * FROM checkpoints WHERE id = ?").get(id) as CheckpointRow;
  return rowToCheckpoint(row);
}

export function listCheckpoints(db: Database, sessionId: string): readonly Checkpoint[] {
  const rows = db
    .prepare("SELECT * FROM checkpoints WHERE session_id = ? ORDER BY created_at ASC")
    .all(sessionId) as CheckpointRow[];
  return rows.map(rowToCheckpoint);
}

export function getCheckpoint(db: Database, id: string): Checkpoint | null {
  const row = db.prepare("SELECT * FROM checkpoints WHERE id = ?").get(id) as
    | CheckpointRow
    | undefined;
  return row ? rowToCheckpoint(row) : null;
}

export function deleteCheckpoint(db: Database, id: string): boolean {
  const result = db.prepare("DELETE FROM checkpoints WHERE id = ?").run(id);
  return result.changes > 0;
}
