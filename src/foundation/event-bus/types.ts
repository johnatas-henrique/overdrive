/**
 * Pit stop state machine states for a car.
 *
 * Represents the four states a car transitions through during a pit stop:
 * - `"onTrack"`: Racing on track, not in pit sequence
 * - `"pitEntry"`: Entering pit lane, speed-limited
 * - `"pitStopped"`: Stationary in pit box, receiving service
 * - `"departing"`: Exiting pit lane, merging back onto track
 */
export type PitState = "onTrack" | "pitEntry" | "pitStopped" | "departing";

/**
 * Results payload for race completion events.
 *
 * Carried by `race.completed` and `race.checkered` events to convey
 * final standings and fastest lap data.
 */
export type RaceResults = {
  /** Final finishing order with per-car timing. */
  positions: { carId: string; position: number; totalTime: number }[];
  /** The single fastest lap across all cars. */
  fastestLap: { carId: string; lapTime: number };
  /** Total number of laps completed in the race. */
  totalLaps: number;
};

/**
 * Central type registry for all Event Bus events.
 *
 * Every event in the game is declared here with its payload type.
 * `emit()` and `on()` are compile-time checked against this map —
 * wrong payload shape or non-existent event name is a compile error.
 *
 * @see ADR-0001 — Event Bus Architecture, EventMap Central Type Registry (F10)
 */
export type EventMap = {
  /** Fired when the Game State Machine enters a new state. */
  "gsm.state.entered": { from: string; to: string };
  /** Fired when the Game State Machine exits a state. */
  "gsm.state.exited": { from: string };
  /** Fired when a GSM transition fails (invalid transition or onEnter error). */
  "gsm.transition.error": { from: string; to: string; reason: string };
  /** A car entity has been spawned into the scene. */
  "entity.spawned": { carId: string };
  /** A car entity has been removed from the scene. */
  "entity.despawned": { carId: string };
  /** Two cars have collided (or car with barrier). */
  "collision.impact": { carIdA: string; carIdB: string; impulse: number };
  /** A car has run out of fuel. */
  "car.fuel_empty": { carId: string };
  /** A car's tire has blown. */
  "car.tire_blown": { carId: string };
  /** A car has come to a complete stop. */
  "car.stopped": { carId: string };
  /** A car has entered pit lane. */
  "pit.entry": { carId: string };
  /** A car has exited pit lane back onto track. */
  "pit.exit": { carId: string };
  /** A car's pit stop state has changed (onTrack → pitEntry → pitStopped → departing → onTrack). */
  "pit.status": { carId: string; status: PitState };
  /** Fuel service progress during a pit stop (0..1). */
  "pit.fuel_status": { carId: string; progress: number };
  /** Tire service progress during a pit stop (0..1). */
  "pit.tire_status": { carId: string; progress: number };
  /** A car's race position has changed. */
  "position.changed": { carId: string; old: number; new: number };
  /** A car has completed a lap. */
  "car.lap.completed": { carId: string; lap: number; lapTime: number };
  /** A car has retired from the race (Did Not Finish). */
  "car.dnf": { carId: string; reason: string };
  /** A car is stalled in the pit box. */
  "car.stalled_in_pit": { carId: string };
  /** The race is starting (all cars on grid). */
  "race.starting": Record<string, never>;
  /** Race light countdown update (number of lights currently on). */
  "race.light.countdown": { lightsOn: number };
  /** Green flag — race is active. */
  "race.green.flag": Record<string, never>;
  /** The race has completed with final results. */
  "race.completed": { results: RaceResults };
  /** A specific car has received the checkered flag. */
  "race.checkered": { carId: string; lap: number; results: RaceResults };
  /** The race has been abandoned (e.g., critical error, all-car DNF). */
  "race.abandoned": Record<string, never>;
  /** A new race has started with the given configuration. */
  "race.started": { track: string; totalLaps: number; playerCarId: string };
  /** An asset failed to load. */
  "asset.error": { assetId: string; error: Error };

  /** Player confirmed to depart from pit stop. */
  "input.pit.depart": Record<string, never>;
  /** Player confirmed on post-race results screen. */
  "input.confirm.postRace": Record<string, never>;
  /** Player confirmed on menu screen. */
  "input.confirm.menu": Record<string, never>;
};

