/**
 * Custom error for Event Bus operations.
 *
 * Thrown when:
 * - Circular emit depth is exceeded (configurable default: 10)
 * - Invalid operations during Event Bus lifecycle
 *
 * Each error carries a numeric `code` that callers can compare against
 * instead of fragile string matching on `message`.
 *
 * @example
 * ```typescript
 * try {
 *   eventBus.emit("race.starting", {});
 * } catch (e) {
 *   if (e instanceof EventBusError && e.code === EMIT_DEPTH_EXCEEDED) {
 *     // Circular emit — handle or abort
 *   }
 * }
 * ```
 */

/** Error code: emit depth exceeded the configured maximum. */
export const EMIT_DEPTH_EXCEEDED = 1;

export class EventBusError extends Error {
  /** Numeric error code for machine-readable error handling. */
  readonly code: number;

  constructor(message: string, code = 0) {
    super(message);
    this.name = "EventBusError";
    this.code = code;
  }
}
