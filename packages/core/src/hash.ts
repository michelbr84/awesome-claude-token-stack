import { createHash } from "node:crypto";

/** Returns a hex-encoded SHA-256 digest of the input. */
export function sha256(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Returns a short (12-char) prefix of the SHA-256 digest — useful for IDs
 * where collision probability is acceptable and readability matters.
 */
export function shortHash(data: string | Uint8Array, length = 12): string {
  const full = sha256(data);
  return full.slice(0, Math.max(4, Math.min(length, full.length)));
}
