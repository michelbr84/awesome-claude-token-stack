import { sha256, shortHash } from "@acts/core";
import type { Database } from "better-sqlite3";

export interface IndexInput {
  source: string;
  text: string;
  title?: string;
  mime?: string;
  ttlSeconds?: number;
  chunkSize?: number;
  /** Optional id override (default: short hash of source). */
  id?: string;
}

export interface IndexResult {
  id: string;
  chunks: number;
  bytes: number;
  contentHash: string;
  replaced: boolean;
}

export interface ContentRecord {
  id: string;
  source: string;
  title: string | null;
  mime: string | null;
  bytes: number;
  chunk_count: number;
  created_at: number;
  expires_at: number | null;
  content_hash: string;
}

const DEFAULT_CHUNK_CHARS = 2_000;

/**
 * Splits a large text into chunks bounded by paragraph boundaries when
 * possible. Paragraphs longer than `chunkSize` are hard-split on whitespace.
 */
function chunkText(text: string, chunkSize: number): string[] {
  if (text.length <= chunkSize) return [text];

  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let buffer = "";

  for (const para of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${para}` : para;
    if (candidate.length <= chunkSize) {
      buffer = candidate;
      continue;
    }
    if (buffer) {
      chunks.push(buffer);
      buffer = "";
    }
    if (para.length <= chunkSize) {
      buffer = para;
      continue;
    }
    // Hard-split oversize paragraph on whitespace.
    let start = 0;
    while (start < para.length) {
      let end = Math.min(start + chunkSize, para.length);
      if (end < para.length) {
        const nextWs = para.lastIndexOf(" ", end);
        if (nextWs > start + Math.floor(chunkSize / 2)) end = nextWs;
      }
      chunks.push(para.slice(start, end).trim());
      start = end;
    }
  }
  if (buffer) chunks.push(buffer);
  return chunks.filter((c) => c.length > 0);
}

/**
 * Indexes a text blob into the content store. If a prior record with the same
 * source exists and the content hash is unchanged, the existing record is
 * returned without rewriting chunks. Otherwise the old record is replaced.
 */
export function indexContent(db: Database, input: IndexInput): IndexResult {
  const now = Date.now();
  const hash = sha256(input.text);
  const id = input.id ?? shortHash(input.source, 12);
  const chunkSize = Math.max(500, input.chunkSize ?? DEFAULT_CHUNK_CHARS);
  const expires = input.ttlSeconds ? now + input.ttlSeconds * 1000 : null;

  const existing = db.prepare("SELECT content_hash FROM content WHERE id = ?").get(id) as
    | { content_hash: string }
    | undefined;

  if (existing && existing.content_hash === hash) {
    const countRow = db
      .prepare("SELECT COUNT(*) as n FROM content_chunks WHERE content_id = ?")
      .get(id) as { n: number };
    return {
      id,
      chunks: countRow.n,
      bytes: Buffer.byteLength(input.text, "utf8"),
      contentHash: hash,
      replaced: false,
    };
  }

  const chunks = chunkText(input.text, chunkSize);
  const bytes = Buffer.byteLength(input.text, "utf8");

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM content WHERE id = ?").run(id);
    db.prepare(
      `INSERT INTO content(id, source, title, mime, bytes, chunk_count, created_at, expires_at, content_hash)
       VALUES(@id, @source, @title, @mime, @bytes, @chunk_count, @created_at, @expires_at, @content_hash)`,
    ).run({
      id,
      source: input.source,
      title: input.title ?? null,
      mime: input.mime ?? null,
      bytes,
      chunk_count: chunks.length,
      created_at: now,
      expires_at: expires,
      content_hash: hash,
    });
    const insertChunk = db.prepare(
      "INSERT INTO content_chunks(content_id, chunk_index, text, byte_offset) VALUES(?, ?, ?, ?)",
    );
    let offset = 0;
    for (const [idx, chunk] of chunks.entries()) {
      insertChunk.run(id, idx, chunk, offset);
      offset += Buffer.byteLength(chunk, "utf8");
    }
  });

  tx();

  return {
    id,
    chunks: chunks.length,
    bytes,
    contentHash: hash,
    replaced: !!existing,
  };
}

export function deleteContent(db: Database, id: string): boolean {
  const result = db.prepare("DELETE FROM content WHERE id = ?").run(id);
  return result.changes > 0;
}

export function getContent(db: Database, id: string): ContentRecord | null {
  const row = db.prepare("SELECT * FROM content WHERE id = ?").get(id);
  return (row as ContentRecord | undefined) ?? null;
}

export function listContent(db: Database, limit = 50): readonly ContentRecord[] {
  return db
    .prepare("SELECT * FROM content ORDER BY created_at DESC, rowid DESC LIMIT ?")
    .all(limit) as ContentRecord[];
}
