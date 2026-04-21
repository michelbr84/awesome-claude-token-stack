# awesome-claude-token-stack

> **Local-first toolkit for AI coding agents.** Compress what enters context,
> keep raw data out of context via a sandbox, remember the important stuff
> across sessions, and measure whether any of it actually works — all from a
> single SQLite file in `.acts/`, with zero cloud dependencies and no
> telemetry.

[![CI](https://github.com/michelbr84/awesome-claude-token-stack/actions/workflows/ci.yml/badge.svg)](https://github.com/michelbr84/awesome-claude-token-stack/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-stdio-blue)](https://modelcontextprotocol.io/)

---

## Why

Coding agents get dumber as their context fills with noise: paginated `git log`
output, megabytes of dependency install chatter, the same file read five times,
stale decisions repeated every session. The fix is not a bigger context window;
it is **keeping the context clean**.

`awesome-claude-token-stack` gives you four composable layers that each address
one axis of the problem. You can install any layer standalone — they enhance
each other but do not require each other.

| Layer             | Package                                 | What it does                                                                                                                                  |
| ----------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Compression**   | [`@acts/compress`](./packages/compress) | Filters verbose shell output (git, npm, pytest, docker) and compresses `CLAUDE.md` / instruction files while preserving code blocks and URLs. |
| **Sandbox**       | [`@acts/sandbox`](./packages/sandbox)   | Off-context script execution plus an FTS5-indexed content store so agents search, don't ingest.                                               |
| **Observability** | [`@acts/observe`](./packages/observe)   | 7-signal quality score with S/A/B/C/D/F grade, per-turn token tracking, progressive checkpoints, tool-result archive.                         |
| **Memory**        | [`@acts/memory`](./packages/memory)     | Persistent observations (decisions, bugfixes, conventions) with 3-layer progressive disclosure (15 / 60 / 200 tokens).                        |

A fifth layer — **codebase intelligence** (Tree-sitter AST graph with
blast-radius analysis) — is planned for v0.2. See [`docs/roadmap.md`](./docs/roadmap.md).

Everything shares a single SQLite database (`.acts/store.db`) with WAL mode
and FTS5 virtual tables. No network calls, no analytics, no phone-home.

## Quick start

```bash
# install (from the repo for now — npm packages land in v0.2)
git clone https://github.com/michelbr84/awesome-claude-token-stack
cd awesome-claude-token-stack
pnpm install
pnpm build

# initialize a store in your project
cd /path/to/your/project
node /path/to/acts-repo/packages/cli/dist/bin/acts.js init

# save your first observation
acts memory save \
  --kind decision \
  --title "Use MIT license" \
  --body "Chosen for broad compatibility with downstream users." \
  --tag legal --tag v1

# search it back with the layer-1 (id + title + tags) disclosure
acts memory search "MIT" --layer index
```

Once installed globally (`npm link` or `pnpm link --global` from
`packages/cli`), `acts` is available on your PATH.

## Connecting to Claude Code (MCP)

The `acts-mcp` stdio server exposes **15 MCP tools** (well under the 20-tool
budget from [PLAN.md §17](./PLAN.md#17-editor-agent-mcp-integration-strategy))
across the four layers. Add this to your Claude Code MCP config:

```json
{
  "mcpServers": {
    "acts": {
      "command": "node",
      "args": ["/absolute/path/to/awesome-claude-token-stack/packages/mcp/dist/bin/acts-mcp.js"],
      "env": { "ACTS_DB_PATH": "${workspaceFolder}/.acts/store.db" }
    }
  }
}
```

A ready-to-copy example lives in [`examples/claude-code/`](./examples/claude-code).
Cursor, Gemini CLI, Codex, and Windsurf follow a similar pattern — see
[`docs/mcp-integration.md`](./docs/mcp-integration.md).

## The MCP tool surface (15/20)

```
memory:    acts_memory_save         acts_memory_index
           acts_memory_search       acts_memory_get
           acts_memory_list         acts_memory_delete

sandbox:   acts_sandbox_exec        acts_sandbox_index
           acts_sandbox_search      acts_sandbox_fetch

observe:   acts_observe_score       acts_observe_session_stats
           acts_archive_get         acts_archive_list

compress:  acts_compress_claude_md  acts_compress_command
```

Each tool description is concise because **the manifest itself consumes
context tokens**. Adding a tool that pushes the registry past 20 is a compile-time
error — a hard rail, not a guideline.

## Architecture at a glance

```
┌──────────────────────────────────────────────────────────────────┐
│  Agent / IDE (Claude Code · Cursor · Gemini CLI · Codex · ...)   │
└──────────────────────────┬───────────────────────────────────────┘
                           │  stdio JSON-RPC (MCP)
┌──────────────────────────┴───────────────────────────────────────┐
│                        @acts/mcp  (stdio server)                  │
├──────────────────────────────────────────────────────────────────┤
│  @acts/compress │ @acts/sandbox │ @acts/observe │ @acts/memory   │
│  filters, skill │ execFile,     │ 7-signal      │ observations,  │
│  CLAUDE.md      │ FTS5 index,   │ score +       │ 3-layer        │
│  rewriter       │ URL fetch     │ archive       │ disclosure     │
├──────────────────────────────────────────────────────────────────┤
│                         @acts/core  (storage)                    │
│     better-sqlite3 · WAL · FTS5 · migrations · token estimate    │
└──────────────────────────────────────────────────────────────────┘
                           │
                   .acts/store.db  (single file, per project)
```

Deeper dive: [`docs/architecture.md`](./docs/architecture.md).

## Status and honest benchmarks

**v0.1.0 (this release)** is the MVP defined by PLAN.md §21, plus the Memory
layer (small enough to include without breaking scope):

- ✅ CLI output compression (git, npm/pnpm/yarn/bun, pytest, docker, generic fallback)
- ✅ CLAUDE.md compressor + `acts-terse` skill (lite / full / ultra)
- ✅ Sandbox: script executor (node/bash/sh/python), FTS5 indexer, URL fetch-and-index
- ✅ Quality scoring (7-signal, S–F grades) with session tracking and checkpoints
- ✅ Tool-result archive with `[acts-archive id=…]` hints for agent-driven retrieval
- ✅ Persistent memory with progressive disclosure (index / search / get)
- ✅ MCP stdio server (15 tools ≤ 20-tool cap)
- ✅ `acts` CLI (`init`, `status`, `memory`, `sandbox`, `observe`, `compress`, `mcp`, `db`)
- ✅ MIT license, zero network calls, zero telemetry

**Explicitly deferred** to v0.2 / v0.3 (see [`docs/roadmap.md`](./docs/roadmap.md)):

- Tree-sitter AST graph / blast-radius analysis
- Vector search (sqlite-vec + ONNX embeddings)
- HTML dashboard
- Coach mode (waste detectors)
- Fleet auditing
- Rust acceleration for the compressor
- Platform adapters beyond Claude Code

**On benchmarks:** PLAN.md §18 documents a reproducible evaluation harness as
the standard for claims. We do not yet ship that harness, so we **do not
publish savings percentages**. What we ship are **measurements** — every
compression event is logged to the database with before/after token estimates,
so your own sessions generate your own numbers. See
[`docs/benchmarks.md`](./docs/benchmarks.md) for the benchmark plan and the
upstream claims we decline to parrot until independently validated.

## Development

```bash
pnpm install            # workspace install
pnpm build              # tsc --build across all packages
pnpm lint               # eslint
pnpm typecheck          # tsc --noEmit (alias of build)
pnpm test               # vitest run
pnpm test:watch         # interactive
pnpm format             # prettier write
pnpm format:check       # CI-mode format check
```

Each package (`@acts/core`, `@acts/compress`, etc.) is a standalone TypeScript
package with its own `package.json`, `tsconfig.json`, `src/`, and `test/`. See
[`docs/contributing.md`](./docs/contributing.md) for the contribution workflow,
clean-room protocol for code inspired by restrictively-licensed upstreams, and
the layer-by-layer module spec.

## Licensing and attribution

**This project is [MIT-licensed](./LICENSE).** See
[`ATTRIBUTION.md`](./ATTRIBUTION.md) for credit to the engineering harness
(`obra/superpowers` → `michelbr84/ClaudeMaxPower`) that drives the build
process.

Some upstream projects we studied carry restrictive licenses that prevent code
reuse:

- `mksglu/context-mode` — Elastic License v2 (concepts only; clean-room for any feature inspired by it)
- `alexgreensh/token-optimizer` — PolyForm Noncommercial 1.0.0 (concepts only; clean-room for any feature inspired by it)

The matrix in [PLAN.md §8](./PLAN.md#8-licensing--reuse--compliance-risks)
lists every upstream, its license, and which features are clean-room-only.
Where a feature here was inspired by one of those projects, we built it from
the conceptual description alone — no source was read for that feature, and
the implementation is independently written.

## Further reading

- [`PLAN.md`](./PLAN.md) — the full architectural brief and upstream analysis.
- [`docs/architecture.md`](./docs/architecture.md) — system architecture, storage schema, data flow.
- [`docs/getting-started.md`](./docs/getting-started.md) — step-by-step first session.
- [`docs/mcp-integration.md`](./docs/mcp-integration.md) — hooking acts into Claude Code, Cursor, Codex, Gemini CLI.
- [`docs/cli-reference.md`](./docs/cli-reference.md) — every `acts` subcommand and flag.
- [`docs/benchmarks.md`](./docs/benchmarks.md) — evaluation plan and an honest status of upstream claims.
- [`docs/roadmap.md`](./docs/roadmap.md) — what lands in v0.2, v0.3, and beyond.
- [`docs/contributing.md`](./docs/contributing.md) — how to contribute and the clean-room protocol.

---

_Questions, issues, ideas? Open an issue at
[github.com/michelbr84/awesome-claude-token-stack](https://github.com/michelbr84/awesome-claude-token-stack/issues)._
