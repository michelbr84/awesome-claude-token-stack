import type { FilterHandler } from "./types.js";

/**
 * pytest — keep the short summary (FAILED/ERROR blocks) and drop
 * collection header, passed dots, and platform info.
 */
export const pytest: FilterHandler = {
  name: "pytest",
  match: (i) => i.command[0] === "pytest" || i.command[0] === "py.test",
  apply: ({ output }) => {
    const lines = output.split(/\r?\n/);
    const kept: string[] = [];
    let inFailuresBlock = false;
    for (const raw of lines) {
      const line = raw.replace(/\r$/, "");
      if (/^={5,}\s*FAILURES\s*={5,}/.test(line)) {
        inFailuresBlock = true;
        kept.push(line);
        continue;
      }
      if (/^={5,}\s*short test summary/i.test(line)) {
        inFailuresBlock = true;
        kept.push(line);
        continue;
      }
      if (inFailuresBlock) {
        kept.push(line);
        continue;
      }
      if (/^platform /.test(line)) continue;
      if (/^rootdir:/.test(line)) continue;
      if (/^collecting/.test(line)) continue;
      if (/^cachedir:/.test(line)) continue;
      if (/^collected \d+ items?/.test(line)) {
        kept.push(line);
        continue;
      }
      if (/^(FAILED|ERROR|PASSED|SKIPPED|XFAIL|XPASS)/.test(line)) {
        kept.push(line);
        continue;
      }
      if (/^\d+ (passed|failed|error|skipped)/.test(line)) {
        kept.push(line);
        continue;
      }
      if (/^={5,}.*={5,}/.test(line)) {
        kept.push(line);
        continue;
      }
      // Drop plain progress dots lines like "...F.....F"
      if (/^[.\sFEsxX]+$/.test(line) && line.trim().length > 0) continue;
    }
    return kept.length > 0 ? kept.join("\n") : output;
  },
};

export const PYTEST_FILTERS: readonly FilterHandler[] = [pytest];
