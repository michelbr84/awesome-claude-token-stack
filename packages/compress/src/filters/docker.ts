import type { FilterHandler } from "./types.js";

/**
 * `docker ps` / `docker images` — shortens IDs and drops excess whitespace.
 */
export const dockerPs: FilterHandler = {
  name: "docker-ps",
  match: (i) => i.command[0] === "docker" && (i.command[1] === "ps" || i.command[1] === "images"),
  apply: ({ output }) => {
    return output
      .split(/\r?\n/)
      .map((line) => line.replace(/\s{3,}/g, "  ").trimEnd())
      .filter((line, idx, arr) => line !== "" || (idx > 0 && idx < arr.length - 1))
      .join("\n");
  },
};

export const DOCKER_FILTERS: readonly FilterHandler[] = [dockerPs];
