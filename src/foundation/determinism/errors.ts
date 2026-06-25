/**
 * Custom error for determinism violations.
 *
 * Thrown when non-deterministic APIs (Math.random, Date.now, performance.now)
 * are called during a fixed update tick while the dev guard is active.
 *
 * @see ADR-0002 — Fixed Timestep & Determinism Pipeline
 * @see DeterminismGuard
 */
export class DeterminismError extends Error {
  /**
   * @param message - Human-readable error description
   *
   * @example
   * ```typescript
   * throw new DeterminismError('Math.random forbidden during fixed update');
   * throw new DeterminismError('Date.now forbidden during fixed update');
   * ```
   */
  constructor(message: string) {
    super(message);
    this.name = "DeterminismError";
  }
}
