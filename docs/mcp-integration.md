# MCP integration

`acts-mcp` is a stdio JSON-RPC server implementing the [Model Context
Protocol](https://modelcontextprotocol.io/). Any MCP-compatible agent can
spawn it and receive access to 15 tools across the four `acts` layers.

## The tool catalog (15 / 20)

| Package | Tool | Purpose |
|---|---|---|
| memory | `acts_memory_save` | Persist an observation. |
| memory | `acts_memory_index` | Layer 1: id + kind + title + tags (~15 tok/hit). |
| memory | `acts_memory_search` | Layer 2: title + summary + score (~60 tok/hit). |
| memory | `acts_memory_get` | Layer 3: full observation body. |
| memory | `acts_memory_list` | Browse recent observations by filter. |
| memory | `acts_memory_delete` | Permanently delete by id. |
| sandbox | `acts_sandbox_exec` | Execute a short script off-context. |
| sandbox | `acts_sandbox_index` | Index a text blob into the content store. |
| sandbox | `acts_sandbox_search` | FTS5 + BM25 ranked search. |
| sandbox | `acts_sandbox_fetch` | Fetch a URL, strip HTML, index the text. |
| observe | `acts_observe_score` | Compute the 7-signal quality score. |
| observe | `acts_observe_session_stats` | Aggregate stats for a session. |
| observe | `acts_archive_get` | Retrieve an archived tool result by id. |
| observe | `acts_archive_list` | List recent archives. |
| compress | `acts_compress_claude_md` | Compress a CLAUDE.md payload. |
| compress | `acts_compress_command` | Apply the CLI output filter. |

The cap is **20 tools** (PLAN.md §17) — adding a sixteenth tool that pushes
past the cap throws an error at registry-build time. Tool descriptions
consume manifest tokens; every addition is a deliberate budget decision.

## Transport

`acts mcp` (or the `acts-mcp` binary shipped by `@acts/mcp`) runs on stdio.
stdout is reserved for JSON-RPC traffic — **never** write to it from your own
code. Any logging goes to stderr.

The server honours `SIGINT` and `SIGTERM` for clean shutdown. The underlying
SQLite handle closes and the WAL checkpoints before exit.

## Database location

The server resolves `.acts/store.db` the same way the CLI does:

1. Explicit `ACTS_DB_PATH` environment variable wins.
2. Otherwise `resolveStoreDir` walks upward from the process cwd looking for
   an existing `.acts/` directory.
3. If none is found, the store is created in the first writable ancestor
   directory, or in the current cwd as a last resort.

Set `ACTS_DB_PATH` when you want one store per-workspace and the agent spawns
`acts-mcp` from a directory that is not the project root.

## Claude Code

Add to `~/.claude/claude_code_config.json` (or the per-project equivalent):

```json
{
  "mcpServers": {
    "acts": {
      "command": "node",
      "args": [
        "/absolute/path/to/awesome-claude-token-stack/packages/mcp/dist/bin/acts-mcp.js"
      ],
      "env": {
        "ACTS_DB_PATH": "${workspaceFolder}/.acts/store.db"
      }
    }
  }
}
```

A complete example lives in
[`examples/claude-code/`](../examples/claude-code/), including a snippet of
`settings.json` showing how to combine `acts-mcp` with Claude Code's
session-start hook for automatic quality scoring.

## Cursor

Cursor reads `~/.cursor/mcp.json` (or `.cursor/mcp.json` in the workspace):

```json
{
  "mcpServers": {
    "acts": {
      "command": "node",
      "args": ["/abs/path/to/acts-mcp.js"]
    }
  }
}
```

## Gemini CLI

Gemini CLI follows the `~/.gemini/mcp_servers.json` convention:

```json
{
  "servers": {
    "acts": {
      "command": "node",
      "args": ["/abs/path/to/acts-mcp.js"]
    }
  }
}
```

## Codex / OpenAI CLI

Codex uses `~/.codex/config.toml`:

```toml
[mcp.servers.acts]
command = "node"
args = ["/abs/path/to/acts-mcp.js"]
```

## Windsurf / Kiro / OpenCode / Zed

All follow the same pattern — a stdio spawn with `node` and the absolute path
to `acts-mcp.js`. Consult your agent's MCP documentation for the exact config
file; the invocation itself is identical across hosts.

## Integrating with hooks

The tools are agent-callable, but the best context hygiene happens when the
agent host also wires `acts` into its lifecycle hooks. For example, a
session-start hook that pre-loads recent decisions:

```bash
# .claude/hooks/session-start.sh
acts memory list --kind decision --limit 5 --json
```

Or a pre-compact hook that captures a checkpoint at the 65% boundary:

```bash
# pseudo-code — actual hook contracts are agent-specific
if (context_fill > 0.65):
  acts_observe_checkpoint_save --label "pre-compact-65"
```

Complete hook examples, including Claude Code `settings.json`, live in
[`examples/claude-code/`](../examples/claude-code/).

## Tool-result archiving

Some tools return large outputs. Instead of carrying them verbatim, agents
can archive:

1. Tool produces a large output.
2. The host wraps it in `acts_archive` and receives a hint:
   ```
   [acts-archive id=abc123def456 tokens=1204 tool=Grep] full output archived; call acts_archive_get(id) to retrieve.
   ```
3. Only the hint enters context. Token cost drops from ~1200 to ~30.
4. If the agent actually needs the content later, it calls
   `acts_archive_get(id)` and the full output is retrieved on demand.

This is the core value proposition of the observer layer: **no speculative
inclusion**. The agent decides what to pull back.

## Troubleshooting

**"EACCES" when opening the store**  
Check that the process has write permission to `.acts/`. The CLI falls back
to creating the store in `cwd/.acts/` if walking upward finds nothing.

**"SQLITE_BUSY" during heavy concurrent writes**  
WAL mode prevents most contention, but very high write volumes from multiple
agents can still collide. Run `acts db info` to confirm the path is what you
expect — two agents using different `.acts` directories will not contend.

**Native module fails to load**  
`better-sqlite3` ships prebuilds for common platforms. If yours isn't
supported, `node-gyp` rebuilds from source — which needs a C++ toolchain. On
macOS: `xcode-select --install`. On Ubuntu: `apt install build-essential`.
On Windows: recent Node.js installers bundle the build tools.

**stdout contains garbage JSON**  
Something printed to stdout from outside the MCP channel. `acts-mcp` is
careful to log only to stderr, but a child process spawned by
`acts_sandbox_exec` might write to stdout. The executor captures child stdout
in-band and returns it in the tool response — it never leaks to the server's
own stdout. If you see leakage, open an issue.

**Need to reset the store**  
`rm -rf .acts` — portable, total, no hidden state.
