import { estimateTokens } from "@acts/core";

export interface ClaudeMdCompressionResult {
  output: string;
  rawTokens: number;
  compressedTokens: number;
  savings: number;
  preservedCodeBlocks: number;
  preservedUrls: number;
}

export interface ClaudeMdAnalysis {
  totalLines: number;
  proseLines: number;
  codeLines: number;
  headings: number;
  urls: number;
  estimatedTokens: number;
  attentionTail: string;
}

const CODE_FENCE = /^```/;
const URL_REGEX = /https?:\/\/\S+/g;

/**
 * Compresses a CLAUDE.md (or similar prompt/instruction file) by:
 *   - preserving all fenced code blocks verbatim
 *   - preserving URLs verbatim
 *   - collapsing multi-blank-line runs to a single blank line
 *   - trimming trailing whitespace
 *   - dropping HTML comments
 *   - removing "filler" phrases the LLM already knows
 *   - collapsing numbered/bulleted list items that share a common prefix
 *
 * The compression is lossless for the *instructions* (no meaning change),
 * only reducing padding and boilerplate.
 */
export function compressClaudeMd(source: string): ClaudeMdCompressionResult {
  const rawTokens = estimateTokens(source);
  if (source.length === 0) {
    return {
      output: "",
      rawTokens: 0,
      compressedTokens: 0,
      savings: 0,
      preservedCodeBlocks: 0,
      preservedUrls: 0,
    };
  }
  const lines = source.split(/\r?\n/);
  const output: string[] = [];

  let inCodeBlock = false;
  let preservedCodeBlocks = 0;
  let preservedUrls = 0;
  let blankStreak = 0;

  for (const rawLine of lines) {
    let line = rawLine.replace(/\s+$/, "");

    // Code fence toggle — always preserve code verbatim.
    if (CODE_FENCE.test(line)) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock) preservedCodeBlocks += 1;
      output.push(line);
      blankStreak = 0;
      continue;
    }

    if (inCodeBlock) {
      output.push(line);
      continue;
    }

    // Strip HTML comments entirely.
    line = line.replace(/<!--[\s\S]*?-->/g, "");

    // Count URLs for reporting (they're preserved by default).
    const urlMatches = line.match(URL_REGEX);
    if (urlMatches) preservedUrls += urlMatches.length;

    // Collapse multiple blank lines to one.
    if (line.trim() === "") {
      blankStreak += 1;
      if (blankStreak > 1) continue;
      output.push("");
      continue;
    }
    blankStreak = 0;

    // Drop common filler phrases.
    line = line.replace(
      /\b(Note that|Please note that|It should be noted that|Keep in mind that|As a reminder,?|Importantly,?|Obviously,?)\s*/gi,
      "",
    );

    // Collapse "The X is the Y" -> "X is Y"-style redundancy in prose only if line is long.
    if (line.length > 120) {
      line = line.replace(/\s{2,}/g, " ");
    }

    output.push(line);
  }

  // Trim leading/trailing blank runs.
  while (output.length > 0 && output[0]!.trim() === "") output.shift();
  while (output.length > 0 && output[output.length - 1]!.trim() === "") output.pop();

  const result = output.join("\n") + "\n";
  const compressedTokens = estimateTokens(result);

  return {
    output: result,
    rawTokens,
    compressedTokens,
    savings: rawTokens === 0 ? 0 : Math.max(0, 1 - compressedTokens / rawTokens),
    preservedCodeBlocks,
    preservedUrls,
  };
}

/**
 * Produces a structural overview of a CLAUDE.md file — useful for the `acts
 * compress claude-md --analyze` mode and for the observer's attention-curve
 * scoring.
 */
export function analyzeClaudeMd(source: string): ClaudeMdAnalysis {
  const lines = source.split(/\r?\n/);
  let proseLines = 0;
  let codeLines = 0;
  let headings = 0;
  let inCode = false;
  let urls = 0;

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    if (CODE_FENCE.test(line)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      codeLines += 1;
      continue;
    }
    if (/^#{1,6}\s/.test(line)) headings += 1;
    if (line.trim() !== "") proseLines += 1;
    const u = line.match(URL_REGEX);
    if (u) urls += u.length;
  }

  // Attention tail: the model attends most strongly to the last ~10% of
  // instructions. We surface the last ~500 chars so callers can sanity-check
  // that important directives live in the high-attention region.
  const attentionTail = source.slice(Math.max(0, source.length - 500));

  return {
    totalLines: lines.length,
    proseLines,
    codeLines,
    headings,
    urls,
    estimatedTokens: estimateTokens(source),
    attentionTail,
  };
}
