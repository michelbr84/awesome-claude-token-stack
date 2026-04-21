import type { Database } from "better-sqlite3";

export type QualityGrade = "S" | "A" | "B" | "C" | "D" | "F";

/**
 * The 7 signals that feed the quality score. Each is a number in [0, 1]
 * where 1.0 represents "ideal" and 0.0 represents "worst observed".
 *
 * Signal meanings:
 *   - contextFill    : 1 - context_fill_ratio (fuller context = worse)
 *   - freshReads     : fraction of file reads whose content has NOT been seen before
 *   - leanToolUse    : fraction of tool results under the "bloat" byte threshold
 *   - shallowCompact : 1 - normalized compaction depth (fewer compactions = better)
 *   - uniqueContent  : 1 - duplicate content ratio
 *   - decisionDense  : fraction of turns driven by user decisions (vs agent self-continue)
 *   - agentEfficient : normalized sub-agent spend ratio (lower sub-agent overhead = better)
 */
export interface QualitySignals {
  contextFill: number;
  freshReads: number;
  leanToolUse: number;
  shallowCompact: number;
  uniqueContent: number;
  decisionDense: number;
  agentEfficient: number;
}

export interface QualityResult {
  score: number;
  grade: QualityGrade;
  signals: QualitySignals;
  weights: typeof SIGNAL_WEIGHTS;
}

export const SIGNAL_WEIGHTS = {
  contextFill: 0.2,
  freshReads: 0.2,
  leanToolUse: 0.2,
  shallowCompact: 0.15,
  uniqueContent: 0.1,
  decisionDense: 0.08,
  agentEfficient: 0.07,
} as const;

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Maps a 0-100 score to an S/A/B/C/D/F grade per PLAN.md §16. */
export function gradeForScore(score: number): QualityGrade {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

/**
 * Computes a quality score from the 7 signals. Missing signals are treated
 * as 1.0 (ideal) so partial observability never penalizes a session — we'd
 * rather under-report problems than invent them.
 */
export function computeQuality(partial: Partial<QualitySignals>): QualityResult {
  const signals: QualitySignals = {
    contextFill: clamp01(partial.contextFill ?? 1),
    freshReads: clamp01(partial.freshReads ?? 1),
    leanToolUse: clamp01(partial.leanToolUse ?? 1),
    shallowCompact: clamp01(partial.shallowCompact ?? 1),
    uniqueContent: clamp01(partial.uniqueContent ?? 1),
    decisionDense: clamp01(partial.decisionDense ?? 1),
    agentEfficient: clamp01(partial.agentEfficient ?? 1),
  };

  const weighted =
    signals.contextFill * SIGNAL_WEIGHTS.contextFill +
    signals.freshReads * SIGNAL_WEIGHTS.freshReads +
    signals.leanToolUse * SIGNAL_WEIGHTS.leanToolUse +
    signals.shallowCompact * SIGNAL_WEIGHTS.shallowCompact +
    signals.uniqueContent * SIGNAL_WEIGHTS.uniqueContent +
    signals.decisionDense * SIGNAL_WEIGHTS.decisionDense +
    signals.agentEfficient * SIGNAL_WEIGHTS.agentEfficient;

  const score = Math.round(weighted * 100);
  return {
    score,
    grade: gradeForScore(score),
    signals,
    weights: SIGNAL_WEIGHTS,
  };
}

/** Persists a computed quality score to the database for trend analysis. */
export function persistQuality(
  db: Database,
  sessionId: string,
  turnIndex: number,
  result: QualityResult,
): void {
  db.prepare(
    `INSERT INTO quality_scores(session_id, turn_index, at, score, grade, signals_json)
     VALUES(?, ?, ?, ?, ?, ?)`,
  ).run(
    sessionId,
    turnIndex,
    Date.now(),
    result.score,
    result.grade,
    JSON.stringify(result.signals),
  );
}

/** Returns the most-recent quality score for a session, or null. */
export function latestQuality(db: Database, sessionId: string): QualityResult | null {
  const row = db
    .prepare(
      "SELECT score, grade, signals_json FROM quality_scores WHERE session_id = ? ORDER BY at DESC LIMIT 1",
    )
    .get(sessionId) as { score: number; grade: QualityGrade; signals_json: string } | undefined;
  if (!row) return null;
  try {
    const signals = JSON.parse(row.signals_json) as QualitySignals;
    return { score: row.score, grade: row.grade, signals, weights: SIGNAL_WEIGHTS };
  } catch {
    return null;
  }
}
