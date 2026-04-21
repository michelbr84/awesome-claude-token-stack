import { listObservations } from "@acts/memory";
import { listSessions } from "@acts/observe";
import type { Command } from "commander";

import { openFromCli } from "../util/db.js";
import { CLI_VERSION } from "../version.js";

export function registerStatusCommand(program: Command): void {
  program
    .command("status")
    .description("Show the current state of the acts store: database path, schema version, counts.")
    .option("--db <path>", "override the SQLite database path")
    .option("--json", "emit the status as JSON")
    .action((opts) => {
      const handle = openFromCli(opts);
      const sessions = listSessions(handle.db, 5);
      const observationCount = handle.db
        .prepare("SELECT COUNT(*) AS n FROM observations")
        .get() as { n: number };
      const contentCount = handle.db.prepare("SELECT COUNT(*) AS n FROM content").get() as {
        n: number;
      };
      const recentObs = listObservations(handle.db, { limit: 3 });

      const status = {
        version: CLI_VERSION,
        database: handle.path,
        schemaVersion: handle.schemaVersion,
        sessions: sessions.length,
        lastSessionStarted: sessions[0]?.started_at ?? null,
        observations: observationCount.n,
        recentObservations: recentObs.map((o) => ({ id: o.id, kind: o.kind, title: o.title })),
        contentEntries: contentCount.n,
      };

      if (opts.json) {
        process.stdout.write(JSON.stringify(status, null, 2) + "\n");
      } else {
        process.stdout.write(
          [
            `acts ${status.version}`,
            `database:     ${status.database} (schema v${status.schemaVersion})`,
            `sessions:     ${status.sessions} recent (last start: ${formatEpoch(status.lastSessionStarted)})`,
            `observations: ${status.observations} total`,
            `content:      ${status.contentEntries} entries`,
            "",
          ].join("\n"),
        );
        if (status.recentObservations.length > 0) {
          process.stdout.write("recent observations:\n");
          for (const obs of status.recentObservations) {
            process.stdout.write(`  [${obs.kind}] ${obs.id} — ${obs.title}\n`);
          }
        }
      }
      handle.close();
    });
}

function formatEpoch(ms: number | null): string {
  if (!ms) return "never";
  return new Date(ms).toISOString();
}
