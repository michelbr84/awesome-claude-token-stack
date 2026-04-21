import {
  OBSERVATION_KINDS,
  deleteObservation,
  getMemory,
  indexMemory,
  listObservations,
  saveObservation,
  searchMemory,
} from "@acts/memory";

import type { ToolContext, ToolDefinition } from "./types.js";

function str(val: unknown, def = ""): string {
  return typeof val === "string" ? val : def;
}
function num(val: unknown, def = 0): number {
  return typeof val === "number" && Number.isFinite(val) ? val : def;
}
function arr<T = unknown>(val: unknown): T[] {
  return Array.isArray(val) ? (val as T[]) : [];
}

export function memoryTools(ctx: ToolContext): ToolDefinition[] {
  return [
    {
      name: "acts_memory_save",
      description:
        "Persist an observation (decision, bugfix, convention, note, etc.) in the local memory store. Returns the stored observation id.",
      inputSchema: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: [...OBSERVATION_KINDS],
            description: "Observation category.",
          },
          title: { type: "string", description: "Short, indexable title." },
          body: { type: "string", description: "Full observation body." },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Optional tags for filtering.",
          },
          source: { type: "string", description: "Optional source reference (URL, file, etc.)." },
          ttl_seconds: {
            type: "number",
            description: "Optional TTL in seconds. Omit for permanent.",
          },
        },
        required: ["kind", "title", "body"],
        additionalProperties: false,
      },
      handler: (input) => {
        const obs = saveObservation(ctx.db, {
          kind: str(input.kind, "note") as (typeof OBSERVATION_KINDS)[number],
          title: str(input.title),
          body: str(input.body),
          tags: arr<string>(input.tags),
          source: typeof input.source === "string" ? input.source : undefined,
          ttlSeconds: typeof input.ttl_seconds === "number" ? input.ttl_seconds : undefined,
        });
        return { id: obs.id, kind: obs.kind, title: obs.title };
      },
    },
    {
      name: "acts_memory_index",
      description:
        "Layer 1 memory lookup — returns id/kind/title/tags only (~15 tokens per hit). Best for 'what do I have on X?' surveys.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text search query." },
          kind: {
            type: "string",
            enum: [...OBSERVATION_KINDS],
            description: "Optional filter by kind.",
          },
          limit: { type: "number", description: "Max hits (default 20)." },
        },
        required: ["query"],
        additionalProperties: false,
      },
      handler: (input) => {
        return indexMemory(ctx.db, str(input.query), {
          kind:
            typeof input.kind === "string" && OBSERVATION_KINDS.includes(input.kind as never)
              ? (input.kind as (typeof OBSERVATION_KINDS)[number])
              : undefined,
          limit: num(input.limit, 20),
        });
      },
    },
    {
      name: "acts_memory_search",
      description:
        "Layer 2 memory lookup — returns title plus a short summary (~60 tokens per hit) ranked by BM25.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          kind: { type: "string", enum: [...OBSERVATION_KINDS] },
          limit: { type: "number", description: "Max hits (default 10)." },
        },
        required: ["query"],
        additionalProperties: false,
      },
      handler: (input) => {
        return searchMemory(ctx.db, str(input.query), {
          kind:
            typeof input.kind === "string" && OBSERVATION_KINDS.includes(input.kind as never)
              ? (input.kind as (typeof OBSERVATION_KINDS)[number])
              : undefined,
          limit: num(input.limit, 10),
        });
      },
    },
    {
      name: "acts_memory_get",
      description:
        "Layer 3 memory retrieve — returns the full observation body for a given id. Bumps the access counter.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Observation id from index/search." },
        },
        required: ["id"],
        additionalProperties: false,
      },
      handler: (input) => {
        const result = getMemory(ctx.db, str(input.id));
        if (!result) return { found: false, id: str(input.id) };
        return { found: true, ...result };
      },
    },
    {
      name: "acts_memory_list",
      description:
        "Browse recent observations, optionally filtered by kind or tag. Returns metadata only (no body).",
      inputSchema: {
        type: "object",
        properties: {
          kind: { type: "string", enum: [...OBSERVATION_KINDS] },
          tag: { type: "string" },
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
      handler: (input) => {
        return listObservations(ctx.db, {
          kind:
            typeof input.kind === "string" && OBSERVATION_KINDS.includes(input.kind as never)
              ? (input.kind as (typeof OBSERVATION_KINDS)[number])
              : undefined,
          tag: typeof input.tag === "string" ? input.tag : undefined,
          limit: num(input.limit, 50),
        }).map((o) => ({
          id: o.id,
          kind: o.kind,
          title: o.title,
          tags: o.tags,
          updatedAt: o.updatedAt,
          validity: o.validity,
        }));
      },
    },
    {
      name: "acts_memory_delete",
      description: "Permanently delete an observation by id.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
      handler: (input) => ({ deleted: deleteObservation(ctx.db, str(input.id)) }),
    },
  ];
}
