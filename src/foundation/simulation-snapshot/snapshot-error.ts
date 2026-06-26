/**
 * Error type for simulation snapshot system operations.
 *
 * Thrown when the orchestrator is not in the correct state for an operation
 * (e.g. calling register() or takeSnapshot() before init(), or after dispose()).
 *
 * @example
 * ```typescript
 * throw new SnapshotError("Not initialized");
 * // → SnapshotError: Not initialized
 * //   name: "SnapshotError"
 * ```
 */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotError";
  }
}
