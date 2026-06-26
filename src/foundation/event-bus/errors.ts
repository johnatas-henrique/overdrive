/**
 * Custom error for Event Bus operations.
 *
 * Thrown when:
 * - Circular emit depth is exceeded (configurable default: 10)
 * - Invalid operations during Event Bus lifecycle
 *
 * @example
 * ```typescript
 * try {
 *   eventBus.emit("race.starting", {});
 * } catch (e) {
 *   if (e instanceof EventBusError) {
 *     console.error("Event Bus error:", e.message);
 *   }
 * }
 * ```
 */
export class EventBusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventBusError";
  }
}
