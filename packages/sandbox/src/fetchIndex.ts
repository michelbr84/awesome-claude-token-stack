import type { Database } from "better-sqlite3";

import { indexContent, type IndexResult } from "./indexer.js";

export interface FetchIndexOptions {
  /** URL to fetch. */
  url: string;
  /** Optional display title override. */
  title?: string;
  /** Cache TTL in seconds. Defaults to 24h. */
  ttlSeconds?: number;
  /** Request timeout in ms. Defaults to 15_000. */
  timeoutMs?: number;
  /** Max content length to read, in bytes. Defaults to 2 MiB. */
  maxBytes?: number;
  /** Optional custom chunk size in chars. */
  chunkSize?: number;
}

export interface FetchIndexResult extends IndexResult {
  url: string;
  status: number;
  mime: string;
  fromCache: boolean;
}

/** Strips HTML tags to recover a rough text rendering of a page. */
function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fetches a URL (text content only) and indexes its contents into the content
 * store. Returns a fast cache hit if the URL was indexed recently and is still
 * within its TTL.
 */
export async function fetchAndIndex(
  db: Database,
  options: FetchIndexOptions,
): Promise<FetchIndexResult> {
  const ttl = options.ttlSeconds ?? 24 * 3600;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;

  // Cache check: if a record with this source exists and hasn't expired, reuse.
  const cached = db
    .prepare("SELECT id, expires_at FROM content WHERE source = ? ORDER BY created_at DESC LIMIT 1")
    .get(options.url) as { id: string; expires_at: number | null } | undefined;

  if (cached && (!cached.expires_at || cached.expires_at > Date.now())) {
    const counts = db
      .prepare(
        "SELECT COUNT(*) as n, SUM(LENGTH(text)) as b FROM content_chunks WHERE content_id = ?",
      )
      .get(cached.id) as { n: number; b: number | null };
    const row = db
      .prepare("SELECT content_hash, mime FROM content WHERE id = ?")
      .get(cached.id) as {
      content_hash: string;
      mime: string | null;
    };
    return {
      id: cached.id,
      url: options.url,
      status: 200,
      mime: row.mime ?? "text/plain",
      chunks: counts.n,
      bytes: counts.b ?? 0,
      contentHash: row.content_hash,
      replaced: false,
      fromCache: true,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let status = 0;
  let mime = "text/plain";
  let text = "";
  try {
    const res = await fetch(options.url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "acts-sandbox/0.1 (+https://github.com/michelbr84/awesome-claude-token-stack)",
        Accept: "text/html, text/plain, text/markdown, application/json;q=0.9, */*;q=0.1",
      },
    });
    status = res.status;
    mime = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "text/plain";

    const reader = res.body?.getReader();
    if (!reader) {
      text = await res.text();
    } else {
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          total += value.byteLength;
          if (total > maxBytes) break;
          chunks.push(value);
        }
      }
      text = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
    }
  } finally {
    clearTimeout(timer);
  }

  if (status >= 400) {
    throw new Error(`fetchAndIndex: HTTP ${status} for ${options.url}`);
  }

  const isHtml = mime.includes("html");
  const processed = isHtml ? stripHtml(text) : text;

  const indexResult = indexContent(db, {
    source: options.url,
    title: options.title ?? options.url,
    mime,
    text: processed,
    ttlSeconds: ttl,
    chunkSize: options.chunkSize,
  });

  return { ...indexResult, url: options.url, status, mime, fromCache: false };
}
