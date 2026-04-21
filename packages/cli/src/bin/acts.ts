#!/usr/bin/env node
import { runCli } from "../cli.js";

runCli(process.argv).catch((err) => {
  process.stderr.write(`acts: fatal: ${(err as Error).stack ?? err}\n`);
  process.exit(1);
});
