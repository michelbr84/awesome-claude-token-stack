import type { FilterHandler, FilterInput } from "./types.js";
import { truncateMiddle } from "../truncate.js";

function headIs(input: FilterInput, first: string, ...rest: string[]): boolean {
  const cmd = input.command[0];
  const sub = input.command[1];
  if (cmd !== first) return false;
  if (rest.length === 0) return true;
  return sub !== undefined && rest.includes(sub);
}

/**
 * Collapses verbose `git status` output to one line per file with the
 * porcelain-style two-char status prefix.
 */
export const gitStatus: FilterHandler = {
  name: "git-status",
  match: (i) => headIs(i, "git", "status"),
  apply: ({ output }) => {
    const lines = output.split(/\r?\n/);
    const branch = lines.find((l) => /^On branch /.test(l));
    const upstream = lines.find((l) => /^Your branch is/.test(l));

    const results: string[] = [];
    if (branch) {
      const name = branch.replace(/^On branch /, "").trim();
      const upStatus = upstream ? upstream.replace(/^Your branch is /, "").replace(/\.$/, "") : "";
      results.push(`branch: ${name}${upStatus ? ` (${upStatus})` : ""}`);
    }

    // `git status -s`-style parsing: detect file lines indented after section headers.
    let section: "staged" | "unstaged" | "untracked" | null = null;
    for (const rawLine of lines) {
      const line = rawLine.replace(/\r$/, "");
      if (/^Changes to be committed/.test(line)) {
        section = "staged";
        continue;
      }
      if (/^Changes not staged for commit/.test(line)) {
        section = "unstaged";
        continue;
      }
      if (/^Untracked files/.test(line)) {
        section = "untracked";
        continue;
      }
      if (/^Unmerged paths/.test(line)) {
        section = "unstaged";
        continue;
      }
      if (!section) continue;

      // Skip hint lines and blanks (git indents file entries with either a tab or 8 spaces)
      if (!line.startsWith("\t") && !line.startsWith(" ".repeat(8))) continue;
      const body = line.replace(/^(\t| {8})/, "").trim();
      if (!body) continue;

      if (section === "untracked") {
        results.push(`?? ${body}`);
      } else {
        // body looks like "modified:   path" or "new file:   path" or "deleted:   path"
        const m = body.match(/^(modified|new file|deleted|renamed|copied|typechange):\s+(.+)$/);
        if (m) {
          const statusMap: Record<string, string> = {
            modified: section === "staged" ? "M " : " M",
            "new file": section === "staged" ? "A " : " A",
            deleted: section === "staged" ? "D " : " D",
            renamed: "R ",
            copied: "C ",
            typechange: "T ",
          };
          const code = statusMap[m[1]!] ?? "??";
          results.push(`${code} ${m[2]}`);
        } else {
          results.push(body);
        }
      }
    }

    if (results.length === 0) {
      return output.trim();
    }
    return results.join("\n");
  },
};

/**
 * Collapses `git log` commit blocks to `<shortsha> <subject>` one-liners.
 */
export const gitLog: FilterHandler = {
  name: "git-log",
  match: (i) => headIs(i, "git", "log"),
  apply: ({ output }) => {
    const lines = output.split(/\r?\n/);
    const commits: Array<{ sha: string; subject: string }> = [];
    let current: { sha: string; subject: string } | null = null;
    let skipHeader = false;

    for (const raw of lines) {
      const line = raw.replace(/\r$/, "");
      const commitMatch = line.match(/^commit ([0-9a-f]{7,40})/);
      if (commitMatch) {
        if (current) commits.push(current);
        current = { sha: commitMatch[1]!.slice(0, 7), subject: "" };
        skipHeader = true;
        continue;
      }
      if (!current) continue;
      if (skipHeader) {
        // Skip Author:, Date:, Merge: lines and the blank line that follows.
        if (/^(Author|Date|Merge|AuthorDate|CommitDate):/i.test(line)) continue;
        if (line.trim() === "") {
          skipHeader = false;
        }
        continue;
      }
      if (!current.subject && line.trim() !== "") {
        current.subject = line.trim();
      }
    }
    if (current) commits.push(current);

    if (commits.length === 0) {
      return truncateMiddle(output);
    }
    return commits.map((c) => `${c.sha} ${c.subject}`).join("\n");
  },
};

/**
 * `git diff` — if already short, return as-is. Otherwise truncate the middle
 * preserving head/tail hunks so the agent can still see structure.
 */
export const gitDiff: FilterHandler = {
  name: "git-diff",
  match: (i) => headIs(i, "git", "diff"),
  apply: ({ output }) => truncateMiddle(output, { maxChars: 4000, headLines: 60, tailLines: 20 }),
};

export const GIT_FILTERS: readonly FilterHandler[] = [gitStatus, gitLog, gitDiff];
