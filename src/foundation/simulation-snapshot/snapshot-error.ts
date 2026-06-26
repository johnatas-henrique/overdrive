/**
 * Error type for simulation snapshot system operations.
 *
 * Thrown for duplicate registration or deserialize failures during restoration.
 * Carries the affected system's ID and a machine-readable error code.
 *
 * @example
 * ```typescript
 * // Duplicate registration:
 * throw new SnapshotError(
 *   "System already registered: physics",
 *   "physics",
 *   "SNAPSHOT_DUPLICATE_REGISTRATION"
 * );
 *
 * // Deserialize failure:
 * throw new SnapshotError(
 *   "Failed to restore fuel system state",
 *   "fuel",
 *   "SNAPSHOT_DESERIALIZE_FAILURE"
 * );
 * ```
 */
export class SnapshotError extends Error {
  /**
   * @param message - Human-readable error description.
   * @param systemId - The systemId that caused the error (default: `""`).
   * @param code - Machine-readable error code
   *   (default: `"SNAPSHOT_DUPLICATE_REGISTRATION"`).
   */
  constructor(
    message: string,
    public readonly systemId: string = "",
    public readonly code:
      | "SNAPSHOT_DUPLICATE_REGISTRATION"
      | "SNAPSHOT_DESERIALIZE_FAILURE" = "SNAPSHOT_DUPLICATE_REGISTRATION"
  ) {
    super(message);
    this.name = "SnapshotError";
  }
}

/**
 * Result of a {@link SimulationSnapshot.restoreSnapshot} operation.
 *
 * Reports per-system outcomes so callers can inspect which systems succeeded
 * and which failed, along with the error for each failure.
 *
 * @example
 * ```typescript
 * const result = snapshotManager.restoreSnapshot(snap);
 * console.log(`Succeeded: ${result.succeeded.join(", ")}`);
 * for (const f of result.failed) {
 *   console.warn(`Failed: ${f.systemId} — ${f.error.message}`);
 * }
 * ```
 */
export interface SnapshotRestoreResult {
  /** System IDs whose `deserialize()` completed successfully. */
  readonly succeeded: string[];
  /** Systems that threw during `deserialize()`, with their error details. */
  readonly failed: Array<{
    /** The systemId that failed. */
    readonly systemId: string;
    /** The error that was thrown. */
    readonly error: Error;
  }>;
}
