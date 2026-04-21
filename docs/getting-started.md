# Getting started

This walkthrough takes you from zero to an `acts` store wired into Claude Code
in about five minutes.

> **Prerequisites:** Node.js 20+ and a recent pnpm (9.x). `better-sqlite3`
> needs a C++ toolchain on your platform — Ubuntu comes with one out of the
> box; macOS needs Xcode command-line tools; Windows needs MSVC build tools
> (installed automatically by recent Node versions).

## 1. Install

```bash
git clone https://github.com/michelbr84/awesome-claude-token-stack
cd awesome-claude-token-stack
pnpm install
pnpm build
```

The `pnpm build` step compiles all seven packages via project references and
produces `packages/*/dist/` directories.

To use `acts` as a shell command:

```bash
pnpm --filter @acts/cli link --global
# now `acts` is on your PATH
acts --version
```

Or invoke it directly:

```bash
node packages/cli/dist/bin/acts.js --version
```

## 2. Initialize a project store

From the root of the project you want to observe:

```bash
cd ~/projects/my-api
acts init
```

This creates:

- `.acts/store.db` — the SQLite database (WAL-mode, FTS5-enabled)
- A `.gitignore` entry for `.acts/` (created or appended)

The store is per-project. There's no global state; running `acts init` in a
different project creates an independent store.

## 3. Save your first observations

```bash
acts memory save \
  --kind decision \
  --title "Auth: JWT with RS256" \
  --body "1h access tokens, 30d refresh tokens. Rotate signing key every 90 days." \
  --tag auth --tag security

acts memory save \
  --kind convention \
  --title "Naming: snake_case in DB, camelCase in TS" \
  --body "All columns and table names use snake_case. All TypeScript fields use camelCase. Mappers live in src/db/mapping.ts." \
  --tag naming --tag convention
```

List what you've stored:

```bash
acts memory list
```

Search it back with progressive disclosure:

```bash
acts memory search "auth"            # layer 2 (default) — title + summary
acts memory search "auth" --layer index   # layer 1 — title only (~15 tok/hit)
acts memory get <id>                 # layer 3 — full body (bumps access count)
```

## 4. Compress a file or command

The terse skill can be emitted on demand:

```bash
acts compress terse-skill --level full > .claude/skills/acts-terse.md
```

CLAUDE.md compression:

```bash
acts compress claude-md CLAUDE.md -o CLAUDE.compressed.md
# stderr prints: raw -> compressed token counts and % savings
```

Compress the stdout of a verbose command:

```bash
git status | acts compress cmd git status
npm install 2>&1 | acts compress cmd npm install
```

Combine with a shell alias for a one-command pattern:

```bash
alias gs='git status | acts compress cmd git status'
```

## 5. Drive the sandbox

The sandbox is the "don't ingest, search" pattern. You index once and query
many times — the raw data never enters agent context:

```bash
# Index a large file
acts sandbox index -f ./docs/massive-api-reference.md --source api-ref

# Search it later
acts sandbox search "pagination"
```

Execute scripts without pulling their output into context unless you actually
want it:

```bash
echo 'console.log(process.versions.node)' | acts sandbox exec --runtime node
```

## 6. Measure quality

`acts observe score` computes the 7-signal quality metric from explicit
signal values — useful for manual probing:

```bash
acts observe score --context-fill 0.45 --fresh-reads 0.9 --lean-tool-use 0.8
# acts quality: 89/100 (A)
```

In practice an agent wires this into its session-start hook to score each
turn. The scores are persisted to `quality_scores` and queryable via
`acts observe stats`.

## 7. Connect to an agent

The MCP server speaks stdio JSON-RPC:

```bash
acts mcp
# — launches on stdio; expects an MCP-compatible parent process
```

Use the integration snippets in
[`docs/mcp-integration.md`](./mcp-integration.md) to register `acts-mcp` with
Claude Code, Cursor, Gemini CLI, or Codex.

A ready-to-copy Claude Code config lives in
[`examples/claude-code/`](../examples/claude-code).

## 8. Inspect the store

Everything is a plain SQLite file. You can open it with any tool:

```bash
sqlite3 .acts/store.db
sqlite> .tables
sqlite> SELECT kind, title FROM observations ORDER BY updated_at DESC LIMIT 5;
sqlite> SELECT * FROM compression_events ORDER BY at DESC LIMIT 5;
```

Or the `acts` CLI:

```bash
acts status
acts db info
```

## What to read next

- [`architecture.md`](./architecture.md) — how the pieces fit together.
- [`cli-reference.md`](./cli-reference.md) — every subcommand.
- [`mcp-integration.md`](./mcp-integration.md) — agent wiring details.
- [`benchmarks.md`](./benchmarks.md) — the measurement philosophy and honest
  claim status.
