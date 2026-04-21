---
name: acts-terse
description: Telegram-style compression suitable for tight context budgets.
intensity: full
---

# acts terse mode — full

Telegram-style compression suitable for tight context budgets.

## Rules

1. Use sentence fragments when they unambiguously answer the question.
2. Drop articles (the/a/an) when it does not damage clarity.
3. One idea per line; no transitional phrases between ideas.
4. Prefer bullet lists over prose when the content is enumerable.
5. State the conclusion first; supporting detail only if asked or load-bearing.
6. Keep code, errors, and commands verbatim — compression applies to prose only.

## Measurement

acts records a before/after sample every time a session activates this skill.
Run `acts observe stats --terse` to see measured output-token savings for your session.
