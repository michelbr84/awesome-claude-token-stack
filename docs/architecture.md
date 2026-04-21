# Architecture

`awesome-claude-token-stack` is a pnpm workspace of seven TypeScript packages
that collaborate through a single SQLite database. This document explains how
those pieces fit together, what lives where, and the design decisions behind
the layout.

## High-level diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  Agent / IDE (Claude Code · Cursor · Gemini CLI · Codex · ...)   │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                 stdio JSON-RPC (MCP)
                           │
┌──────────────────────────┴───────────────────────────────────────┐
│                        @acts/mcp  (stdio server)                  │
│                                                                    │
│       15 tools, capped at 20 (PLAN.md §17 — hard compile rail)    │
├──────────────┬───────────────┬──────────────┬────────────────────┤
│ @acts/       │ @acts/        │ @acts/       │ @acts/             │
│ compress     │ sandbox       │ observe      │ memory             │
│              │               │              │                    │
│ - filters    │ - executor    │ - quality    │ - observations     │
│ - claudeMd   │ - indexer     │ - session    │ - disclosure       │
│ - terseMode  │ - search      │ - archive    │ - decay            │
│              │ - fetchIndex  │ - checkpoint │                    │
├──────────────┴───────────────┴──────────────┴────────────────────┤
│                         @acts/core  (storage)                     │
│                                                                    │
│  db · schema · migrations · paths · hash · tokens · row types     │
│              better-sqlite3 · WAL · FTS5 · pragmas                │
└──────────────────────────────────────────────────────────────────┘
                           │
                   .acts/store.db  (single file, per project)
