import { computeQuality, getSessionStats, listSessions } from "@acts/observe";
import type { Command } from "commander";

import { openFromCli, printJson } from "../util/db.js";

export function registerObserveCommand(program: Command): void {
  const cmd = program.command("observe").description("Observability and quality scoring.");

  cmd
    .command("score")
    .description("Compute a quality score from explicit signal values.")
    .option("--context-fill <v>", "0..1 (higher = fuller context)")
    .option("--fresh-reads <v>", "0..1")
    .option("--lean-tool-use <v>", "0..1")
    .option("--shallow-compact <v>", "0..1")
    .option("--unique-content <v>", "0..1")
    .option("--decision-dense <v>", "0..1")
    .option("--agent-efficient <v>", "0..1")
    .option("--json", "emit JSON")
    .action(
      (opts: {
        contextFill?: string;
        freshReads?: string;
        leanToolUse?: string;
        shallowCompact?: string;
        uniqueContent?: string;
        decisionDense?: string;
        agentEfficient?: string;
        json?: boolean;
      }) => {
        const f = (v?: string) => (typeof v === "string" ? Number.parseFloat(v) : undefined);
        const cf = f(opts.contextFill);
        const result = computeQuality({
          contextFill: typeof cf === "number" ? 1 - cf : undefined,
          freshReads: f(opts.freshReads),
          leanToolUse: f(opts.leanToolUse),
          shallowCompact: f(opts.shallowCompact),
          uniqueContent: f(opts.uniqueContent),
          decisionDense: f(opts.decisionDense),
          agentEfficient: f(opts.agentEfficient),
        });
        if (opts.json) {
          printJson(result);
        } else {
          process.stdout.write(`acts quality: ${result.score}/100 (${result.grade})\n`);
        }
      },
    );

  cmd
    .command("stats")
    .description("Aggregate statistics for a session (most recent by default).")
    .option("--session <id>")
    .option("--db <path>")
    .option("--json")
    .action((opts: { session?: string; db?: string; json?: boolean }) => {
      const handle = openFromCli(opts);
      let id = opts.session ?? "";
      if (!id) {
        const recent = listSessions(handle.db, 1);
        if (recent.length === 0) {
          process.stderr.write("no sessions recorded yet\n");
          handle.close();
          process.exit(1);
        }
        id = recent[0]!.id;
      }
      const stats = getSessionStats(handle.db, id);
      if (opts.json) {
        printJson(stats);
      } else if (!stats) {
        process.stderr.write(`no session ${id}\n`);
      } else {
        process.stdout.write(
          [
            `session:        ${stats.sessionId}`,
            `turns:          ${stats.turns}`,
            `input tokens:   ${stats.totalInputTokens}`,
            `output tokens:  ${stats.totalOutputTokens}`,
            `tool tokens:    ${stats.totalToolTokens}`,
            `avg ctx fill:   ${(stats.avgContextFill * 100).toFixed(1)}%`,
            `duration:       ${stats.durationMs ? `${(stats.durationMs / 1000).toFixed(1)}s` : "open"}`,
            "",
          ].join("\n"),
        );
      }
      handle.close();
    });
}
