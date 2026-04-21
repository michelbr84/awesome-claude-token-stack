import { estimateTokens } from "@acts/core";
import type { ObservationRow } from "@acts/core";
import type { Database } from "better-sqlite3";

import type { Observation } from "./observations.js";

export const TOKEN_BUDGETS = {
  index: 15,
  search: 60,
  get: 200,
} as const;

export interface MemoryIndexHit {
  id: string;
  kind: string;
  title: string;
  tags: readonly string[];
}

export interface MemorySearchHit {
  id: string;
  kind: string;
  title: string;
  summary: string;
  score: number;
  tags: readonly string[];
}

export interface MemoryGetResult {
  id: string;
  kind: string;
  title: string;
  body: string;
  tags: readonly string[];
  source: string | null;
  validity: number;
  createdAt: number;
  updatedAt: number;
}

function sanitizeQuery(raw: string): string {
  const tokens = raw
    .split(/\s+/)
    .map((t) => t.replace(/"/g, ""))
    .filter(Boolean)
    .filter((t) => !/^(AND|OR|NOT|NEAR)$/i.test(t))
    .map((t) => `"${t}"`);
  return tokens.join(" ");
}

function parseTags(tagsJson: string): readonly string[] {
  try {
    const v = JSON.parse(tagsJson);
    if (Array.isArray(v)) return v.filter((x) => typeof x === "string");
  } catch {
    // swallow
  }
  return [];
}

/**
 * Layer 1 — smallest disclosure. Returns id + kind + title + tags only,
 * budgeted at ~15 tokens per row. Useful for "what do I have on topic X".
 */
export function indexMemory(
  db: Database,
  query: string,
  options: { limit?: number; kind?: string } = {},
): readonly MemoryIndexHit[] {
  const limit = Math.max(1, Math.min(100, options.limit ?? 20));
  const fts = sanitizeQuery(query);
  if (!fts) return [];

  const sql = options.kind
    ? `SELECT o.id, o.kind, o.title, o.tags_json
       FROM observations_fts
       JOIN observations o ON o.id = observations_fts.id
       WHERE observations_fts MATCH ? AND o.kind = ? AND o.superseded_by IS NULL
       ORDER BY bm25(observations_fts)
       LIMIT ?`
    : `SELECT o.id, o.kind, o.title, o.tags_json
       FROM observations_fts
       JOIN observations o ON o.id = observations_fts.id
       WHERE observations_fts MATCH ? AND o.superseded_by IS NULL
       ORDER BY bm25(observations_fts)
       LIMIT ?`;

  const rows = (
    options.kind ? db.prepare(sql).all(fts, options.kind, limit) : db.prepare(sql).all(fts, limit)
  ) as Array<{ id: string; kind: string; title: string; tags_json: string }>;

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    tags: parseTags(r.tags_json),
  }));
}

function shortSummary(body: string, maxTokens: number): string {
  // Budget-aware summary: ~4 chars/token is a good first approximation.
  const maxChars = maxTokens * 4;
  if (body.length <= maxChars) return body.trim();
  const truncated = body.slice(0, maxChars).trim();
  const lastDot = truncated.lastIndexOf(". ");
  if (lastDot > maxChars * 0.5) return truncated.slice(0, lastDot + 1);
  return `${truncated}…`;
}

/**
 * Layer 2 — medium disclosure. Returns title + summary budgeted at ~60 tokens
 * each, plus a relative score. Use when the caller wants enough context to
 * decide whether to expand further.
 */
export function searchMemory(
  db: Database,
  query: string,
  options: { limit?: number; kind?: string } = {},
): readonly MemorySearchHit[] {
  const limit = Math.max(1, Math.min(50, options.limit ?? 10));
  const fts = sanitizeQuery(query);
  if (!fts) return [];

  const sql = options.kind
    ? `SELECT o.*, bm25(observations_fts) AS rank
       FROM observations_fts
       JOIN observations o ON o.id = observations_fts.id
       WHERE observations_fts MATCH ? AND o.kind = ? AND o.superseded_by IS NULL
       ORDER BY rank
       LIMIT ?`
    : `SELECT o.*, bm25(observations_fts) AS rank
       FROM observations_fts
       JOIN observations o ON o.id = observations_fts.id
       WHERE observations_fts MATCH ? AND o.superseded_by IS NULL
       ORDER BY rank
       LIMIT ?`;

  const rows = (
    options.kind ? db.prepare(sql).all(fts, options.kind, limit) : db.prepare(sql).all(fts, limit)
  ) as Array<ObservationRow & { rank: number }>;

  const summaryBudget = TOKEN_BUDGETS.search - 10; // reserve for header fields
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    summary: shortSummary(r.body, summaryBudget),
    score: r.rank,
    tags: parseTags(r.tags_json),
  }));
}

/**
 * Layer 3 — full disclosure. Returns the complete observation, trimmed only
 * if the body exceeds the hard budget of 200 tokens (safety rail — users who
 * explicitly want the whole thing can call `getObservation` directly).
 */
export function getMemory(db: Database, id: string): MemoryGetResult | null {
  const row = db.prepare("SELECT * FROM observations WHERE id = ?").get(id) as
    | ObservationRow
    | undefined;
  if (!row) return null;

  db.prepare(
    "UPDATE observations SET accessed_at = ?, access_count = access_count + 1 WHERE id = ?",
  ).run(Date.now(), id);

  let body = row.body;
  const tokens = estimateTokens(body);
  if (tokens > TOKEN_BUDGETS.get * 2) {
    // Soft cap — we don't hard-truncate, but warn via trailing marker.
    body = shortSummary(body, TOKEN_BUDGETS.get * 2);
  }

  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body,
    tags: parseTags(row.tags_json),
    source: row.source,
    validity: row.validity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type { Observation };
