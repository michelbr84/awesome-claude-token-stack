# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current Status: v0.1.0 implemented (MVP + memory layer)

This repo now ships the v0.1.0 implementation. The MVP defined in `PLAN.md`
§21 — compression + sandbox + observability for Claude Code — is live, plus
the memory layer (small enough to include without breaking scope).

- Monorepo: **pnpm workspaces**, 7 TypeScript packages under `packages/`.
- Language: **TypeScript-only for v0.1** (pragmatic pivot from the TS + Rust + Python target in PLAN §11 — Rust compressor deferred to v0.3).
- License: **MIT**.
- Storage: **single SQLite file** at `.acts/store.db` with WAL + FTS5.
- MCP tools: **15**, hard-capped at 20 (PLAN §17).
- CI: GitHub Actions on Ubuntu × Node 20 / 22, lint + build + test + smoke.

Build / test locally:

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm format:check
```

See `README.md` for end-user instructions, `docs/architecture.md` for the
system design, and `docs/roadmap.md` for what lands in v0.2 / v0.3.

## Open Questions — resolved in v0.1.0

PLAN.md §23 lists eight gating questions. All eight are resolved:

| #   | Question        | Decision                                                                                   |
| --- | --------------- | ------------------------------------------------------------------------------------------ |
| 1   | Project name    | `awesome-claude-token-stack`, scope `@acts/*`                                              |
| 2   | Languages       | **TypeScript-only** for v0.1; Rust deferred to v0.3; Python deferred to v0.2 (graph layer) |
| 3   | Tool count      | ≤ 20 (enforced at compile time in `@acts/mcp`)                                             |
| 4   | License         | MIT                                                                                        |
| 5   | MVP scope       | compression + sandbox + observability **plus** memory                                      |
| 6   | Naming          | `@acts/*`, `.acts/` store, `acts` CLI                                                      |
| 7   | Cloud vector DB | local-first only in v0.1; cloud backends deferred to v0.3 as opt-in                        |
| 8   | Monorepo tool   | pnpm workspaces                                                                            |

## The product

**awesome-claude-token-stack** — a local-first, MIT-licensed toolkit for AI
coding agents. Four layers ship in v0.1.0, a fifth arrives in v0.2:

1. **Compression** (`@acts/compress`, TS) — CLI output filtering, terse-mode skill, CLAUDE.md compressor. ✅ shipped in v0.1.
2. **Sandbox** (`@acts/sandbox`, TS/MCP) — off-context script execution, FTS5 index/search, URL fetch+index. ✅ shipped in v0.1.
3. **Intelligence** (`@acts/graph`, TS or Python) — Tree-sitter AST graph, blast radius, symbol nav. ⏳ v0.2.
4. **Memory** (`@acts/memory`, TS) — persistent observations with 3-layer progressive disclosure (15/60/200 tokens). ✅ shipped in v0.1.
5. **Observability** (`@acts/observe`, TS) — 7-signal quality scoring, progressive checkpoints, tool-result archiving. ✅ shipped in v0.1.

All packages share the single SQLite database at `.acts/store.db` (WAL + FTS5).

## Non-Negotiable Design Constraints (from PLAN.md)

These are hard constraints that any implementation must honor:

- **MCP tool count ≤ 20** (PLAN §17). Tool manifests consume context tokens; upstream projects with 65–105 tools demonstrate the anti-pattern. The proposed tool list is in §17.
- **Cache-safety guarantee** (PLAN §15). Never modify content already in conversation context. Compression only applies to _new_ content entering the window or _structural_ files (CLAUDE.md, MEMORY.md) between sessions. Prompt cache integrity must be preserved.
- **Local-first**. No network calls, no telemetry, no phone-home. Cloud backends (Zilliz, OpenAI embeddings) must be opt-in and clearly labeled.
- **Observer runs as external process** — zero context-token cost. Never inside the agent's context.
- **Fail-open hooks** — hook failures must never block tool execution.

## `upstream-research/` — Reference-Only Clones

This directory contains 10 cloned upstream projects analyzed in `PLAN.md` §4. Treat it as read-only reference material:

- **Do not modify anything under `upstream-research/`.** Each subdirectory has its own `LICENSE`.
- **Do not copy code from two of them:**
  - `upstream-research/context-mode/` — **Elastic License v2**. Clean-room only; concepts OK, code is off-limits.
  - `upstream-research/token-optimizer/` — **PolyForm Noncommercial 1.0.0**. Clean-room only; code reuse prohibited for any commercial purpose.
- The other eight are MIT or Apache-2.0 and code reuse is permitted with attribution.

The full license/reuse matrix is in `PLAN.md` §8. When implementing a feature inspired by `context-mode` or `token-optimizer`, document the clean-room process — describe the concept, then implement independently without reading the upstream source for that feature.

## Working With `PLAN.md`

`PLAN.md` is the contract for what will be built. When the user asks architectural questions, answer from it rather than re-deriving. Key sections:

- §5 — cross-repo feature matrix (which upstream solves which layer)
- §7 — Borrow / Rebuild / Avoid table
- §11 — per-module spec
- §17 — tool budget and proposed 18-tool list
- §18 — benchmark plan and which upstream claims are unvalidated
- §20 — phased roadmap (Phase 0 → Phase 4)
- §21 — MVP scope (compression + sandbox + observability; Claude Code only)
- §23 / Appendix E — eight open questions that gate Phase 0

If changes to the plan are needed, edit `PLAN.md` directly and flag the change to the user — don't silently drift from it in code.

---

## ClaudeMaxPower Integration

This project has **ClaudeMaxPower** (https://github.com/michelbr84/ClaudeMaxPower) installed as its engineering methodology harness. ClaudeMaxPower provides the skills, hooks, agents, and workflow scripts used to drive the project's future implementation — but it is **not** the product. The product is `awesome-claude-token-stack`, defined by `PLAN.md`.

Installed on: 2026-04-21. Install method: in-place merge (`cp -rn`), preserving all pre-existing files. `.github/workflows/` and `.github/rulesets/` from the ClaudeMaxPower template were intentionally omitted so they do not collide with the product's planned CI paths (PLAN.md Appendix A).

### Entry point

Run `/max-power` to activate the pipeline and see the capability menu. The skill is defined at `skills/max-power.md`; the slash-command wrapper is at `.claude/commands/max-power.md`.

### The Unified Pipeline (use this for any new feature)

```
Idea
 ├─ /brainstorming        → docs/specs/YYYY-MM-DD-<topic>-design.md   (hard gate: user approval required)
 ├─ /writing-plans        → docs/plans/YYYY-MM-DD-<topic>-plan.md     (bite-sized tasks)
 ├─ /using-worktrees      → isolated branch workspace
 ├─ /subagent-dev         → fresh subagent per task + two-stage review
 │    └─ /tdd-loop            (strict Red-Green-Refactor, iron law)
 │    └─ /systematic-debugging (root cause before fix)
 └─ /finish-branch        → merge / PR / keep / discard + worktree cleanup
```

Alternate entry points: `/fix-issue`, `/review-pr`, `/refactor-module`, `/assemble-team`, `/pre-commit`, `/generate-docs`.

### The Four Iron Laws (enforced by the skills above)

1. **No production code without a failing test first** (`/tdd-loop`)
2. **No implementation without an approved spec** (`/brainstorming` hard gate)
3. **No fixes without root cause investigation** (`/systematic-debugging` Phase 1)
4. **No merging with failing tests** (`/finish-branch` verification)

### Absolute rules (carry over from ClaudeMaxPower)

- **Never** commit `.env` or any file containing real secrets.
- **Never** push directly to `main` — always feature branch + PR.
- **Never** skip or mock tests when real implementations exist.
- **Never** bypass governance hooks: `session-start.sh`, `pre-tool-use.sh`, `post-tool-use.sh`, `stop.sh` (configured in `.claude/settings.json`).

### Layout reference (installed by ClaudeMaxPower)

| Path                    | Purpose                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `.claude/settings.json` | Hook config + `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`                                                        |
| `.claude/hooks/`        | session-start / pre-tool-use / post-tool-use / stop                                                           |
| `.claude/agents/`       | `code-reviewer`, `security-auditor`, `doc-writer`, `team-coordinator`                                         |
| `.claude/commands/`     | Auto-generated slash-command wrappers (from `scripts/generate-commands.py`)                                   |
| `skills/`               | Canonical skill definitions (source of truth)                                                                 |
| `scripts/setup.sh`      | One-shot bootstrap — tool checks, chmod, .env, venv, command wrappers                                         |
| `scripts/verify.sh`     | Local environment sanity check                                                                                |
| `workflows/`            | Batch scripts (`batch-fix.sh`, `parallel-review.sh`, `mass-refactor.sh`, `dependency-graph.sh`)               |
| `examples/todo-app/`    | Demo project used by some skills; has its own `.venv`                                                         |
| `docs/`                 | Methodology guides (hooks, skills, agents, auto-dream, superpowers-integration, bootstrap-prompt, techniques) |
| `mcp/`                  | Optional MCP server configs (GitHub, Sentry)                                                                  |
| `ATTRIBUTION.md`        | MIT credits — especially for `obra/superpowers`-derived skills                                                |

### Scope guard: ClaudeMaxPower scaffolding vs. product code

When editing under `.claude/`, `skills/`, `scripts/`, `workflows/`, `docs/`, `examples/`, or `mcp/`, you are modifying the **engineering harness**. This is fine for keeping the pipeline healthy, but it is **not** the product implementation. Product source code (the five-layer `@acts/*` stack in PLAN.md §11) will live under `packages/` once Phase 0 is approved — do not create that tree prematurely.

### Docs imports (read when relevant)

- @docs/hooks-guide.md
- @docs/skills-guide.md
- @docs/agents-guide.md
- @docs/agent-teams-guide.md
- @docs/auto-dream-guide.md
- @docs/superpowers-integration.md
- @docs/bootstrap-prompt.md
- @ATTRIBUTION.md
