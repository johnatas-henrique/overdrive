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

/**
 * Custom error thrown when a required schema migration step is missing.
 *
 * Thrown by `_runMigrations()` when the migration chain has a gap —
 * the stored version requires a migration step that was never registered.
 *
 * @see ADR-0016 — Migration chain via registerMigration(from, to, fn)
 *
 * @example
 * ```typescript
 * try {
 *   const data = await persistence.load("settings");
 * } catch (e) {
 *   if (e instanceof MigrationError) {
 *     console.error("Missing migration:", e.message);
 *   }
 * }
 * ```
 */
export class MigrationError extends Error {
  /**
   * @param message - Human-readable error description
   *
   * @example
   * ```typescript
   * throw new MigrationError("Missing migration: 0.1.0 → 0.2.0");
   * ```
   */
  constructor(message: string) {
    super(message);
    this.name = "MigrationError";
  }
}
