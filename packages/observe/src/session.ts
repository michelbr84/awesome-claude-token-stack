import { shortHash } from "@acts/core";
import type { SessionRow } from "@acts/core";
import type { Database } from "better-sqlite3";

export interface SessionStartInput {
  agent: string;
  cwd: string;
  meta?: Record<string, unknown>;
  /** Optional explicit id. */
  id?: string;
}

export interface TurnInput {
  sessionId: string;
  turnIndex: number;
  inputTokens?: number;
  outputTokens?: number;
  toolTokens?: number;
  contextFill?: number;
  meta?: Record<string, unknown>;
}

export interface SessionStats {
  sessionId: string;
  turns: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalToolTokens: number;
  avgContextFill: number;
  durationMs: number | null;
}

function genSessionId(agent: string, cwd: string): string {
  return shortHash(`${agent}:${cwd}:${Date.now()}:${Math.random()}`, 16);
}

export function startSession(db: Database, input: SessionStartInput): string {
  const id = input.id ?? genSessionId(input.agent, input.cwd);
  db.prepare(
    `INSERT INTO sessions(id, agent, started_at, ended_at, cwd, meta_json)
     VALUES(@id, @agent, @started_at, NULL, @cwd, @meta)`,
  ).run({
    id,
    agent: input.agent,
    started_at: Date.now(),
    cwd: input.cwd,
    meta: input.meta ? JSON.stringify(input.meta) : null,
  });
  return id;
}

export function endSession(db: Database, sessionId: string): boolean {
  const result = db
    .prepare("UPDATE sessions SET ended_at = ? WHERE id = ? AND ended_at IS NULL")
    .run(Date.now(), sessionId);
  return result.changes > 0;
}

export function recordTurn(db: Database, input: TurnInput): void {
  db.prepare(
    `INSERT INTO turn_metrics(
       session_id, turn_index, at,
       input_tokens, output_tokens, tool_tokens, context_fill, meta_json
     ) VALUES (
       @session_id, @turn_index, @at,
       @input_tokens, @output_tokens, @tool_tokens, @context_fill, @meta
     )`,
  ).run({
    session_id: input.sessionId,
    turn_index: input.turnIndex,
    at: Date.now(),
    input_tokens: input.inputTokens ?? 0,
    output_tokens: input.outputTokens ?? 0,
    tool_tokens: input.toolTokens ?? 0,
    context_fill: input.contextFill ?? 0,
    meta: input.meta ? JSON.stringify(input.meta) : null,
  });
}

export function listSessions(db: Database, limit = 20): readonly SessionRow[] {
  return db
    .prepare("SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?")
    .all(limit) as SessionRow[];
}

/** Returns aggregate statistics for a single session. */
export function getSessionStats(db: Database, sessionId: string): SessionStats | null {
  const session = db
    .prepare("SELECT started_at, ended_at FROM sessions WHERE id = ?")
    .get(sessionId) as { started_at: number; ended_at: number | null } | undefined;
  if (!session) return null;

  const agg = db
    .prepare(
      `SELECT
         COUNT(*) AS turns,
         COALESCE(SUM(input_tokens), 0) AS inTok,
         COALESCE(SUM(output_tokens), 0) AS outTok,
         COALESCE(SUM(tool_tokens), 0) AS toolTok,
         COALESCE(AVG(context_fill), 0) AS avgCtx
       FROM turn_metrics WHERE session_id = ?`,
    )
    .get(sessionId) as {
    turns: number;
    inTok: number;
    outTok: number;
    toolTok: number;
    avgCtx: number;
  };

  const end = session.ended_at ?? Date.now();
  return {
    sessionId,
    turns: agg.turns,
    totalInputTokens: agg.inTok,
    totalOutputTokens: agg.outTok,
    totalToolTokens: agg.toolTok,
    avgContextFill: agg.avgCtx,
    durationMs: end - session.started_at,
  };
}
