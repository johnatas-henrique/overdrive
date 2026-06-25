/**
 * Custom error for Persistence operations.
 *
 * Thrown when:
 * - `save()`, `load()`, or `delete()` is called before `init()`
 *   (state is `Uninitialized`)
 * - Other Persistence contract violations occur
 *
 * @see ADR-0016 — Persistence Interface
 *
 * @example
 * ```typescript
 * try {
 *   await persistence.save("settings", data);
 * } catch (e) {
 *   if (e instanceof PersistenceError) {
 *     console.error("Persistence error:", e.message);
 *   }
 * }
 * ```
 */
export class PersistenceError extends Error {
  /**
   * @param message - Human-readable error description
   *
   * @example
   * ```typescript
   * throw new PersistenceError("Not initialized. Call init() first.");
   * ```
   */
  constructor(message: string) {
    super(message);
    this.name = "PersistenceError";
  }
}
