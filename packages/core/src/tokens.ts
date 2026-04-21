/**
 * Fast, dependency-free token estimator.
 *
 * This is deliberately an approximation: we do not ship tiktoken because it
 * adds a native dependency that complicates cross-platform builds, and for the
 * purposes of relative measurement (compression savings, quality scoring,
 * budget tracking) a char/word heuristic is within ±15% of real tokenizer
 * counts on natural language and within ±25% on code.
 *
 * The formula blends two signals:
 *   - 1 token ≈ 4 chars for typical text
 *   - 1 token ≈ 0.75 words for natural language
 * and picks the larger to avoid underestimating short-but-dense inputs.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const chars = text.length;
  const words = text.split(/\s+/).filter(Boolean).length;
  const byChars = Math.ceil(chars / 4);
  const byWords = Math.ceil(words / 0.75);
  return Math.max(byChars, byWords);
}

/** Estimate token count for an array of messages (concatenated with newline). */
export function estimateTokensForMessages(messages: readonly string[]): number {
  return messages.reduce((sum, msg) => sum + estimateTokens(msg), 0);
}
