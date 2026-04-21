import type { FilterHandler } from "./types.js";
import { truncateMiddle } from "../truncate.js";

const PM_NAMES = new Set(["npm", "pnpm", "yarn", "bun"]);

function isPm(cmd: readonly string[]): boolean {
  const first = cmd[0];
  return typeof first === "string" && PM_NAMES.has(first);
}

/**
 * Strips `npm install` / `pnpm install` noise: progress bars, deprecation
 * notices, funding ads. Keeps the summary line and any warnings/errors.
 */
export const pmInstall: FilterHandler = {
  name: "pm-install",
  match: (i) =>
    isPm(i.command) &&
    (i.command[1] === "install" ||
      i.command[1] === "i" ||
      i.command[1] === "add" ||
      i.command[1] === "ci"),
  apply: ({ output }) => {
    const lines = output.split(/\r?\n/);
    const kept: string[] = [];
    for (const raw of lines) {
      const line = raw.replace(/\r$/, "");
      if (!line.trim()) continue;
      if (/npm notice/.test(line)) continue;
      if (/npm fund/i.test(line)) continue;
      if (/deprecated/i.test(line)) {
        // Keep one line per deprecation, but shorten it.
        const m = line.match(/(\S+@\S+):\s*(.+)/);
        if (m) {
          kept.push(`deprecated ${m[1]} — ${m[2]!.slice(0, 80)}`);
        } else {
          kept.push(line);
        }
        continue;
      }
      if (/^npm warn|WARN /.test(line)) {
        kept.push(line.slice(0, 200));
        continue;
      }
      if (/^npm err|ERR! /i.test(line)) {
        kept.push(line);
        continue;
      }
      if (
        /added \d+ packages?|changed \d+ packages?|removed \d+ packages?|audited \d+ packages?/.test(
          line,
        )
      ) {
        kept.push(line);
        continue;
      }
      if (/found \d+ vulnerabilit/i.test(line)) {
        kept.push(line);
        continue;
      }
      if (/Progress|\d+%|[█▓▒░]/.test(line)) continue;
      if (/downloading|fetching|resolving/i.test(line)) continue;
    }
    if (kept.length === 0) {
      return truncateMiddle(output, { maxChars: 1500, headLines: 10, tailLines: 20 });
    }
    return kept.join("\n");
  },
};

/**
 * `npm run <script>` / `npm test` — pass through but truncate very long output.
 */
export const pmRun: FilterHandler = {
  name: "pm-run",
  match: (i) =>
    isPm(i.command) &&
    (i.command[1] === "run" ||
      i.command[1] === "test" ||
      i.command[1] === "start" ||
      i.command[1] === "exec" ||
      i.command[1] === "x"),
  apply: ({ output }) => truncateMiddle(output, { maxChars: 4000, headLines: 60, tailLines: 40 }),
};

export const NPM_FILTERS: readonly FilterHandler[] = [pmInstall, pmRun];
