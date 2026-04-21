import { estimateTokens, sha256, shortHash } from "@acts/core";
import type { ToolResultRow } from "@acts/core";
import type { Database } from "better-sqlite3";

export interface ArchiveInput {
  toolName: string;
  input: Record<string, unknown>;
  output: string;
  sessionId?: string;
  /** Target token threshold above which the output is flagged as truncated. */
  tokenCap?: number;
}

export interface ArchiveRecord {
  id: string;
  toolName: string;
  createdAt: number;
  input: Record<string, unknown>;
  output: string;
  outputTokens: number;
  truncated: boolean;
}

const DEFAULT_TOKEN_CAP = 500;

/**
 * Archives a tool result so the agent can retrieve the full content by id
 * instead of carrying the raw output in its context window. Returns a short
 * id and a "hint" string suitable for injecting back into the assistant.
 */
export function archiveToolResult(
  db: Database,
  input: ArchiveInput,
): { record: ArchiveRecord; hint: string } {
  const id = shortHash(
    `${input.toolName}:${JSON.stringify(input.input)}:${input.output.slice(0, 256)}`,
    12,
  );
  const hash = sha256(input.output);
  const tokens = estimateTokens(input.output);
  const cap = input.tokenCap ?? DEFAULT_TOKEN_CAP;
  const truncated = tokens > cap;

  db.prepare(
    `INSERT OR REPLACE INTO tool_results(
       id, session_id, tool_name, created_at, input_json, output,
       output_tokens, truncated, content_hash
     ) VALUES (
       @id, @session_id, @tool_name, @created_at, @input_json, @output,
       @output_tokens, @truncated, @hash
     )`,
  ).run({
    id,
    session_id: input.sessionId ?? null,
    tool_name: input.toolName,
    created_at: Date.now(),
    input_json: JSON.stringify(input.input),
    output: input.output,
    output_tokens: tokens,
    truncated: truncated ? 1 : 0,
    hash,
  });

  const record: ArchiveRecord = {
    id,
    toolName: input.toolName,
    createdAt: Date.now(),
    input: input.input,
    output: input.output,
    outputTokens: tokens,
    truncated,
  };

  const hint = truncated
    ? `[acts-archive id=${id} tokens=${tokens} tool=${input.toolName}] full output archived; call acts_archive_get(id) to retrieve.`
    : `[acts-archive id=${id} tokens=${tokens} tool=${input.toolName}]`;

  return { record, hint };
}

export function getArchivedResult(db: Database, id: string): ArchiveRecord | null {
  const row = db.prepare("SELECT * FROM tool_results WHERE id = ?").get(id) as
    | ToolResultRow
    | undefined;
  if (!row) return null;
  let parsedInput: Record<string, unknown> = {};
  try {
    parsedInput = JSON.parse(row.input_json) as Record<string, unknown>;
  } catch {
    parsedInput = { raw: row.input_json };
  }
  return {
    id: row.id,
    toolName: row.tool_name,
    createdAt: row.created_at,
    input: parsedInput,
    output: row.output,
    outputTokens: row.output_tokens,
    truncated: row.truncated === 1,
  };
}

export function listArchivedResults(
  db: Database,
  options: { sessionId?: string; limit?: number } = {},
): readonly ArchiveRecord[] {
  const limit = Math.max(1, Math.min(200, options.limit ?? 50));
  const rows = options.sessionId
    ? (db
        .prepare("SELECT * FROM tool_results WHERE session_id = ? ORDER BY created_at DESC LIMIT ?")
        .all(options.sessionId, limit) as ToolResultRow[])
    : (db
        .prepare("SELECT * FROM tool_results ORDER BY created_at DESC LIMIT ?")
        .all(limit) as ToolResultRow[]);

  return rows.map((row) => {
    let parsedInput: Record<string, unknown> = {};
    try {
      parsedInput = JSON.parse(row.input_json) as Record<string, unknown>;
    } catch {
      parsedInput = { raw: row.input_json };
    }
    return {
      id: row.id,
      toolName: row.tool_name,
      createdAt: row.created_at,
      input: parsedInput,
      output: row.output,
      outputTokens: row.output_tokens,
      truncated: row.truncated === 1,
    };
  });
}
