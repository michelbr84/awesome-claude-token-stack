import { openDatabase } from "@acts/core";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

import { buildToolRegistry } from "./tools/index.js";

export const MCP_SERVER_NAME = "acts";
export const MCP_SERVER_VERSION = "0.1.0";

export interface StartServerOptions {
  dbPath?: string;
}

/**
 * Boots an MCP server over stdio. The parent process (Claude Code, Gemini
 * CLI, Cursor, etc.) spawns this and communicates via JSON-RPC.
 *
 * Returns a promise that resolves once the transport has connected. The
 * process keeps running on stdio; callers should not `await` forever unless
 * they actually want to block on the server.
 */
export async function startMcpServer(options: StartServerOptions = {}): Promise<() => void> {
  const handle = openDatabase({ path: options.dbPath });
  const tools = buildToolRegistry(handle.db);

  const server = new Server(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.name === request.params.name);
    if (!tool) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Unknown tool: ${request.params.name}. Known: ${tools.map((t) => t.name).join(", ")}.`,
          },
        ],
      };
    }
    try {
      const result = await tool.handler(request.params.arguments ?? {});
      const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
      return { content: [{ type: "text", text }] };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `acts tool error (${tool.name}): ${(err as Error).message}`,
          },
        ],
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = () => {
    try {
      void server.close();
    } catch {
      // ignore
    }
    try {
      handle.close();
    } catch {
      // ignore
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return shutdown;
}
