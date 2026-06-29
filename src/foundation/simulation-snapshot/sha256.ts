import type { FullGameSnapshot } from "./simulation-snapshot";

/**
 * SHA-256 hash function implemented via the Web Crypto API.
 *
 * Returns a deterministic 64-character lowercase hex string for any input
 * string. Used for sync-level hashing in the simulation snapshot system
 * (~1µs per call for typical state sizes).
 *
 * Requires a Secure Context (HTTPS or localhost) in browser environments.
 * In Node.js, requires Node.js 15+ (or 19+ without flags).
 *
 * @param data — Input string to hash. May be empty.
 * @returns 64-character lowercase hex string, zero-padded to 64 digits.
 *
 * @example
 * ```typescript
 * await sha256("hello");
 * // → "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
 *
 * await sha256("");
 * // → "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * ```
 */
export async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compute the SHA-256 hash of all systems' state within a full-game snapshot.
 *
 * Systems are iterated in alphabetical order by `systemId` to ensure the
 * resulting hash is deterministic regardless of the order systems were
 * registered with the orchestrator.
 *
 * This is a separate step from `takeSnapshot()` — it is async (SHA-256 via
 * Web Crypto) whereas `takeSnapshot()` is synchronous. The caller obtains
 * the raw snapshot (with `snapshotHash === ""`), calls this function, then
 * assigns the result:
 *
 * ```typescript
 * const raw = orchestrator.takeSnapshot(42);
 * const hash = await computeSnapshotHash(raw);
 * const final: FullGameSnapshot = { ...raw, snapshotHash: hash };
 * ```
 *
 * @param snapshot — A full-game snapshot whose systems state will be hashed.
 * @returns 64-character lowercase hex string (SHA-256 of concatenated state).
 *
 * @example
 * ```typescript
 * const hash = await computeSnapshotHash(snapshot);
 * console.log(hash); // "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * ```
 */
export async function computeSnapshotHash(
  snapshot: FullGameSnapshot
): Promise<string> {
  const sortedIds = Object.keys(snapshot.systems).sort();
  const concatenated = sortedIds
    .map((id) => `${id}:${JSON.stringify(snapshot.systems[id].state)}`)
    .join("\n");
  return sha256(concatenated);
}
