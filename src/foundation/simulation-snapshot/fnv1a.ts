/**
 * FNV-1a 64-bit hash function implemented in pure TypeScript.
 *
 * Returns a deterministic 16-character hex string for any input string.
 * Used for tick-level hashing in the simulation snapshot system (~50ns per
 * call for typical state sizes).
 *
 * The implementation uses BigInt arithmetic with no external dependencies.
 * Masking to 64 bits is performed at each multiplication step to match the
 * standard FNV-1a behaviour on 64-bit platforms.
 *
 * Note: Processes UTF-16 code units (via `charCodeAt`), not raw bytes.
 * Deterministic within the same TypeScript runtime, but not byte-compatible
 * with C/Rust FNV-1a for non-ASCII input. All game systems run in the same
 * runtime, so cross-system determinism is preserved.
 *
 * @param data — Input string to hash. May be empty.
 * @returns 16-character lowercase hex string, zero-padded to 16 digits.
 *
 * @example
 * ```typescript
 * fnv1a("hello");                    // → "a430d84680aabd0b"
 * fnv1a("");                         // → "cbf29ce484222325"
 * fnv1a(JSON.stringify({ x: 1 }));  // → 16-character hex string
 * ```
 */
export function fnv1a(data: string): string {
  // FNV offset basis (64-bit)
  let hash = 0xcbf29ce484222325n;
  // FNV prime (64-bit)
  const prime = 0x100000001b3n;
  // 64-bit mask
  const mask = 0xffffffffffffffffn;

  for (let i = 0; i < data.length; i++) {
    hash ^= BigInt(data.charCodeAt(i));
    hash = (hash * prime) & mask; // force 64-bit
  }

  return hash.toString(16).padStart(16, "0");
}