/**
 * Configuration options for the EventBus instance.
 *
 * All options have sensible defaults and can be omitted for standard usage.
 * Override via `new EventBus(config)` or the individual setter patterns.
 *
 * @see ADR-0001 — Circular Emit Depth, Leak Detection
 */
export interface EventBusConfig {
  /**
   * Maximum nested emit depth before throwing `EventBusError('Max emit depth exceeded')`.
   * Depth exactly equal to this value succeeds; depth exceeding it throws.
   * @default 10
   */
  maxEmitDepth: number;

  /**
   * Controls leak detection behavior at `dispose()` time.
   * - `'warn'`: `console.warn` with active subscription namespaces (default, dev mode)
   * - `'silent'`: no warnings (production)
   * @default 'warn'
   */
  leakDetectionLevel: "warn" | "silent";
}

/**
 * Handle for unsubscribing from an event subscription.
 *
 * Returned by `IEventBus.on()` and `IEventBus.once()`.
 * Calling `unsubscribe()` removes the handler from the event's subscriber list.
 * `off()` on the same Subscription is idempotent.
 *
 * @see ADR-0001 — Subscription Pattern (F8)
 */
export interface Subscription {
  /** Remove this subscription so the handler no longer receives events. */
  unsubscribe(): void;
}

/**
 * Typed Event Bus interface for the game's event system.
 *
 * All events are declared in {@link EventMap} and type-checked at compile time.
 * Dispatch is synchronous — `emit()` returns only after all handlers execute.
 *
 * @example
 * ```typescript
 * const bus: IEventBus = createEventBus();
 *
 * const sub = bus.on("car.fuel_empty", ({ carId }) => {
 *   console.warn(`${carId} is out of fuel!`);
 * });
 *
 * bus.emit("car.fuel_empty", { carId: "player" });
 * // Logs: "player is out of fuel!"
 *
 * sub.unsubscribe();
 * ```
 *
 * @see ADR-0001 — Event Bus Architecture
 */
export interface IEventBus {
  /**
   * Subscribe to an event. The handler receives the typed payload
   * matching the event name in {@link EventMap}.
   *
   * Use `"*"` to subscribe to all events — the handler receives a
   * `{ event: string; payload: unknown }` object.
   *
   * Returns a {@link Subscription} that can be used to unsubscribe.
   */
  on<E extends keyof EventMap>(
    event: E,
    handler: (payload: EventMap[E]) => void
  ): Subscription;

  /**
   * Subscribe to all events (wildcard).
   * The handler receives `{ event: string; payload: unknown }`.
   *
   * Returns a {@link Subscription} that can be used to unsubscribe.
   */
  on(
    event: "*",
    handler: (detail: { event: string; payload: unknown }) => void
  ): Subscription;

  /**
   * Subscribe to an event for exactly one emission.
   * The handler fires once, then automatically unsubscribes.
   *
   * Returns a {@link Subscription} that can be used to cancel before
   * the event fires.
   */
  once<E extends keyof EventMap>(
    event: E,
    handler: (payload: EventMap[E]) => void
  ): Subscription;

  /**
   * Emit an event with a typed payload.
   *
   * All handlers are executed synchronously in registration order
   * on the same call stack. If a handler throws, remaining handlers
   * still execute — the error is caught and logged individually.
   */
  emit<E extends keyof EventMap>(event: E, payload: EventMap[E]): void;

  /**
   * Remove all handlers for the given event and return the bus for chaining.
   *
   * Use the reentrant pattern `bus.off("race.started").on("race.started", ...)`
   * to prevent duplicate subscriptions when re-initialising.
   */
  off<E extends keyof EventMap>(event: E): IEventBus;

  /**
   * Unsubscribe a previously returned Subscription.
   * Idempotent — calling twice on the same Subscription is safe.
   */
  off(handler: Subscription): void;

  /**
   * Get a snapshot of all active subscriptions.
   *
   * Returns a Map of event names to their handler counts.
   * Useful for debugging and dev tools inspection.
   *
   * @returns Map<string, number> — event name → handler count
   */
  getSubscriptions(): Map<string, number>;

  /**
   * Dispose the Event Bus, removing all subscriptions.
   *
   * Called during app teardown. If any system has active subscriptions
   * without unsubscribing, a warning is logged (leak detection).
   */
  dispose(): void;
}
