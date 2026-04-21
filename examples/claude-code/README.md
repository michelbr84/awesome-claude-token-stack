# Using `acts` with Claude Code

This example shows a minimal but complete Claude Code setup that:

1. Registers `acts-mcp` as an MCP server, exposing all 15 `acts` tools.
2. Calls `acts observe session_stats` at session start to warm up the
   quality score history.
3. Archives large tool results via the tool-result archive so they can be
   retrieved on demand via `acts_archive_get`.

## Files in this directory

- [`claude-code-config.json`](./claude-code-config.json) — add-to-config for
  `~/.claude/claude_code_config.json`. Registers the MCP server.
- [`settings.json`](./settings.json) — per-project
  `.claude/settings.json` snippet showing how to wire hooks.
- [`acts-terse.md`](./acts-terse.md) — the skill file from
  `@acts/compress`'s `terseSkillMarkdown('full')` output. Drop into
  `.claude/skills/`.

## Step-by-step

### 1. Build `acts-mcp`

From the repo root:

```bash
pnpm install
pnpm build
```

Note the absolute path to `packages/mcp/dist/bin/acts-mcp.js`.

### 2. Register the MCP server

Paste the `mcpServers.acts` block from
[`claude-code-config.json`](./claude-code-config.json) into your Claude Code
config, substituting the absolute path.

### 3. Copy the hook config

Copy [`settings.json`](./settings.json) into your project's
`.claude/settings.json` (merge if one already exists). The relevant keys are
under `hooks.SessionStart` and `hooks.PostToolUse`.

### 4. Copy the terse skill (optional)

Drop [`acts-terse.md`](./acts-terse.md) into `.claude/skills/`. Activate it
from Claude Code when you want 50–70% output-token compression.

### 5. First run

Open a Claude Code session in the project. You should see:

- `acts` tools listed in the MCP tool panel.
- A `.acts/store.db` created on first tool call (if not already present).
- The session-start hook logs the resolved DB path to stderr.

Try asking the agent:

> Save an observation of kind 'decision' with title 'Use acts' and body 'We
> are using the acts stack for context hygiene.'

The agent should use `acts_memory_save` and return the new id. Follow up
with:

> Search my memory for decisions about 'acts'

and the agent should call `acts_memory_index` or `acts_memory_search`.

## What the hooks do

`SessionStart` runs `acts observe stats --json` to surface the last
session's numbers — Claude Code shows this output in the startup panel so
you can see trends across sessions without calling a tool.

`PostToolUse` is where you would, in a more advanced setup, pipe the tool
output through `acts_compress_command` for commands known to be verbose.
The example here shows the pattern without enforcing it for every tool call.

## Troubleshooting

**Tools don't appear in Claude Code**  
Check the path in `claude-code-config.json` — MCP server registration fails
silently on bad paths. Look for "MCP server failed to start" in
`~/.claude/logs/`.

**Permission denied on `.acts/store.db`**  
Your agent is running from a directory that can't write `.acts/`. Set
`ACTS_DB_PATH` to an explicit writable path in the `env` block.

**Session-start hook does not run**  
Confirm `hooks.SessionStart` syntax matches Claude Code's expected schema.
Hook format can change between CLI versions; `claude --help hooks` shows the
current spec.
