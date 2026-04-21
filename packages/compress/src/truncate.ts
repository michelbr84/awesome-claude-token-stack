export interface TruncateOptions {
  /** Maximum output length (in characters). */
  maxChars?: number;
  /** How many lines of head to keep. */
  headLines?: number;
  /** How many lines of tail to keep. */
  tailLines?: number;
}

/**
 * Compresses a long block of text by keeping `headLines` from the top and
 * `tailLines` from the bottom, with a visible marker in between.
 *
 * If the input already fits in `maxChars`, it is returned unchanged.
 */
export function truncateMiddle(text: string, options: TruncateOptions = {}): string {
  const maxChars = options.maxChars ?? 4000;
  const headLines = options.headLines ?? 40;
  const tailLines = options.tailLines ?? 40;

  if (text.length <= maxChars) return text;

  const lines = text.split(/\r?\n/);
  if (lines.length <= headLines + tailLines + 1) {
    // Not enough lines to split — fall back to char-level truncate.
    const head = text.slice(0, Math.floor(maxChars / 2));
    const tail = text.slice(text.length - Math.floor(maxChars / 2));
    const omitted = text.length - head.length - tail.length;
    return `${head}\n… [${omitted} chars omitted] …\n${tail}`;
  }

  const head = lines.slice(0, headLines);
  const tail = lines.slice(lines.length - tailLines);
  const omittedLines = lines.length - head.length - tail.length;

  return [...head, `… [${omittedLines} lines omitted] …`, ...tail].join("\n");
}
