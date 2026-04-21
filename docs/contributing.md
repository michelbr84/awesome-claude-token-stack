# Contributing

Thanks for your interest in `awesome-claude-token-stack`. This document
covers the development workflow, the clean-room protocol for features
inspired by restrictively-licensed upstreams, and where to put new code.

## Getting set up

```bash
git clone https://github.com/michelbr84/awesome-claude-token-stack
cd awesome-claude-token-stack
pnpm install
pnpm build
pnpm test
```

You need:

- Node.js 20+ (the minimum we commit to supporting)
- pnpm 9.x
- A C++ toolchain for `better-sqlite3` (usually already present on dev
  machines; see [`getting-started.md`](./getting-started.md#prerequisites))

## Repository layout

```
packages/
├── core/        — storage + shared types (depended on by everything)
├── compress/    — filters + CLAUDE.md + terse skill
├── sandbox/     — executor + content index + URL fetch
├── observe/     — quality + session + archive + checkpoint
├── memory/      — observations + 3-layer disclosure + decay
├── mcp/         — MCP stdio server (wires the others into tools)
└── cli/         — `acts` binary (commander)
benchmarks/      — (v0.2) reproducible harness
docs/            — product docs (architecture / getting-started / etc.)
examples/        — integration examples for specific agents
```

Every package has the same shape: `package.json`, `tsconfig.json`, `src/`,
`test/`, `README.md` (optional). Tests live in `packages/*/test/**/*.test.ts`
and are discovered by the root-level `vitest.config.ts`.

## Development loop

```bash
pnpm test:watch              # vitest in watch mode
pnpm lint                    # eslint
pnpm format                  # prettier write
pnpm build                   # tsc --build across packages
```

Vitest is configured with aliases that point `@acts/*` at package `src/`, so
tests run against TypeScript source directly — no need to rebuild between
iterations.

## Adding a feature

### 1. Is it in scope for v0.1.0?

Check [`roadmap.md`](./roadmap.md). We are strict about scope:

- If the feature fits inside an existing package, extend the package.
- If it needs its own package, see §11 of [`PLAN.md`](../PLAN.md) for the
  declared module list and pick the slot. Creating unlisted packages requires
  a separate proposal.
- If it requires cloud, network, or telemetry — probably not in scope unless
  it is strictly opt-in and clearly labeled.

### 2. Write a test first

Every code path ships with tests. The existing tests in
`packages/*/test/*.test.ts` are patterns to follow — they are small,
focused, and use an in-memory database via
`openDatabase({ memory: true })`.

### 3. Respect the tool budget

The MCP registry is hard-capped at 20 tools (PLAN.md §17). Adding a new tool
runs the risk of pushing the manifest cost past where the savings go. New
tools require either deleting an existing tool, or justifying the tradeoff
with measurement.

### 4. Respect the cache-safety guarantee

Do not modify content already in the agent's context window. All compression
applies to new content entering the window, or to structural files
(CLAUDE.md, MEMORY.md) between sessions. Prompt cache integrity is
load-bearing for a significant fraction of real savings.

## Clean-room protocol

Two upstream projects have licenses that prevent code reuse:

- `mksglu/context-mode` — Elastic License v2
- `alexgreensh/token-optimizer` — PolyForm Noncommercial 1.0.0

Concepts from these projects are not copyrightable and are free to borrow
(PLAN.md §8). But the **code** is off-limits, and the cleanest way to prove
derivation-from-concept-only is clean-room development:

1. **Read the feature description** in PLAN.md, a blog post, or
   documentation — **not the source**.
2. **Write a specification** of what the feature does, in your own words.
3. **Implement from the spec** without consulting the upstream source.
4. **Commit with a note** under `ATTRIBUTION.md` if applicable — "feature X
   inspired by Y (concept only, clean-room implementation)".

If you find yourself cross-referencing an upstream file for implementation
details, you are no longer clean-room. Stop, reset, read the spec again, and
proceed fresh.

## Code style

- TypeScript strict mode (root `tsconfig.base.json`).
- `noUncheckedIndexedAccess` — always handle undefined from array/object
  indexing.
- Prefer named exports over default.
- Prefer composition over inheritance; we have no class hierarchies.
- Public API symbols are exported from each package's `index.ts`. If it isn't
  in `index.ts`, it's private.

Lint and formatting are enforced by CI (`pnpm lint`, `pnpm format:check`).

## Commits and PRs

- Use conventional commits (`feat(core): ...`, `fix(compress): ...`,
  `docs: ...`).
- One feature per PR. Refactors separated from behavior changes.
- Include a test plan in the PR body — what scenarios you verified, what
  commands you ran.
- Run the full CI set locally (`pnpm lint && pnpm build && pnpm test`)
  before opening.

## Getting help

- Questions: open a discussion on the GitHub repository.
- Bugs: open an issue with a reproduction case.
- Security issues: do **not** file a public issue. Email the repository
  owner directly.

Thanks for making `acts` better.
