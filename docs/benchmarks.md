# Benchmarks

> **TL;DR:** `v0.1.0` does not publish savings percentages. Every compression
> event is logged to `compression_events` in your local SQLite — your own
> sessions produce your own numbers. The reproducible benchmark harness from
> PLAN.md §18 is scheduled for v0.2.

## Why we don't publish savings numbers yet

Our analysis of ten upstream token-optimization projects found a consistent
pattern: impressive headline claims, but nearly all self-reported. Two
projects had genuinely reproducible evals; the rest were "savings %" figures
on hand-picked workloads. We do not want to add another entry to that list.

Per PLAN.md §18, the bar for a published number is:

- **Reproducible harness.** Anyone can run the same task and get a comparable
  result.
- **Honest task selection.** No cherry-picking workloads where the tool
  shines; include cases where it hurts.
- **Multiple models.** Claims that hold for Sonnet may not hold for Haiku or
  for non-Anthropic models.
- **Documented weaknesses.** Which workloads the tool hurts, and why.

Until that harness ships, we ship **measurement infrastructure**:

- Every `compressCommand`, `compressClaudeMd`, and archived tool result
  writes a row to `compression_events` or `tool_results` with raw vs.
  compressed token counts.
- Every session's quality score is persisted in `quality_scores` with the
  full 7-signal breakdown.
- `acts observe stats` aggregates across sessions.

Your data, your numbers.

## Upstream claim review

A candid table of the claims each upstream project makes. Green = verifiable
reproducible harness exists. Yellow = plausible but self-reported. Red =
single-anecdote / best-case figures.

| Project | Claim | Status |
|---|---|---|
| `rtk-ai/rtk` | 60–90% CLI output token reduction | 🟡 self-estimated on medium projects |
| `mksglu/context-mode` | 98% context reduction | 🟡 single-metric best case |
| `tirth8205/code-review-graph` | 8.2× average token reduction | 🟢 honest eval with known weaknesses |
| `Mibayy/token-savior` | 97% fewer tokens | 🟡 self-authored tsbench |
| `JuliusBrussee/caveman` | ~75% output token reduction | 🟢 API-measured, reproducible |
| `drona23/claude-token-efficient` | 17.4% cost reduction | 🟢 external community validation |
| `ooples/token-optimizer-mcp` | 60–90% across 38k ops | 🟡 self-reported production data |
| `nadimtuhin/claude-token-optimizer` | 11k → 800 startup tokens | 🔴 single personal project |
| `alexgreensh/token-optimizer` | $1500–2500/month savings | 🔴 single heavy user, not typical |
| `zilliztech/claude-context` | ~40% reduction | 🟡 self-reported, modest claim |

`awesome-claude-token-stack` v0.1.0 deliberately does not add an entry to
this table. When v0.2 ships the benchmark harness, we will publish whatever
the harness actually measures — including any cases where the tool
underperforms.

## What v0.1 measures locally

The `compression_events` table captures:

| Column | Meaning |
|---|---|
| `kind` | The compression kind (e.g. `git-status`, `pm-install`, `claude-md`). |
| `source` | Optional source identifier (file path, URL, etc.). |
| `raw_tokens` | Estimated tokens of the input. |
| `compressed_tokens` | Estimated tokens of the output. |
| `savings` | `1 - compressed/raw`, in [0, 1]. |
| `at` | Unix-ms timestamp. |

To see your session's compression history:

```sql
sqlite3 .acts/store.db "
  SELECT kind, source, raw_tokens, compressed_tokens,
         printf('%.1f%%', savings * 100) AS savings
  FROM compression_events
  ORDER BY at DESC
  LIMIT 20;
"
```

The `tool_results` table records archived tool outputs with their token sizes
and a `truncated` flag. Filter for the big ones:

```sql
SELECT tool_name, output_tokens, substr(output, 1, 80) || '...' AS preview
FROM tool_results
WHERE truncated = 1
ORDER BY output_tokens DESC
LIMIT 10;
```

## The v0.2 benchmark plan

Per PLAN.md §18, the harness will cover three benchmark categories:

1. **Token efficiency** (30 real coding tasks across 6 categories). Measure
   tokens consumed, wall time, completion score. Compare baseline to each
   layer individually, plus the full stack. Run against Sonnet and Opus.
2. **Context quality** (extended 100+ turn sessions). Measure MRCR-style
   recall, stale-read frequency, compaction loss. With and without quality
   scoring and checkpoints.
3. **Structural intelligence** (6 open-source repos). Blast-radius
   precision/recall, search MRR, flow detection recall. This one lands with
   `@acts/graph` in v0.2.

The harness will live in `benchmarks/` and be runnable via `pnpm benchmark`.
Raw data will be published alongside any numbers quoted in the README.

## How to contribute a measurement

Found a workload where `acts` helps — or hurts? Open an issue with:

- The input (command + output, or file path + content)
- The observed `compression_events` row(s)
- The model / version / context used
- Any confounders (network, disk, flaky LLM output)

Reproducible counter-examples are as valuable as reproducible successes. A
tool that claims "always saves tokens" is less trustworthy than one that
says "saves X% on Y workload; hurts Z% on W workload because reasons."
