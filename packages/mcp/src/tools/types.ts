import type { Database } from "better-sqlite3";

export type ToolInput = Record<string, unknown>;
/** Tool handlers can return any JSON-serializable value; the server stringifies. */
export type ToolOutput = unknown;
export type ToolHandler = (input: ToolInput) => Promise<ToolOutput> | ToolOutput;

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the tool's input arguments. */
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  handler: ToolHandler;
}

export interface ToolContext {
  db: Database;
}
