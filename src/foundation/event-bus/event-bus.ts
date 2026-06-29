/**
 * Runtime Event Bus — synchronous, typed pub-sub with error isolation.
 *
 * Features:
 * - Synchronous dispatch with handler error isolation
 * - `once()` for single-fire subscriptions
 * - Circular emit depth detection (configurable, default 10)
 * - Leak detection at `dispose()` (configurable warn/silent)
 * - Snapshot-based dispatch (subscribe/unsubscribe during dispatch is safe)
 *
 * @see ADR-0001 — Event Bus Architecture
 */

import { EventBusError } from "./errors";
import type {
  EventBusConfig,
  EventMap,
  IEventBus,
  Subscription,
} from "./types";

// biome-ignore lint/suspicious/noExplicitAny: Generic handler — payload type is validated at on()/emit() level via EventMap
type Handler = (payload: any) => void;
type BusState = "uninitialized" | "ready" | "disposed";

/** Default configuration values. */
const DEFAULT_CONFIG: EventBusConfig = {
  maxEmitDepth: 10,
  leakDetectionLevel: "warn",
};

export class EventBus implements IEventBus {
  private _state: BusState = "uninitialized";
  private _handlers = new Map<keyof EventMap, Set<Handler>>();
  private _wildcardHandlers = new Set<
    (detail: { event: string; payload: unknown }) => void
  >();
  private _emitDepth = 0;
  private _maxEmitDepth: number;
  private _leakDetectionLevel: "warn" | "silent";

  /**
   * Create a new EventBus instance.
   *
   * @param config - Optional configuration overrides (defaults: `maxEmitDepth: 10`, `leakDetectionLevel: 'warn'`)
   *
   * @example
   * ```typescript
   * // Default config
   * const bus = new EventBus();
   *
   * // Production config — suppress leak warnings, tighter depth limit
   * const bus = new EventBus({ maxEmitDepth: 8, leakDetectionLevel: 'silent' });
   * ```
   */
  constructor(config?: Partial<EventBusConfig>) {
    this._maxEmitDepth = config?.maxEmitDepth ?? DEFAULT_CONFIG.maxEmitDepth;
    this._leakDetectionLevel =
      config?.leakDetectionLevel ?? DEFAULT_CONFIG.leakDetectionLevel;
  }

  init(): void {
    if (this._state === "disposed") {
      throw new EventBusError("Already disposed");
    }
    this._state = "ready";
  }

  dispose(): void {
    if (this._state === "disposed") {
      return;
    }

    // Leak detection: warn if subscriptions remain before clearing
    if (this._leakDetectionLevel === "warn") {
      const activeEvents = this._getActiveNamespaces();
      if (activeEvents.length > 0) {
        console.warn(
          `[EventBus] Leaked subscriptions on dispose (event namespace${activeEvents.length > 1 ? "s" : ""}): ${activeEvents.join(", ")}`
        );
      }
      if (this._wildcardHandlers.size > 0) {
        console.warn(
          `[EventBus] Leaked wildcard subscriptions on dispose (${this._wildcardHandlers.size} handler${this._wildcardHandlers.size > 1 ? "s" : ""})`
        );
      }
    }

    this._handlers.clear();
    this._wildcardHandlers.clear();
    this._state = "disposed";
  }

  on<E extends keyof EventMap>(
    event: E,
    handler: (payload: EventMap[E]) => void
  ): Subscription;
  on(
    event: "*",
    handler: (detail: { event: string; payload: unknown }) => void
  ): Subscription;
  on(
    event: keyof EventMap | "*",
    handler: Handler | ((detail: { event: string; payload: unknown }) => void)
  ): Subscription {
    this._assertReady();

    if (event === "*") {
      this._wildcardHandlers.add(
        handler as (detail: { event: string; payload: unknown }) => void
      );
      return {
        unsubscribe: () => {
          this._wildcardHandlers.delete(
            handler as (detail: { event: string; payload: unknown }) => void
          );
        },
      };
    }

    let handlers = this._handlers.get(event);
    if (!handlers) {
      handlers = new Set();
      this._handlers.set(event, handlers);
    }

    handlers.add(handler);

    return {
      unsubscribe: () => {
        handlers.delete(handler);
      },
    };
  }

