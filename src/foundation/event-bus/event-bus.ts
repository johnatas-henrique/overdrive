/**
 * Runtime Event Bus — synchronous, typed pub-sub with error isolation.
 *
 * @see ADR-0001 — Event Bus Architecture
 */

import { EventBusError } from "./errors";
import type { EventMap, IEventBus, Subscription } from "./types";

type Handler = (payload: any) => void;
type BusState = "uninitialized" | "ready" | "disposed";

export class EventBus implements IEventBus {
  private _state: BusState = "uninitialized";
  private _handlers = new Map<keyof EventMap, Set<Handler>>();

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
    this._handlers.clear();
    this._state = "disposed";
  }

  on<E extends keyof EventMap>(
    event: E,
    handler: (payload: EventMap[E]) => void
  ): Subscription {
    this._assertReady();

    let handlers = this._handlers.get(event);
    if (!handlers) {
      handlers = new Set();
      this._handlers.set(event, handlers);
    }

    handlers.add(handler);

    return {
      unsubscribe: () => {
        handlers!.delete(handler);
      },
    };
  }

  once<E extends keyof EventMap>(
    _event: E,
    _handler: (payload: EventMap[E]) => void
  ): Subscription {
    throw new EventBusError("once() not implemented in Story 002");
  }

  emit<E extends keyof EventMap>(event: E, payload: EventMap[E]): void {
    this._assertReady();

    const handlers = this._handlers.get(event);
    if (!handlers || handlers.size === 0) {
      return;
    }

    const snapshot = Array.from(handlers);
    for (const handler of snapshot) {
      try {
        handler(payload);
      } catch (error) {
        console.error(
          `[EventBus] Handler error on "${event as string}":`,
          error
        );
      }
    }
  }

  off(subscription: Subscription): void {
    this._assertReady();
    subscription.unsubscribe();
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
