import {
  computeQuality,
  getArchivedResult,
  getSessionStats,
  latestQuality,
  listArchivedResults,
  listSessions,
  persistQuality,
} from "@acts/observe";

import type { ToolContext, ToolDefinition } from "./types.js";

function str(val: unknown, def = ""): string {
  return typeof val === "string" ? val : def;
}
function num(val: unknown, def = 0): number {
  return typeof val === "number" && Number.isFinite(val) ? val : def;
}

export function observeTools(ctx: ToolContext): ToolDefinition[] {
  return [
    {
      name: "acts_observe_score",
      description:
        "Compute a 7-signal context-quality score (0-100) with an S/A/B/C/D/F grade. Pass only the signals you have; missing signals are treated as ideal.",
      inputSchema: {
        type: "object",
        properties: {
          session_id: {
            type: "string",
            description: "Session id — if provided, the score is persisted.",
          },
          turn_index: { type: "number", description: "Turn index for persistence." },
          context_fill: {
            type: "number",
            description: "0..1 (higher = fuller). Inverted internally.",
          },
          fresh_reads: { type: "number", description: "0..1 fraction of reads that were new." },
          lean_tool_use: {
            type: "number",
            description: "0..1 fraction of tool outputs under the bloat threshold.",
          },
          shallow_compact: {
            type: "number",
            description: "0..1 (higher = fewer compactions).",
          },
          unique_content: { type: "number", description: "0..1 (higher = less duplication)." },
          decision_dense: { type: "number", description: "0..1 user-driven turn ratio." },
          agent_efficient: { type: "number", description: "0..1 agent efficiency index." },
        },
        additionalProperties: false,
      },
      handler: (input) => {
        const result = computeQuality({
          // Invert context_fill — fuller context is WORSE for quality.
          contextFill: typeof input.context_fill === "number" ? 1 - input.context_fill : undefined,
          freshReads: typeof input.fresh_reads === "number" ? input.fresh_reads : undefined,
          leanToolUse: typeof input.lean_tool_use === "number" ? input.lean_tool_use : undefined,
          shallowCompact:
            typeof input.shallow_compact === "number" ? input.shallow_compact : undefined,
          uniqueContent:
            typeof input.unique_content === "number" ? input.unique_content : undefined,
          decisionDense:
            typeof input.decision_dense === "number" ? input.decision_dense : undefined,
          agentEfficient:
            typeof input.agent_efficient === "number" ? input.agent_efficient : undefined,
        });
        const sessionId = str(input.session_id);
        if (sessionId) {
          persistQuality(ctx.db, sessionId, num(input.turn_index, 0), result);
        }
        return result;
      },
    },
    {
      name: "acts_observe_session_stats",
      description:
        "Return aggregate token/turn statistics for a session. Pass session_id to target a specific one, or omit for the most recent.",
      inputSchema: {
        type: "object",
        properties: {
          session_id: { type: "string" },
        },
        additionalProperties: false,
      },
      handler: (input) => {
        let id = str(input.session_id);
        if (!id) {
          const recent = listSessions(ctx.db, 1);
          if (recent.length === 0) return { found: false };
          id = recent[0]!.id;
        }
        const stats = getSessionStats(ctx.db, id);
        const quality = latestQuality(ctx.db, id);
        return stats ? { ...stats, quality } : { found: false, id };
      },
    },
    {
      name: "acts_archive_get",
      description:
        "Retrieve a previously-archived tool result by id. Use this after seeing an [acts-archive id=...] hint to pull the full content back.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
      handler: (input) => {
        const record = getArchivedResult(ctx.db, str(input.id));
        if (!record) return { found: false, id: str(input.id) };
        return { found: true, ...record };
      },
    },
    {
      name: "acts_archive_list",
      description:
        "List recently-archived tool results, optionally filtered to a session. Returns metadata only.",
      inputSchema: {
        type: "object",
        properties: {
          session_id: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
      handler: (input) => {
        return listArchivedResults(ctx.db, {
          sessionId: typeof input.session_id === "string" ? input.session_id : undefined,
          limit: num(input.limit, 20),
        }).map((r) => ({
          id: r.id,
          toolName: r.toolName,
          createdAt: r.createdAt,
          outputTokens: r.outputTokens,
          truncated: r.truncated,
        }));
      },
    },
  ];
}