  once<E extends keyof EventMap>(
    event: E,
    handler: (payload: EventMap[E]) => void
  ): Subscription {
    this._assertReady();

    // Wrap handler: unsubscribe before calling user's handler
    // This ensures the handler cannot re-subscribe for the same emit
    let sub: Subscription;
    const wrapper = (payload: EventMap[E]): void => {
      sub.unsubscribe();
      handler(payload);
    };
    sub = this.on(event, wrapper);
    return sub;
  }

  emit<E extends keyof EventMap>(event: E, payload: EventMap[E]): void {
    this._assertReady();

    const handlers = this._handlers.get(event);
    const hasTypedHandlers = handlers && handlers.size > 0;
    const hasWildcardHandlers = this._wildcardHandlers.size > 0;

    if (!hasTypedHandlers && !hasWildcardHandlers) {
      return;
    }

    this._emitDepth++;
    try {
      // Circular emit guard: throw if depth exceeds configured maximum.
      // Checked AFTER increment so `depth > maxDepth` means "too deep".
      // Placed before handler iteration so the error propagates up the
      // call stack and is NOT caught by handler error isolation.
      if (this._emitDepth > this._maxEmitDepth) {
        throw new EventBusError("Max emit depth exceeded");
      }

      // Snapshot iteration: subscribe/unsubscribe during dispatch is safe
      if (hasTypedHandlers) {
        const snapshot = Array.from(handlers);
        for (const handler of snapshot) {
          try {
            handler(payload);
          } catch (error) {
            // Re-throw depth errors — they must abort the entire dispatch chain,
            // not be caught by handler error isolation.
            if (
              error instanceof EventBusError &&
              error.message === "Max emit depth exceeded"
            ) {
              throw error;
            }
            console.error(
              `[EventBus] Handler error on "${event as string}":`,
              error
            );
          }
        }
      }

      // Wildcard handlers: call after typed handlers with { event, payload }
      if (hasWildcardHandlers) {
        const wildcardSnapshot = Array.from(this._wildcardHandlers);
        const detail = { event: event as string, payload: payload as unknown };
        for (const handler of wildcardSnapshot) {
          try {
            handler(detail);
          } catch (error) {
            if (
              error instanceof EventBusError &&
              error.message === "Max emit depth exceeded"
            ) {
              throw error;
            }
            console.error(
              `[EventBus] Wildcard handler error on "${event as string}":`,
              error
            );
          }
        }
      }
    } finally {
      this._emitDepth--;
    }
  }

  off(subscription: Subscription): void;
  off<E extends keyof EventMap>(event: E): IEventBus;
  off(
    subscriptionOrEvent: Subscription | keyof EventMap
  ): undefined | IEventBus {
    this._assertReady();

    if (typeof subscriptionOrEvent === "string") {
      this._handlers.delete(subscriptionOrEvent);
      return this;
    }

    subscriptionOrEvent.unsubscribe();
  }

  /**
   * Get a snapshot of all active subscriptions.
   *
   * Returns a Map of event names to their handler counts.
   * Useful for debugging and dev tools inspection.
   *
   * @returns Map<string, number> — event name → handler count
   */
  getSubscriptions(): Map<string, number> {
    const result = new Map<string, number>();
    for (const [event, handlers] of this._handlers) {
      if (handlers.size > 0) {
        result.set(event as string, handlers.size);
      }
    }
    // Include wildcard handler count (F-001 — wildcard subscriptions
    // were omitted from the snapshot, making the subscription count
    // appear incomplete in dev tools inspection).
    if (this._wildcardHandlers.size > 0) {
      result.set("*", this._wildcardHandlers.size);
    }
    return result;
  }

  /**
   * Extract unique namespace prefixes from events with active subscriptions.
   * Groups event names by their first segment (e.g., `'race.finish'` → `'race'`).
   * Used by leak detection to identify which systems leaked.
   */
  private _getActiveNamespaces(): string[] {
    const namespaces = new Set<string>();
    for (const [event, handlers] of this._handlers) {
      if (handlers.size > 0) {
        const namespace = (event as string).split(".")[0];
        namespaces.add(namespace);
      }
    }
    return Array.from(namespaces).sort();
  }

  private _assertReady(): void {
    if (this._state === "uninitialized") {
      throw new EventBusError("Not initialized");
    }
    if (this._state === "disposed") {
      throw new EventBusError("Already disposed");
    }
  }
}
