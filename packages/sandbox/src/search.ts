import type { Database } from "better-sqlite3";

export interface SearchHit {
  chunkId: number;
  contentId: string;
  source: string;
  title: string | null;
  snippet: string;
  rank: number;
}

export interface SearchOptions {
  /** Max hits to return. */
  limit?: number;
  /** Filter to a specific content source. */
  source?: string;
}

/**
 * Sanitizes a user-supplied FTS5 query so syntax errors don't reach the
 * engine. We quote each whitespace-separated term and join with AND, which
 * degrades gracefully for users who type plain English.
 */
export function escapeFtsQuery(raw: string): string {
  const tokens = raw
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    // Drop FTS5 column/prefix operators to prevent injection-style crashes.
    .filter((t) => !/^(AND|OR|NOT|NEAR)$/i.test(t))
    .map((t) => {
      // Remove embedded quotes and wrap in quotes — FTS5 treats quoted terms literally.
      const cleaned = t.replace(/"/g, "");
      return `"${cleaned}"`;
    });
  return tokens.join(" ");
}

/**
 * Searches indexed content via FTS5 + BM25. Returns ranked hits with short
 * snippets suitable for agent retrieval.
 */
export function searchContent(
  db: Database,
  query: string,
  options: SearchOptions = {},
): readonly SearchHit[] {
  const limit = Math.max(1, Math.min(50, options.limit ?? 10));
  const fts = escapeFtsQuery(query);
  if (!fts) return [];

  const sql = options.source
    ? `
        SELECT
          rowid AS chunk_id,
          content_id,
          source,
          title,
          snippet(content_fts, 4, '⟨', '⟩', '…', 12) AS snippet,
          bm25(content_fts) AS rank
        FROM content_fts
        WHERE content_fts MATCH ? AND source = ?
        ORDER BY rank
        LIMIT ?
      `
    : `
        SELECT
          rowid AS chunk_id,
          content_id,
          source,
          title,
          snippet(content_fts, 4, '⟨', '⟩', '…', 12) AS snippet,
          bm25(content_fts) AS rank
        FROM content_fts
        WHERE content_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `;

  const rows = (
    options.source
      ? db.prepare(sql).all(fts, options.source, limit)
      : db.prepare(sql).all(fts, limit)
  ) as Array<{
    chunk_id: number;
    content_id: string;
    source: string;
    title: string | null;
    snippet: string;
    rank: number;
  }>;

  return rows.map((r) => ({
    chunkId: r.chunk_id,
    contentId: r.content_id,
    source: r.source,
    title: r.title,
    snippet: r.snippet,
    rank: r.rank,
  }));
}
