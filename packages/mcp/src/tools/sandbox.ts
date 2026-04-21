import {
  SUPPORTED_RUNTIMES,
  executeScript,
  fetchAndIndex,
  indexContent,
  searchContent,
  type SandboxRuntime,
} from "@acts/sandbox";

import type { ToolContext, ToolDefinition } from "./types.js";

function str(val: unknown, def = ""): string {
  return typeof val === "string" ? val : def;
}
function num(val: unknown, def = 0): number {
  return typeof val === "number" && Number.isFinite(val) ? val : def;
}

export function sandboxTools(ctx: ToolContext): ToolDefinition[] {
  return [
    {
      name: "acts_sandbox_exec",
      description:
        "Execute a short script in an isolated subprocess (node, bash, sh, python). Returns stdout/stderr/exit code. Use this instead of pulling raw data into context.",
      inputSchema: {
        type: "object",
        properties: {
          runtime: {
            type: "string",
            enum: [...SUPPORTED_RUNTIMES],
            description: "Script runtime.",
          },
          script: { type: "string", description: "Script source code." },
          timeout_ms: { type: "number", description: "Wall-clock timeout (default 30000)." },
          cwd: { type: "string", description: "Working directory (default: temp)." },
          args: {
            type: "array",
            items: { type: "string" },
            description: "Extra argv after the script.",
          },
        },
        required: ["runtime", "script"],
        additionalProperties: false,
      },
      handler: async (input) => {
        const result = await executeScript({
          runtime: str(input.runtime) as SandboxRuntime,
          script: str(input.script),
          cwd: typeof input.cwd === "string" ? input.cwd : undefined,
          timeoutMs: num(input.timeout_ms, 30_000),
          args: Array.isArray(input.args) ? (input.args as string[]) : undefined,
        });
        return result;
      },
    },
    {
      name: "acts_sandbox_index",
      description:
        "Index a blob of text into the content store (FTS5). Returns the content id and chunk count; the raw text stays out of context.",
      inputSchema: {
        type: "object",
        properties: {
          source: { type: "string", description: "Logical source key (file path, URL, etc.)." },
          text: { type: "string", description: "Text content to index." },
          title: { type: "string", description: "Optional display title." },
          mime: { type: "string", description: "Optional MIME type." },
          ttl_seconds: { type: "number", description: "Optional TTL in seconds." },
        },
        required: ["source", "text"],
        additionalProperties: false,
      },
      handler: (input) => {
        return indexContent(ctx.db, {
          source: str(input.source),
          text: str(input.text),
          title: typeof input.title === "string" ? input.title : undefined,
          mime: typeof input.mime === "string" ? input.mime : undefined,
          ttlSeconds: typeof input.ttl_seconds === "number" ? input.ttl_seconds : undefined,
        });
      },
    },
    {
      name: "acts_sandbox_search",
      description:
        "Search indexed content via FTS5 BM25. Returns ranked snippets with source and chunk id.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          source: { type: "string", description: "Optional source filter." },
          limit: { type: "number", description: "Max hits (default 10)." },
        },
        required: ["query"],
        additionalProperties: false,
      },
      handler: (input) => {
        return searchContent(ctx.db, str(input.query), {
          source: typeof input.source === "string" ? input.source : undefined,
          limit: num(input.limit, 10),
        });
      },
    },
    {
      name: "acts_sandbox_fetch",
      description:
        "Fetch a URL and index its text content. HTML is stripped to plain text before indexing. Results are cached for 24h by default.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "Absolute http(s) URL." },
          title: { type: "string", description: "Optional display title." },
          ttl_seconds: { type: "number", description: "Cache TTL in seconds." },
          timeout_ms: { type: "number", description: "Fetch timeout (default 15000)." },
        },
        required: ["url"],
        additionalProperties: false,
      },
      handler: async (input) => {
        return fetchAndIndex(ctx.db, {
          url: str(input.url),
          title: typeof input.title === "string" ? input.title : undefined,
          ttlSeconds: typeof input.ttl_seconds === "number" ? input.ttl_seconds : undefined,
          timeoutMs: typeof input.timeout_ms === "number" ? input.timeout_ms : undefined,
        });
      },
    },
  ];
}
