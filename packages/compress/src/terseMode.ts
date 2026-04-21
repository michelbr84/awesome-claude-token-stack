export const TERSE_MODE_LEVELS = ["lite", "full", "ultra"] as const;
export type TerseModeLevel = (typeof TERSE_MODE_LEVELS)[number];

interface LevelConfig {
  title: string;
  description: string;
  rules: readonly string[];
}

const LEVELS: Record<TerseModeLevel, LevelConfig> = {
  lite: {
    title: "acts terse mode — lite",
    description:
      "Reduce padding and ceremony without losing clarity. Suitable for most interactive sessions.",
    rules: [
      "Cut greetings, sign-offs, and self-reference (no 'I will now', 'As an AI...').",
      "Cut pre-amble that restates the user's question.",
      "Cut post-amble that summarizes what you just said unless the user asked for a summary.",
      "When the answer is a short fact, give only the fact — skip the explanation scaffold.",
      "Prefer active voice and concrete nouns over passive constructions.",
      "Keep code blocks, stack traces, error messages, and exact commands verbatim.",
    ],
  },
  full: {
    title: "acts terse mode — full",
    description: "Telegram-style compression suitable for tight context budgets.",
    rules: [
      "Use sentence fragments when they unambiguously answer the question.",
      "Drop articles (the/a/an) when it does not damage clarity.",
      "One idea per line; no transitional phrases between ideas.",
      "Prefer bullet lists over prose when the content is enumerable.",
      "State the conclusion first; supporting detail only if asked or load-bearing.",
      "Keep code, errors, and commands verbatim — compression applies to prose only.",
    ],
  },
  ultra: {
    title: "acts terse mode — ultra",
    description:
      "Maximum compression. Use only when the user has explicitly requested brevity or the budget is near exhaustion.",
    rules: [
      "Respond in 3 sentences or fewer unless code is required.",
      "No meta-commentary about your process, confidence, or reasoning.",
      "No alternatives unless the user asked for options.",
      "No warnings about trade-offs unless catastrophic.",
      "Single-word answers are acceptable when accurate.",
      "Code, errors, and commands still verbatim — never truncate those.",
    ],
  },
};

/**
 * Returns the Markdown body of the `acts-terse` skill for the given intensity.
 * Drop this into `.claude/skills/acts-terse.md` (or equivalent) and activate
 * via your agent's skill-selection mechanism.
 */
export function terseSkillMarkdown(level: TerseModeLevel = "full"): string {
  const cfg = LEVELS[level];
  const header = [
    "---",
    "name: acts-terse",
    `description: ${cfg.description}`,
    `intensity: ${level}`,
    "---",
    "",
    `# ${cfg.title}`,
    "",
    cfg.description,
    "",
    "## Rules",
    "",
  ].join("\n");

  const body = cfg.rules.map((rule, i) => `${i + 1}. ${rule}`).join("\n");

  const footer = [
    "",
    "",
    "## Measurement",
    "",
    "acts records a before/after sample every time a session activates this skill.",
    "Run `acts observe stats --terse` to see measured output-token savings for your session.",
    "",
  ].join("\n");

  return header + body + footer;
}
