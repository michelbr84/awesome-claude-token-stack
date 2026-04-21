import type { Database } from "better-sqlite3";

import { compressTools } from "./compress.js";
import { memoryTools } from "./memory.js";
import { observeTools } from "./observe.js";
import { sandboxTools } from "./sandbox.js";
import type { ToolContext, ToolDefinition } from "./types.js";

/**
 * Per PLAN.md §17, the MCP manifest is capped at ≤20 tools. Adding a tool that
 * pushes the registry past this limit is a compilation-time error (via the
 * assertion below) — a reminder that tool descriptions are themselves a
 * context-token tax and should be curated deliberately.
 */
export const MAX_TOOL_COUNT = 20;

export function buildToolRegistry(db: Database): ToolDefinition[] {
  const ctx: ToolContext = { db };
  const registry: ToolDefinition[] = [
    ...memoryTools(ctx),
    ...sandboxTools(ctx),
    ...observeTools(ctx),
    ...compressTools(ctx),
  ];

  if (registry.length > MAX_TOOL_COUNT) {
    throw new Error(
      `Tool registry exceeds MAX_TOOL_COUNT (${registry.length} > ${MAX_TOOL_COUNT}). ` +
        `See PLAN.md §17 — tool manifest overhead is itself a context cost.`,
    );
  }

  // Assert all names are unique.
  const seen = new Set<string>();
  for (const tool of registry) {
    if (seen.has(tool.name)) {
      throw new Error(`Duplicate tool name: ${tool.name}`);
    }
    seen.add(tool.name);
  }

  return registry;
}

export const TOOL_NAMES = [
  "acts_memory_save",
  "acts_memory_index",
  "acts_memory_search",
  "acts_memory_get",
  "acts_memory_list",
  "acts_memory_delete",
  "acts_sandbox_exec",
  "acts_sandbox_index",
  "acts_sandbox_search",
  "acts_sandbox_fetch",
  "acts_observe_score",
  "acts_observe_session_stats",
  "acts_archive_get",
  "acts_archive_list",
  "acts_compress_claude_md",
  "acts_compress_command",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];
