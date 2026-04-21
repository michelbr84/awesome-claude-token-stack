# CLI reference

`acts` is the terminal surface for `awesome-claude-token-stack`. Every
subcommand is a thin adapter over the same packages the MCP server uses — so
whatever you can do in one context you can do in the other.

## Global flags

- `-v, --version` — print the acts version
- `--help` — show contextual help for any command or subcommand

Most subcommands accept:

- `--db <path>` — override the SQLite database path (overrides
  `ACTS_DB_PATH` and `.acts/` auto-resolution)
- `--json` — emit the result as JSON instead of human text

## `acts init`

Initialize a `.acts/` store in the current directory and add `.acts/` to
`.gitignore` (creating it if needed).

```bash
acts init [--db <path>]
```

Output:

```
acts initialized.
  store dir: /path/to/.acts
  database:  /path/to/.acts/store.db
  schema:    v1
  .gitignore: updated
```

## `acts status`

Show the current state of the store: schema version, recent sessions,
observation counts, and the three most-recent observations.

```bash
acts status [--db <path>] [--json]
```

## `acts compress cmd <argv...>`

Compress the stdout of a shell command, read from stdin.

```bash
git status | acts compress cmd git status
# stderr: [acts] git-status: 820 -> 140 tokens (82.9% savings)
```

Flags: `--json`, `--exit <code>`.

## `acts compress claude-md <file>`

Compress a CLAUDE.md or instructions file.

```bash
acts compress claude-md CLAUDE.md -o CLAUDE.compressed.md
```

Flags: `-o, --out <path>`, `--json`.

## `acts compress terse-skill`

Emit the `acts-terse` skill markdown for an agent's skills directory.

```bash
acts compress terse-skill --level full > .claude/skills/acts-terse.md
```

Flags: `--level <lite|full|ultra>` (default `full`).

## `acts memory save`

Persist an observation in the memory store.

```bash
acts memory save \
  --kind decision \
  --title "Short title" \
  --body "Full body text" \
  [--tag <tag>...] \
  [--source <source>] \
  [--ttl <seconds>] \
  [--db <path>] [--json]
```

`--kind` must be one of: `decision`, `bugfix`, `convention`, `guardrail`,
`note`, `warning`, `pattern`, `reference`, `todo`.

## `acts memory search <query>`

Search observations with progressive disclosure.

```bash
acts memory search "auth"                  # layer 2 (default)
acts memory search "auth" --layer index    # layer 1 (~15 tok/hit)
acts memory search "auth" --kind decision  # filter
```

Flags: `--layer <index|search>`, `--kind <kind>`, `--limit <n>` (default 10),
`--json`, `--db`.

## `acts memory get <id>`

Retrieve a full observation (bumps its access counter).

```bash
acts memory get abcdef1234567890
```

Flags: `--json`, `--db`.

## `acts memory list`

List recent observations (metadata only, no body).

```bash
acts memory list [--kind <kind>] [--tag <tag>] [--limit <n>]
```

## `acts memory delete <id>`

Permanently delete an observation.

## `acts sandbox exec`

Execute a script in an isolated subprocess.

```bash
echo 'console.log(2 + 2)' | acts sandbox exec --runtime node
acts sandbox exec --runtime bash -f ./script.sh
```

Required: `--runtime` (one of `node`, `bash`, `sh`, `python`, `python3`).
Flags: `-f, --file <file>`, `--timeout <ms>` (default 30000), `--json`.

## `acts sandbox index`

Index a file (or stdin) into the content store.

```bash
acts sandbox index --source api-ref -f docs/api.md
cat big.txt | acts sandbox index --source big.txt
```

Required: `--source <key>`. Flags: `-f, --file`, `--title`, `--ttl`, `--db`,
`--json`.

## `acts sandbox search <query>`

FTS5 BM25 search over indexed content.

```bash
acts sandbox search "pagination" --limit 5
acts sandbox search "retry" --source api-ref
```

Flags: `--source`, `--limit` (default 10), `--json`, `--db`.

## `acts observe score`

Compute the 7-signal quality score from explicit signal values.

```bash
acts observe score --context-fill 0.45 --fresh-reads 0.9 --lean-tool-use 0.8
# acts quality: 89/100 (A)
```

Flags (all 0..1 floats): `--context-fill`, `--fresh-reads`, `--lean-tool-use`,
`--shallow-compact`, `--unique-content`, `--decision-dense`,
`--agent-efficient`, `--json`.

## `acts observe stats`

Aggregate statistics for a session (most recent by default).

```bash
acts observe stats
acts observe stats --session <id>
```

## `acts mcp`

Start the `acts-mcp` server over stdio. Intended to be spawned by an
MCP-compatible agent.

```bash
acts mcp [--db <path>]
```

Do not run this in a normal terminal — stdout is JSON-RPC, not human-readable
text.

## `acts db info`

Show the resolved database path and schema version.

## `acts db migrate`

Apply any pending schema migrations. Safe to run repeatedly — fully
idempotent.

```bash
acts db migrate
# migrate: 0 applied (v1 -> v1)
```
