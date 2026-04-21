import { estimateTokens } from "@acts/core";

import { truncateMiddle } from "../truncate.js";
import { DOCKER_FILTERS } from "./docker.js";
import { GIT_FILTERS } from "./git.js";
import { NPM_FILTERS } from "./npm.js";
import { PYTEST_FILTERS } from "./pytest.js";
import type { FilterHandler, FilterInput, FilterResult } from "./types.js";

const REGISTRY: FilterHandler[] = [
  ...GIT_FILTERS,
  ...NPM_FILTERS,
  ...DOCKER_FILTERS,
  ...PYTEST_FILTERS,
];

/** Registers a custom filter (user-defined or plugin). */
export function registerFilter(handler: FilterHandler): void {
  // Replace by name if already registered
  const existing = REGISTRY.findIndex((h) => h.name === handler.name);
  if (existing >= 0) {
    REGISTRY[existing] = handler;
  } else {
    REGISTRY.push(handler);
  }
}

/** Returns the names of all currently-registered handlers. */
export function listFilters(): readonly string[] {
  return REGISTRY.map((h) => h.name);
}

/**
 * Compresses the output of a command using the first matching handler.
 * If no handler matches but output is long, falls back to middle-truncation.
 */
export function compressCommand(input: FilterInput): FilterResult {
  const rawTokens = estimateTokens(input.output);

  for (const handler of REGISTRY) {
    if (handler.match(input)) {
      const compressed = handler.apply(input);
      const compressedTokens = estimateTokens(compressed);
      const savings = rawTokens === 0 ? 0 : 1 - compressedTokens / rawTokens;
      return {
        output: compressed,
        rawTokens,
        compressedTokens,
        savings: Math.max(0, savings),
        applied: handler.name,
      };
    }
  }

  // No specific handler; apply generic truncation only if it actually helps.
  const truncated = truncateMiddle(input.output, {
    maxChars: input.maxTokens ? input.maxTokens * 4 : 4000,
  });
  const compressedTokens = estimateTokens(truncated);
  return {
    output: truncated,
    rawTokens,
    compressedTokens,
    savings: rawTokens === 0 ? 0 : Math.max(0, 1 - compressedTokens / rawTokens),
    applied: truncated === input.output ? "none" : "generic-truncate",
  };
}

export type { FilterHandler, FilterInput, FilterResult };
