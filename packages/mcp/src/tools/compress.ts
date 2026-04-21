import { compressClaudeMd, compressCommand } from "@acts/compress";

import type { ToolContext, ToolDefinition } from "./types.js";

function str(val: unknown, def = ""): string {
  return typeof val === "string" ? val : def;
}

export function compressTools(_ctx: ToolContext): ToolDefinition[] {
  return [
    {
      name: "acts_compress_claude_md",
      description:
        "Compress a CLAUDE.md (or similar instructions file) by removing filler prose, collapsing whitespace, and stripping HTML comments while preserving code blocks and URLs. Returns the compressed output and savings.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Raw CLAUDE.md content." },
        },
        required: ["text"],
        additionalProperties: false,
      },
      handler: (input) => compressClaudeMd(str(input.text)),
    },
    {
      name: "acts_compress_command",
      description:
        "Apply the acts command-output filter to stdout of a shell command. Useful for shrinking git/npm/pytest/docker output before it enters context.",
      inputSchema: {
        type: "object",
        properties: {
          command: {
            type: "array",
            items: { type: "string" },
            description: "Argv, e.g. ['git', 'status'].",
          },
          output: { type: "string", description: "Raw stdout (and stderr merged)." },
          exit_code: { type: "number" },
          max_tokens: { type: "number", description: "Optional target post-compression size." },
        },
        required: ["command", "output"],
        additionalProperties: false,
      },
      handler: (input) => {
        const cmd = Array.isArray(input.command) ? (input.command as string[]) : [];
        return compressCommand({
          command: cmd,
          output: str(input.output),
          exitCode: typeof input.exit_code === "number" ? input.exit_code : undefined,
          maxTokens: typeof input.max_tokens === "number" ? input.max_tokens : undefined,
        });
      },
    },
  ];
}
