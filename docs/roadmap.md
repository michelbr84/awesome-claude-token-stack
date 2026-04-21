# Roadmap

Informed by PLAN.md §20 / §22, adjusted for the v0.1.0 scoping decisions.

## Shipped — v0.1.0 (current)

- `@acts/core` — SQLite storage, FTS5, migrations, shared types.
- `@acts/compress` — filters (git, npm/pnpm/yarn/bun, docker, pytest), generic
  truncation, CLAUDE.md compressor, `acts-terse` skill (3 levels).
- `@acts/sandbox` — executeScript (node / bash / sh / python / python3),
  content indexer + FTS5 search, URL fetch-and-index.
- `@acts/observe` — 7-signal quality scoring, session/turn tracker, tool-result
  archive, progressive checkpoints.
- `@acts/memory` — observations, 3-layer disclosure (15 / 60 / 200 tok), TTL
  prune, validity decay.
- `@acts/mcp` — stdio MCP server, 15 tools ≤ 20-tool cap.
- `@acts/cli` — `acts` binary with 7 subcommand trees.
- CI: ubuntu + Node 20/22 matrix, lint, typecheck, test, build, smoke test.
- MIT license, zero network, zero telemetry.

## Next — v0.2 (target: ~8 weeks)

### `@acts/graph` — codebase intelligence

Per PLAN.md §11.4. Tree-sitter-based AST graph with:

- Parsing support for TypeScript, JavaScript, Python, Go, Rust (5 languages).
- Node types: functions, classes, imports.
- Edge types: calls, inheritance, test coverage.
- Incremental updates via content-hash diffing (SHA-256).
- `getBlastRadius(symbol)` — callers, dependents, tests affected.
- SQLite-backed with FTS5 on symbol names.
- MCP tools: `acts_graph_search_symbols`, `acts_graph_blast_radius`,
  `acts_graph_context`, `acts_graph_query`. Adds 4 tools → total 19/20.

**Licensing note:** Our implementation is inspired by `code-review-graph`
(MIT, full reuse allowed with attribution). We plan to vendor the tree-sitter
grammars we need and port a subset of CRG's analysis primitives with
attribution per `ATTRIBUTION.md`.

### Benchmark harness

PLAN.md §18. Three categories:

1. Token efficiency (30 tasks, 6 categories).
2. Context quality (100+ turn sessions).
3. Structural intelligence (6 open-source repos).

Reproducible via `pnpm benchmark`; raw data published with any claim.

### Platform adapter framework

`@acts/adapter` with first adapters for Claude Code, Gemini CLI, Cursor.
Common interface for PreToolUse, PostToolUse, PreCompact, SessionStart,
SessionEnd, UserPromptSubmit hooks.

### Compression improvements

- More filter handlers: `cargo`, `go test`, `ruff`, `prettier`, `tsc`.
- CLAUDE.md attention-curve optimizer (move high-attention content to the tail).
- TOML-based filter DSL for community contributions (PLAN.md §11.2).

### `pnpm-lock.yaml` shipped

Lockfile committed for reproducible installs; CI switches to
`pnpm install --frozen-lockfile`.

## Later — v0.3 (target: ~16 weeks)

### `@acts/dashboard`

Single-file HTML analytics page (PLAN.md §12.1). Per-turn token breakdown,
quality score history, savings tracker, session drill-down. Self-contained
— no build step, no network.

### `@acts/coach`

Proactive waste detectors (PLAN.md §12.2):

- Retry-loop detection.
- Overpowered model for trivial task.
- Bad decomposition signal.
- CLAUDE.md / MEMORY.md structural audit.

### `@acts/vector`

Local-first vector search (PLAN.md §12.3) via `sqlite-vec` + an in-process
embedding model (ONNX + `all-MiniLM-L6-v2`). Hybrid BM25 + dense with RRF
fusion. Cloud embedding providers (OpenAI, Voyage, Ollama) as opt-in
plugins — never default.

### Rust compressor

The TS compressor is sufficient for v0.1, but a Rust binary sidesteps Node
startup overhead and opens the door to shell-level command interception
(PLAN.md §4.1, RTK-style). Build via `cargo-xwin` / `cross-rs` for
cross-platform prebuilds.

## Further out — v1.x and beyond

- **`@acts/viz`** — D3.js interactive graph visualization (PLAN.md §12.4).
- **`@acts/fleet`** — multi-agent auditing (PLAN.md §12.5).
- **Cross-project memory sharing** — one global memory store with per-project
  namespaces.
- **More language support for the graph** — Java/Kotlin, Ruby, PHP, C#.
- **Community filter contributions** — TOML-based filter DSL with an open
  contribution flow.
- **IDE extensions** — VS Code, JetBrains, Zed. Reuse the same MCP stdio
  server, add IDE-native UI affordances.

## Principles that will not change

Regardless of how much we ship above, these stay:

1. **Local-first.** No required network, no required cloud backend, no
   telemetry. Cloud backends are always opt-in and always clearly labeled.
2. **Cache-safe.** Never modify content already in context. All compression
   works on *new* content entering the window or *structural* files
   (CLAUDE.md, MEMORY.md) between sessions.
3. **≤20 MCP tools.** The manifest itself is a context-token tax.
4. **Measured, not promised.** Every optimization logs before/after counts.
   Claims wait for the benchmark harness.
5. **Fail-open.** Hook and tool failures never block the agent.
