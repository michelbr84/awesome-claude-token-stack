import { sha256, shortHash } from "@acts/core";
import type { ObservationKind, ObservationRow } from "@acts/core";
import type { Database } from "better-sqlite3";

export const OBSERVATION_KINDS: readonly ObservationKind[] = [
  "decision",
  "bugfix",
  "convention",
  "guardrail",
  "note",
  "warning",
  "pattern",
  "reference",
  "todo",
];

export interface Observation {
  id: string;
  kind: ObservationKind;
  title: string;
  body: string;
  tags: string[];
  source: string | null;
  createdAt: number;
  updatedAt: number;
  accessedAt: number | null;
  accessCount: number;
  validity: number;
  ttlSeconds: number | null;
  supersededBy: string | null;
  contentHash: string;
}

export interface SaveObservationInput {
  kind: ObservationKind;
  title: string;
  body: string;
  tags?: readonly string[];
  source?: string;
  ttlSeconds?: number;
  validity?: number;
  /** If provided, update/upsert this exact id; otherwise derive one from content. */
  id?: string;
}

export interface ListFilter {
  kind?: ObservationKind;
  tag?: string;
  limit?: number;
  includeSuperseded?: boolean;
  minValidity?: number;
}

function rowToObservation(row: ObservationRow): Observation {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tags_json);
    if (Array.isArray(parsed)) tags = parsed.filter((t) => typeof t === "string");
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    tags,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    accessedAt: row.accessed_at,
    accessCount: row.access_count,
    validity: row.validity,
    ttlSeconds: row.ttl_seconds,
    supersededBy: row.superseded_by,
    contentHash: row.content_hash,
  };
}

/**
 * Creates or updates an observation. The id is derived from the (kind, title)
 * pair unless explicitly provided, so re-saving the "same" observation with
 * new body text updates in place rather than duplicating.
 */
export function saveObservation(db: Database, input: SaveObservationInput): Observation {
  const now = Date.now();
  const id = input.id ?? shortHash(`${input.kind}:${input.title}`, 16);
  const hash = sha256(`${input.kind}:${input.title}:${input.body}`);
  const tagsJson = JSON.stringify(input.tags ?? []);
  const existing = db.prepare("SELECT * FROM observations WHERE id = ?").get(id) as
    | ObservationRow
    | undefined;

  if (existing) {
    db.prepare(
      `UPDATE observations
       SET kind = @kind, title = @title, body = @body, tags_json = @tags_json,
           source = @source, updated_at = @updated_at, validity = @validity,
           ttl_seconds = @ttl, content_hash = @hash
       WHERE id = @id`,
    ).run({
      id,
      kind: input.kind,
      title: input.title,
      body: input.body,
      tags_json: tagsJson,
      source: input.source ?? null,
      updated_at: now,
      validity: input.validity ?? existing.validity,
      ttl: input.ttlSeconds ?? existing.ttl_seconds,
      hash,
    });
  } else {
    db.prepare(
      `INSERT INTO observations(
         id, kind, title, body, tags_json, source, created_at, updated_at,
         accessed_at, access_count, validity, ttl_seconds, content_hash
       ) VALUES (
         @id, @kind, @title, @body, @tags_json, @source, @created_at, @updated_at,
         NULL, 0, @validity, @ttl, @hash
       )`,
    ).run({
      id,
      kind: input.kind,
      title: input.title,
      body: input.body,
      tags_json: tagsJson,
      source: input.source ?? null,
      created_at: now,
      updated_at: now,
      validity: input.validity ?? 1.0,
      ttl: input.ttlSeconds ?? null,
      hash,
    });
  }

  const row = db.prepare("SELECT * FROM observations WHERE id = ?").get(id) as ObservationRow;
  return rowToObservation(row);
}

/**
 * Retrieves an observation by id and bumps its access counters.
 * Returns null if the id doesn't exist.
 */
export function getObservation(db: Database, id: string): Observation | null {
  const row = db.prepare("SELECT * FROM observations WHERE id = ?").get(id) as
    | ObservationRow
    | undefined;
  if (!row) return null;
  db.prepare(
    "UPDATE observations SET accessed_at = ?, access_count = access_count + 1 WHERE id = ?",
  ).run(Date.now(), id);
  return rowToObservation({ ...row, accessed_at: Date.now(), access_count: row.access_count + 1 });
}

export function deleteObservation(db: Database, id: string): boolean {
  const result = db.prepare("DELETE FROM observations WHERE id = ?").run(id);
  return result.changes > 0;
}

export function listObservations(db: Database, filter: ListFilter = {}): readonly Observation[] {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter.kind) {
    conditions.push("kind = @kind");
    params.kind = filter.kind;
  }
  if (filter.tag) {
    conditions.push("tags_json LIKE @tag");
    params.tag = `%"${filter.tag}"%`;
  }
  if (!filter.includeSuperseded) {
    conditions.push("superseded_by IS NULL");
  }
  if (typeof filter.minValidity === "number") {
    conditions.push("validity >= @min_validity");
    params.min_validity = filter.minValidity;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = Math.max(1, Math.min(500, filter.limit ?? 50));
  const rows = db
    .prepare(`SELECT * FROM observations ${where} ORDER BY updated_at DESC LIMIT ${limit}`)
    .all(params) as ObservationRow[];
  return rows.map(rowToObservation);
}

/**
 * Marks an observation as superseded by another. The old record is kept so
 * historical context survives, but it is filtered out of default searches.
 */
export function supersedeObservation(db: Database, oldId: string, newId: string): boolean {
  const result = db
    .prepare("UPDATE observations SET superseded_by = ?, updated_at = ? WHERE id = ?")
    .run(newId, Date.now(), oldId);
  return result.changes > 0;
}
