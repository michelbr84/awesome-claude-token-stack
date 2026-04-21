export interface FilterInput {
  /** Command argv, e.g. ["git", "status"]. */
  command: readonly string[];
  /** Raw stdout (and/or stderr merged) of the command. */
  output: string;
  /** Exit code if known. */
  exitCode?: number;
  /** Optional max tokens to target after compression. */
  maxTokens?: number;
}

export interface FilterResult {
  /** The compressed output. */
  output: string;
  /** Estimated token count of the raw input. */
  rawTokens: number;
  /** Estimated token count of the compressed output. */
  compressedTokens: number;
  /** Savings as a fraction in [0, 1]. */
  savings: number;
  /** Name of the handler that matched ("generic" if none specifically matched). */
  applied: string;
}

export interface FilterHandler {
  /** Short name used for reporting (e.g. "git-status"). */
  name: string;
  /** Returns true if this handler can compress this input. */
  match: (input: FilterInput) => boolean;
  /** Transforms the output. */
  apply: (input: FilterInput) => string;
}
