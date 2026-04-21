# Changelog

All notable changes to `awesome-claude-token-stack` are documented in this
file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] — 2026-04-21

Initial public release. Implements the MVP defined by
[PLAN.md §21](./PLAN.md#21-mvp-definition) plus the memory layer.

### Added — packages

- **`@acts/core`** — SQLite (WAL + FTS5) storage layer with schema
  migrations, token-count estimator, SHA-256 hash helpers, and shared row
  types.
- **`@acts/compress`** — CLI output filters for git (`status`, `log`,
  `diff`), npm / pnpm / yarn / bun (`install`, `run`), docker (`ps`,
  `images`), pytest; generic middle-truncation fallback; CLAUDE.md
  compressor that preserves code blocks and URLs; `acts-terse` skill with
  three intensity levels (lite / full / ultra).
- **`@acts/sandbox`** — script executor for node / bash / sh / python /
  python3 (execFile, no shell interpolation, 30s default timeout, 1 MiB
  output cap); content indexer with paragraph-aware chunking; FTS5 BM25
  search with query sanitization; URL fetch-and-index with 24h cache.
- **`@acts/observe`** — 7-signal quality score (S/A/B/C/D/F); session and
  turn tracker with aggregate stats; tool-result archive with
  `[acts-archive id=…]` hints; progressive checkpoints at 20/35/50/65/80%
  fill.
- **`@acts/memory`** — observation store with 9 kinds (decision, bugfix,
  convention, guardrail, note, warning, pattern, reference, todo); 3-layer
  progressive disclosure (index / search / get at 15 / 60 / 200 tokens);
  TTL-based prune; weekly validity decay.
- **`@acts/mcp`** — stdio MCP server exposing 15 tools across the four
  leaf packages; hard-capped at 20 tools per PLAN.md §17.
- **`@acts/cli`** — `acts` binary with `init`, `status`, `compress`,
  `memory`, `sandbox`, `observe`, `mcp`, and `db` subcommand trees.

### Added — infrastructure

- GitHub Actions CI (ubuntu-latest × Node 20/22 matrix) with lint,
  typecheck, build, test, format-check, and CLI smoke tests.
- GitHub Actions release workflow triggered by `v*.*.*` tags.
- Workspace config (pnpm 9.12.3, TypeScript 5.6, Vitest 2.1).
- MIT license for the product; attribution to ClaudeMaxPower / Superpowers
  for the engineering harness.
- Examples directory with Claude Code MCP + hooks configuration.
- Full product docs: architecture, getting-started, MCP integration, CLI
  reference, benchmarks (with honest upstream claim review), roadmap,
  contributing.

### Design decisions

- **TypeScript-only** for the v0.1 implementation (pragmatic pivot from the
  TS + Rust + Python target in PLAN.md §11 — Rust compressor deferred to
  v0.3). Single toolchain, single CI path, fewer platform pitfalls.
- **Local-first and offline by default.** Zero telemetry, zero analytics,
  zero network calls in the hot path. `@acts/sandbox`'s URL fetcher is the
  only outbound call in the codebase and is explicitly opt-in.
- **Cache-safe.** No module modifies content already in the agent's
  context — compression applies to new content entering the window or to
  between-session structural files.
- **Clean-room** for any feature inspired by `context-mode` (ELv2) or
  `token-optimizer` (PolyForm NC). No upstream source consulted for those
  features' implementations.

### Not included (deliberately deferred)

- Tree-sitter AST graph / blast-radius analysis → v0.2.
- Reproducible benchmark harness → v0.2.
- Platform adapters beyond Claude Code → v0.2 (Cursor and Gemini CLI first).
- HTML analytics dashboard → v0.3.
- Vector search via sqlite-vec + ONNX embeddings → v0.3.
- Waste-detector coach mode → v0.3.
- Rust compressor → v0.3.
- Fleet auditing, cross-project memory, IDE extensions → v1.x.

See [`docs/roadmap.md`](./docs/roadmap.md) for the full plan.

[0.1.0]: https://github.com/michelbr84/awesome-claude-token-stack/releases/tag/v0.1.0
