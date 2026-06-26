/**
 * Custom error for FixedUpdatePipeline operations.
 *
 * Thrown when:
 * - Registering after the pipeline has started or is disposed
 * - Calling executeTick before start or after dispose
 * - Providing an invalid slot index (outside 1–8)
 * - Registering a duplicate system ID
 * - Registering into an already-occupied slot
 * - Calling start() from an invalid state
 *
 * @see ADR-0002 — Fixed Timestep & Determinism Pipeline
 * @see FixedUpdatePipeline
 */
export class PipelineError extends Error {
  /**
   * @param message - Human-readable error description
   *
   * @example
   * ```typescript
   * throw new PipelineError('Cannot register after pipeline has started');
   * throw new PipelineError('Invalid slot index: 0');
   * ```
   */
  constructor(message: string) {
    super(message);
    this.name = "PipelineError";
  }
}
