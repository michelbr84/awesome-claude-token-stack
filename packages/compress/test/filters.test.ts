import { describe, expect, it } from "vitest";

import { compressCommand } from "../src/filters/index.js";

describe("git status filter", () => {
  const STATUS_OUTPUT = `On branch main
Your branch is up to date with 'origin/main'.

Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
	new file:   src/new.ts
	modified:   src/touched.ts

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   src/touched.ts

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	orphan.ts

no changes added to commit (use "git add" and/or "git commit -a")
`;

  it("matches git status and emits porcelain-style summary", () => {
    const res = compressCommand({ command: ["git", "status"], output: STATUS_OUTPUT });
    expect(res.applied).toBe("git-status");
    expect(res.output).toContain("branch: main");
    expect(res.output).toContain("A  src/new.ts");
    expect(res.output).toContain(" M src/touched.ts");
    expect(res.output).toContain("?? orphan.ts");
    expect(res.savings).toBeGreaterThan(0.3);
  });
});

describe("git log filter", () => {
  const LOG_OUTPUT = `commit abcdef1234567890abcdef1234567890abcdef12 (HEAD -> main)
Author: Alice <alice@example.com>
Date:   Mon Jan 1 00:00:00 2026 +0000

    Fix login race condition

    Details that don't matter to the summary view.

commit fedcba0987654321fedcba0987654321fedcba09
Author: Bob <bob@example.com>
Date:   Sun Dec 31 23:00:00 2025 +0000

    Add initial auth module
`;

  it("collapses commit blocks to sha+subject", () => {
    const res = compressCommand({ command: ["git", "log"], output: LOG_OUTPUT });
    expect(res.applied).toBe("git-log");
    expect(res.output).toContain("abcdef1 Fix login race condition");
    expect(res.output).toContain("fedcba0 Add initial auth module");
    expect(res.output).not.toContain("Author:");
  });
});

describe("npm install filter", () => {
  const NPM_OUTPUT = `npm notice New major version of npm available!
npm warn deprecated lodash.isequal@4.5.0: This package is deprecated. Use require('node:util').isDeepStrictEqual instead.
[##################] | fetchMetadata: http fetch GET 200

added 523 packages, and audited 524 packages in 14s

45 packages are looking for funding
  run \`npm fund\` for details

found 0 vulnerabilities
`;

  it("keeps the summary line and drops progress/ads", () => {
    const res = compressCommand({ command: ["npm", "install"], output: NPM_OUTPUT });
    expect(res.applied).toBe("pm-install");
    expect(res.output).toContain("added 523 packages");
    expect(res.output).toContain("found 0 vulnerabilities");
    expect(res.output).not.toMatch(/npm notice/);
    expect(res.output).not.toMatch(/looking for funding/);
  });
});

describe("fallback behavior", () => {
  it("returns a generic-truncate result for long unknown output", () => {
    const big = Array.from({ length: 500 }, (_, i) => `line ${i}`).join("\n");
    const res = compressCommand({ command: ["mystery-tool"], output: big });
    expect(res.applied).toBe("generic-truncate");
    expect(res.compressedTokens).toBeLessThan(res.rawTokens);
  });

  it("returns applied='none' for short unknown output", () => {
    const res = compressCommand({ command: ["mystery-tool"], output: "hello" });
    expect(res.applied).toBe("none");
    expect(res.output).toBe("hello");
  });
});

describe("pytest filter", () => {
  const PYTEST_OUTPUT = `============================= test session starts ==============================
platform linux -- Python 3.11.0, pytest-7.0.0, pluggy-1.0.0
rootdir: /repo
collecting ...
collected 12 items

tests/test_auth.py ........FF...
tests/test_db.py ....

================================== FAILURES ===================================
______________________________ test_login_race _______________________________

    def test_login_race():
>       assert login(user, pw) == True
E       AssertionError: assert False == True

=========================== short test summary info ============================
FAILED tests/test_auth.py::test_login_race - AssertionError: assert False == True
FAILED tests/test_auth.py::test_logout - KeyError: 'token'
2 failed, 10 passed in 0.42s
`;

  it("keeps failures and summary, drops platform header", () => {
    const res = compressCommand({ command: ["pytest"], output: PYTEST_OUTPUT });
    expect(res.applied).toBe("pytest");
    expect(res.output).toContain("FAILED tests/test_auth.py::test_login_race");
    expect(res.output).toContain("2 failed, 10 passed");
    expect(res.output).not.toContain("platform linux");
    expect(res.output).not.toContain("rootdir:");
  });
});
