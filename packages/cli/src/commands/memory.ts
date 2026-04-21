import {
  OBSERVATION_KINDS,
  deleteObservation,
  getObservation,
  indexMemory,
  listObservations,
  saveObservation,
  searchMemory,
} from "@acts/memory";
import type { Command } from "commander";

import { openFromCli, printJson } from "../util/db.js";

export function registerMemoryCommand(program: Command): void {
  const cmd = program.command("memory").description("Persistent observation memory.");

  cmd
    .command("save")
    .description("Save a new observation.")
    .requiredOption("--kind <kind>", `one of: ${OBSERVATION_KINDS.join(", ")}`)
    .requiredOption("--title <title>", "short title")
    .requiredOption("--body <body>", "body text")
    .option("--tag <tag...>", "one or more tags")
    .option("--source <source>", "optional source reference")
    .option("--ttl <seconds>", "ttl in seconds")
    .option("--db <path>", "override database path")
    .option("--json", "emit JSON")
    .action(
      (opts: {
        kind: string;
        title: string;
        body: string;
        tag?: string[];
        source?: string;
        ttl?: string;
        db?: string;
        json?: boolean;
      }) => {
        if (!OBSERVATION_KINDS.includes(opts.kind as never)) {
          process.stderr.write(
            `acts memory save: invalid --kind ${JSON.stringify(opts.kind)}. Allowed: ${OBSERVATION_KINDS.join(", ")}\n`,
          );
          process.exit(2);
        }
        const handle = openFromCli(opts);
        const result = saveObservation(handle.db, {
          kind: opts.kind as (typeof OBSERVATION_KINDS)[number],
          title: opts.title,
          body: opts.body,
          tags: opts.tag,
          source: opts.source,
          ttlSeconds: opts.ttl ? Number.parseInt(opts.ttl, 10) : undefined,
        });
        if (opts.json) {
          printJson(result);
        } else {
          process.stdout.write(`saved ${result.id} [${result.kind}] ${result.title}\n`);
        }
        handle.close();
      },
    );

  cmd
    .command("search")
    .description("Search observations with progressive disclosure.")
    .argument("<query>", "search query")
    .option("--kind <kind>", `filter by kind (${OBSERVATION_KINDS.join("|")})`)
    .option("--limit <n>", "max hits", "10")
    .option("--layer <layer>", "index | search | get (default: search)", "search")
    .option("--db <path>", "override database path")
    .option("--json", "emit JSON")
    .action(
      (
        query: string,
        opts: {
          kind?: string;
          limit: string;
          layer: "index" | "search";
          db?: string;
          json?: boolean;
        },
      ) => {
        const handle = openFromCli(opts);
        const limit = Number.parseInt(opts.limit, 10);
        const hits =
          opts.layer === "index"
            ? indexMemory(handle.db, query, {
                kind:
                  opts.kind && OBSERVATION_KINDS.includes(opts.kind as never)
                    ? (opts.kind as (typeof OBSERVATION_KINDS)[number])
                    : undefined,
                limit,
              })
            : searchMemory(handle.db, query, {
                kind:
                  opts.kind && OBSERVATION_KINDS.includes(opts.kind as never)
                    ? (opts.kind as (typeof OBSERVATION_KINDS)[number])
                    : undefined,
                limit,
              });
        if (opts.json) {
          printJson(hits);
        } else if (hits.length === 0) {
          process.stdout.write("no results\n");
        } else {
          for (const h of hits) {
            if ("summary" in h) {
              process.stdout.write(`${h.id} [${h.kind}] ${h.title}\n  ${h.summary}\n`);
            } else {
              process.stdout.write(`${h.id} [${h.kind}] ${h.title}\n`);
            }
          }
        }
        handle.close();
      },
    );

  cmd
    .command("get")
    .description("Retrieve the full body of a stored observation.")
    .argument("<id>", "observation id")
    .option("--db <path>", "override database path")
    .option("--json", "emit JSON")
    .action((id: string, opts: { db?: string; json?: boolean }) => {
      const handle = openFromCli(opts);
      const obs = getObservation(handle.db, id);
      if (!obs) {
        process.stderr.write(`no observation with id ${id}\n`);
        process.exit(1);
      } else if (opts.json) {
        printJson(obs);
      } else {
        process.stdout.write(`# [${obs.kind}] ${obs.title}\n\n${obs.body}\n`);
      }
      handle.close();
    });

  cmd
    .command("list")
    .description("List recent observations.")
    .option("--kind <kind>")
    .option("--tag <tag>")
    .option("--limit <n>", "default 20", "20")
    .option("--db <path>", "override database path")
    .option("--json", "emit JSON")
    .action((opts: { kind?: string; tag?: string; limit: string; db?: string; json?: boolean }) => {
      const handle = openFromCli(opts);
      const rows = listObservations(handle.db, {
        kind:
          opts.kind && OBSERVATION_KINDS.includes(opts.kind as never)
            ? (opts.kind as (typeof OBSERVATION_KINDS)[number])
            : undefined,
        tag: opts.tag,
        limit: Number.parseInt(opts.limit, 10),
      });
      if (opts.json) {
        printJson(rows);
      } else if (rows.length === 0) {
        process.stdout.write("empty\n");
      } else {
        for (const o of rows) {
          process.stdout.write(`${o.id} [${o.kind}] ${o.title}\n`);
        }
      }
      handle.close();
    });

  cmd
    .command("delete")
    .description("Delete an observation by id.")
    .argument("<id>")
    .option("--db <path>")
    .action((id: string, opts: { db?: string }) => {
      const handle = openFromCli(opts);
      const ok = deleteObservation(handle.db, id);
      process.stdout.write(ok ? `deleted ${id}\n` : `not found: ${id}\n`);
      handle.close();
      if (!ok) process.exit(1);
    });
}