```

On top sits **@acts/cli** — the `acts` binary — which provides a terminal
surface over the same underlying packages.

## Why one database

Every layer needs durable storage. We could give each layer its own file (and
some upstream projects do), but a single `.acts/store.db` wins in practice:

- **Cross-layer queries are trivial.** The observer can correlate compression
  events with quality scores without coordinating two files.
- **Backup, delete, and portability are one file operation.** `rm -rf .acts`
  is a complete reset; `.acts/store.db` can be copied to another machine.
- **WAL mode handles concurrent readers.** The MCP server, the CLI, and the
  external observer can all hold open handles simultaneously without blocking.
- **FTS5 is cheap per-table.** One database with multiple virtual tables is
  lighter than multiple databases each with a virtual table.

## Package layout

```
packages/
├── core/        → SQLite handle, schema, migrations, shared types
├── compress/    → output filters + CLAUDE.md + terse skill
├── sandbox/     → executor + content index/search + URL fetch
├── observe/     → quality score + session/turn tracker + archive + checkpoints
├── memory/      → observations with 3-layer progressive disclosure
├── mcp/         → @modelcontextprotocol/sdk stdio server
└── cli/         → `acts` binary (commander)
```

Dependency direction is strictly downward: **core** is depended on by all;
**compress/sandbox/observe/memory** depend only on **core**; **mcp** depends
on all four leaf packages and **core**; **cli** depends on everything. This
lets a downstream user install just one leaf layer if they want — e.g., only
`@acts/memory` — without pulling the rest of the stack.

## `@acts/core` — the foundation

### Schema

All tables are created by a single `SCHEMA_SQL` string in `schema.ts` and
applied via a migration runner in `migrations.ts`. The schema covers:

| Table | Purpose |
|---|---|
| `sessions` | Per-session lifecycle rows (start/end, agent, cwd). |
| `turn_metrics` | Per-turn token counts and context-fill percentages. |
| `quality_scores` | Computed quality scores with 7-signal JSON payloads. |
| `observations` | Persistent memory entries (kind, title, body, tags, validity). |
| `observations_fts` | FTS5 virtual table mirroring observations for BM25 search. |
| `content` | Indexed text blobs (files, URLs, docs). |
| `content_chunks` | Sub-chunks of each content blob. |
| `content_fts` | FTS5 virtual table over the chunks. |
| `tool_results` | Archived tool outputs retrievable by short id. |
| `checkpoints` | Session snapshots for compaction survival. |
| `compression_events` | Before/after token measurements per compression event. |

### Pragmas

On open we set:

```
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;     -- enables concurrent readers
PRAGMA synchronous = NORMAL;    -- WAL-recommended durability/speed tradeoff
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 128 MiB;
```

In-memory databases (used by tests) skip the WAL pragma since it is not
compatible with `:memory:`.

### Migrations

`MIGRATIONS` is a static array of `{ version, name, up(db) }`. The runner
records the applied version in `_acts_meta.schema_version` and never
downgrades. Adding a migration is a matter of appending a new entry; existing
stores will pick it up on next open without extra ceremony.

### Token estimation

`estimateTokens(text)` is a dependency-free heuristic: it blends
char-per-token (4) and word-per-token (0.75) estimates and returns the larger.
This is deliberately an approximation — the goal is **relative** measurement
(compression savings, quality deltas, budget rails) where ±15% accuracy
compared to real tokenizer counts is sufficient. We ship no tiktoken binding;
if you want pixel-perfect counts, swap in your own counter at the call site.

## `@acts/compress` — lossy for the verbose, lossless for the meaningful

### CLI output filter engine

`compressCommand({ command, output, exitCode })` routes to the first handler
that matches the command name. Handlers live in `src/filters/` and each
exports a small object:

```ts
interface FilterHandler {
  name: string;
  match: (input: FilterInput) => boolean;
  apply: (input: FilterInput) => string;
}
```

Shipped handlers: `git-status`, `git-log`, `git-diff`, `pm-install` (npm /
pnpm / yarn / bun), `pm-run`, `docker-ps`, `pytest`. Anything that doesn't
match falls through to a generic middle-truncation that keeps head + tail and
marks the omitted region with a `[N lines omitted]` separator.

### CLAUDE.md compressor

`compressClaudeMd(source)` performs a series of lossless-for-instructions
rewrites:

- Preserves fenced code blocks verbatim (counted for reporting).
- Preserves URLs verbatim.
- Strips HTML comments entirely.
- Collapses runs of blank lines to a single blank line.
- Removes filler phrases (`Please note that`, `It should be noted that`,
  `Importantly,`, etc.) the model already internalizes.
- Trims trailing whitespace and leading/trailing blank lines.

The result is a Markdown file that compiles to the same *instructions* as the
input but carries less token overhead. Claim verification is measured, not
promised: every compression event is logged to `compression_events` for your
own before/after analysis.

### `acts-terse` skill

`terseSkillMarkdown(level)` returns the Markdown body of an agent-facing
skill with three intensity levels: `lite`, `full`, `ultra`. Drop the output
into your agent's skills directory to enable a controllable output-compression
mode. Which level to use is a user decision; the skill does not try to
auto-activate.

## `@acts/sandbox` — keep the data out, keep the agent in

### Executor

`executeScript({ runtime, script, timeoutMs, maxOutputBytes })` runs a script
in a subprocess. We:

- **Never** use `shell: true`. The script is written to a temp file and
  `execFile`'d with the runtime binary. No shell interpolation, no injection.
- Enforce a default **30s timeout** and **1 MiB output cap**. Overrides allowed.
- Return structured `{ exitCode, stdout, stderr, durationMs, truncated, timedOut }`.
- Clean up the temp dir on every path, including errors.

Supported runtimes: `node`, `bash`, `sh`, `python`, `python3`. On Windows,
`bash`/`sh` rely on Git Bash or WSL being on PATH. Adding a runtime is
mechanical — extend `SUPPORTED_RUNTIMES` and `fileExtension()`.

### Content index and search

`indexContent(db, { source, text })` chunks text at paragraph boundaries (with
a hard-split fallback for oversize paragraphs), writes the chunks to
`content_chunks`, and the trigger-backed `content_fts` virtual table keeps the
search index in sync automatically. Re-indexing with the same source is a
no-op if the SHA-256 of `text` is unchanged — otherwise the old record is
replaced.

`searchContent(db, query, { source?, limit? })` uses FTS5 BM25 ranking with
`snippet()` for compact excerpts. The query is sanitized: each whitespace
token is quoted, operator keywords (`AND`, `OR`, `NOT`, `NEAR`) are dropped,
and embedded quotes are stripped — this protects the engine from syntax
errors while accepting plain-English queries.

### URL fetch-and-index

`fetchAndIndex(db, { url })` checks for a cached, unexpired record first. On
miss, fetches with a 15s default timeout and 2 MiB default size cap, strips
HTML tags for `text/html` responses, and runs the result through
`indexContent`. Cache TTL defaults to 24 hours.

## `@acts/observe` — measurement over marketing

### 7-signal quality score

`computeQuality(partial)` accepts any subset of:

| Signal | Weight | Interpretation |
|---|---|---|
| `contextFill` | 0.20 | 1.0 = empty context; the caller should pass `1 - fill_ratio`. |
| `freshReads` | 0.20 | Fraction of file reads whose content has not been seen before. |
| `leanToolUse` | 0.20 | Fraction of tool results under the "bloat" token threshold. |
| `shallowCompact` | 0.15 | 1.0 = no compactions yet; decays with compaction depth. |
| `uniqueContent` | 0.10 | 1.0 = no content-hash duplicates in context. |
| `decisionDense` | 0.08 | Fraction of turns driven by user decisions. |
| `agentEfficient` | 0.07 | Normalized sub-agent spend ratio. |

Missing signals are treated as 1.0 (ideal) so partial observability never
invents problems. The weighted sum × 100 maps through `gradeForScore()` to
the S/A/B/C/D/F bands from PLAN.md §16.

### Session and turn tracking

`startSession(db, { agent, cwd })` issues a short, stable id.
`recordTurn(db, { sessionId, turnIndex, tokens, contextFill })` writes a row
per turn. `getSessionStats(db, id)` aggregates turn rows and — if a quality
score is present — joins the most recent score for the session.

### Tool-result archive

`archiveToolResult(db, { toolName, input, output })` hashes the output,
stores it keyed by a 12-char id, and returns a human-friendly "hint" string:

```
[acts-archive id=abc123def456 tokens=1204 tool=Grep] full output archived; call acts_archive_get(id) to retrieve.
```

The agent keeps this short hint in context instead of the full output and
calls back via `acts_archive_get(id)` — the MCP tool — when it needs the
payload.

### Progressive checkpoints

`createCheckpoint(db, { sessionId, contextFill, payload })` captures a JSON
snapshot of session state. The recommended thresholds are exported as
`CHECKPOINT_THRESHOLDS = [0.2, 0.35, 0.5, 0.65, 0.8]`. Taking snapshots
progressively (not just at emergency compaction time) means a post-compaction
session has something useful to restore from regardless of which boundary was
crossed.

## `@acts/memory` — 3-layer progressive disclosure

An "observation" is a durable unit of knowledge: a decision, a bugfix, a
convention, a warning. `OBSERVATION_KINDS` is the enum of allowed categories.

### The disclosure contract

Three retrieval layers, each with a progressively larger token budget:

| Layer | Function | Budget | Contents |
|---|---|---|---|
| 1 | `indexMemory(query)` | ~15 tok/hit | id, kind, title, tags |
| 2 | `searchMemory(query)` | ~60 tok/hit | id, kind, title, summary, score, tags |
| 3 | `getMemory(id)` | ~200 tok | full body, source, metadata |

An agent pays for what it actually reads: cheap surveys at layer 1, targeted
context at layer 2, selective full reads at layer 3. This is the key insight
from [token-savior](https://github.com/Mibayy/token-savior)'s progressive
disclosure pattern, implemented from scratch.

### Decay and TTL

`pruneExpired(db)` deletes rows whose TTL has elapsed.  
`decayValidity(db, { factorPerWeek })` lowers the validity score of
observations that have not been accessed in a long time — old unused memories
become less trustworthy without being deleted outright.

Neither is automatic. Agents or cron jobs call them explicitly. The MCP
server does not run scheduled tasks.

## `@acts/mcp` — the tool surface

The MCP server registers 15 tools across the four leaf packages. The 20-tool
cap from PLAN.md §17 is enforced at registry-build time: adding a sixteenth
tool that pushes past the cap throws an error at startup, so you find out
before the manifest reaches any agent.

The server uses the official `@modelcontextprotocol/sdk` with a stdio
transport. All tool handlers are synchronous wrappers around package APIs —
the MCP layer is deliberately thin to keep behavior testable at the package
level, not just the tool level.

## `@acts/cli` — the operator surface

The `acts` binary is a commander-based tree of subcommands, each a thin
adapter over package APIs. A cross-cutting `--db <path>` override lets every
command target an alternate store — useful for tests, CI, or sharding per
workspace. The CLI is used by tests (see `packages/cli/test/`) and by the CI
smoke-test job.

## What's deliberately missing

Several design decisions deserve their own notes:

- **No vector search in v0.1.** Adding sqlite-vec + an embedding model
  doubles install complexity. Shipped when the benchmark harness can measure
  whether it actually helps. See [`roadmap.md`](./roadmap.md).
- **No auto-scheduled tasks.** No daemons, no cron, no timers. Decay and
  prune are explicit. If you want them automated, wire them to your agent's
  session-start hook.
- **No multi-agent coordination in v0.1.** Fleet auditing is a V3 concern; the
  current session tracker assumes one agent per database.
- **No TUI dashboard.** PLAN.md §12.1 proposes a single-file HTML analytics
  page; implemented in v0.3. Until then, query the DB directly — it's your
  data, it's in SQLite, it's portable.

## Further reading

- [`docs/getting-started.md`](./getting-started.md) — tutorial walkthrough.
- [`docs/mcp-integration.md`](./mcp-integration.md) — hooking into agents.
- [`docs/cli-reference.md`](./cli-reference.md) — every subcommand and flag.
- [`docs/benchmarks.md`](./benchmarks.md) — the measurement philosophy.
- [`docs/roadmap.md`](./roadmap.md) — what lands next.
- [`docs/contributing.md`](./contributing.md) — clean-room protocol and the
  per-package contribution workflow.
