/**
 * Core Game State Machine — flat FSM with transition table.
 *
 * Manages the game's lifecycle phases: Loading, Menu, PreRace, Racing,
 * Paused, PostRace. Transitions are validated against a static table
 * and invalid transitions throw `GameStateError`.
 *
 * Features:
 * - O(1) transition lookup via `Record<State, State[]>` (array scan on ≤2 elements)
 * - Invalid transitions throw `GameStateError` (no silent ignores)
 * - Same-state transitions are silent no-ops
 * - `init()` is idempotent — safe to call multiple times
 * - Optional lifecycle hooks (`onEnter`/`onExit`) per state definition
 * - Async hooks are awaited; `onEnter` rejection triggers rollback
 * - Internal `_busy` flag prevents concurrent transitions
 * - Event Bus integration: emits `gsm.state.exited` then `gsm.state.entered`
 *   on every successful transition (see TR-GSM-003)
 *
 * ## Design Decisions
 *
 * - **Event Bus is optional**: passed via constructor. If null/undefined,
 *   transitions complete without emissions and a one-time warning is logged.
 * - **`getCurrentState()` exists despite ADR-0024 Decision 6**: the ADR prohibits
 *   systems from *polling* state. This accessor is marked `@internal` and exists
 *   solely for test assertions and debug tooling. Game systems must subscribe
 *   to `gsm.state.entered`/`gsm.state.exited` via Event Bus.
 * - **`init()` is a separate lifecycle step** (not in constructor): deferred
 *   initialization allows Event Bus to be wired before GSM emits events.
 *
 * @see ADR-0024 — Game State Machine
 */

import type { IEventBus } from "../event-bus/types";
import { GameStateError } from "./GameStateError";
import { TRANSITIONS } from "./TransitionTable";
import type { State, StateDefinition } from "./types";

/**
 * A single recorded state transition for debug history.
 *
 * @see F27 — 20-entry ring buffer of last transitions for debug
 */
export interface TransitionRecord {
  /** Source state */
  readonly from: State;
  /** Target state */
  readonly to: State;
  /** Date.now() when the transition completed (hooks resolved) */
  readonly timestamp: number;
  /** Milliseconds spent in `from` before this transition */
  readonly durationInPreviousState: number;
}

/** Event name for GSM state exit. */
const GSM_STATE_EXITED = "gsm.state.exited";
/** Event name for GSM state entry. */
const GSM_STATE_ENTERED = "gsm.state.entered";

export class GameStateMachine {
  private _currentState: State | undefined;
  private _stateDefinitions = new Map<State, StateDefinition>();
  private _busy = false;
  private _eventBus: IEventBus | null | undefined;
  private _warnedEbMissing = false;
  private readonly _queue: State[] = [];
  private readonly _maxQueueSize: number;
  private _disposed = false;

  /** Ring buffer of last 20 successful transitions for debug tooling. */
  private readonly _history: TransitionRecord[] = [];
  /** Fixed capacity per ADR-0024 Decision 5 / F27. */
  private static readonly _maxHistorySize = 20;
  /** Timestamp from `init()` for computing first-transition duration. */
  private _initTimestamp = 0;

  /**
   * Create a new GameStateMachine.
   *
   * @param eventBus - Optional Event Bus instance for emitting state-change
   *   events. If null or undefined, transitions still complete but no events
   *   are emitted and a one-time warning is logged.
   * @param options - Optional configuration:
   *   - `maxQueueSize`: Max queued transitions (default 10). Oldest dropped
   *     on overflow with a console.warn.
   *
   * @example
   * ```typescript
   * // With Event Bus
   * const gsm = new GameStateMachine(eventBus);
   *
   * // Without Event Bus (transitions work but no events emitted)
   * const gsm = new GameStateMachine();
   *
   * // Custom queue size
   * const gsm = new GameStateMachine(eventBus, { maxQueueSize: 20 });
   * ```
   */
  constructor(
    eventBus?: IEventBus | null,
    options?: { maxQueueSize?: number }
  ) {
    this._eventBus = eventBus;
    this._maxQueueSize = options?.maxQueueSize ?? 10;
  }

  /**
   * Get the current state of the machine.
   *
   * **@internal** — Game systems must NOT poll this. They should
   * subscribe to `gsm.state.entered` / `gsm.state.exited` via the
   * Event Bus (ADR-0024 Decision 6). This accessor exists solely for
   * test assertions and debug tooling.
   *
   * @returns The current state, or `undefined` if `init()` has not been called
   *
   * @see ADR-0024 — Decision 6: No public `getCurrent()`
   */
  /** @internal */
  getCurrentState(): State | undefined {
    return this._currentState;
  }

  /**
   * Initialize the GSM, setting the initial state to `Loading`.
   *
   * Idempotent — calling a second time is a no-op.
   * Does NOT emit events — the initial state is a bootstrap, not a transition.
   *
   * @example
   * ```typescript
   * const gsm = new GameStateMachine();
   * gsm.init();
   * gsm.getCurrentState(); // 'Loading'
   * ```
   */
  init(): void {
    if (this._disposed) {
      return; // No-op after dispose — GSM is not reusable
    }
    if (this._currentState !== undefined) {
      return; // Idempotent: already initialized
    }
    this._currentState = "Loading";
    this._initTimestamp = Date.now();
  }

  /**
   * Register state definitions with lifecycle hooks.
   *
   * Must be called before `transition()` to enable hooks. States without
   * definitions can still be transitioned to — hooks are optional.
   *
   * Hook values are validated at registration time: each must be `undefined`
   * or a function. Non-function values throw `TypeError`.
   *
   * @param defs - Array of state definitions
   * @throws {TypeError} If a hook is defined but is not a function
   *
   * @example
   * ```typescript
   * gsm.registerStates([
   *   { name: "Menu", onEnter: () => console.log("Entering Menu") },
   *   {
   *     name: "Racing",
   *     onEnter: () => loadRaceAssets(),
   *     onExit: () => cleanupRace(),
   *   },
   * ]);
   * ```
   */
  registerStates(defs: StateDefinition[]): void {
    for (const def of defs) {
      if (def.onEnter !== undefined && typeof def.onEnter !== "function") {
        throw new TypeError(
          `onEnter for state "${def.name}" must be a function, got ${typeof def.onEnter}`
        );
      }
      if (def.onExit !== undefined && typeof def.onExit !== "function") {
        throw new TypeError(
          `onExit for state "${def.name}" must be a function, got ${typeof def.onExit}`
        );
      }
      if (this._stateDefinitions.has(def.name)) {
        throw new TypeError(
          `Duplicate state definition for "${def.name}". Use registerStates() once per state.`
        );
      }
      this._stateDefinitions.set(def.name, def);
    }
  }

  /**
   * Transition the GSM to a new state.
   *
   * - If `target` equals the current state, this is a silent no-op.
   * - If a transition is already in progress (`_busy`), the request is
   *   enqueued and executed on a future `tick()` call. Validation against
   *   the transition table happens at execution time, not queue time.
   * - If `target` is a valid transition from the current state and GSM is
   *   not busy, the state changes immediately.
   *
   * On successful transition, two Event Bus events are emitted in order:
   * `gsm.state.exited` (payload: `{ from: previousState }`) then
   * `gsm.state.entered` (payload: `{ from: previousState, to: newState }`).
   * Each emit is independently wrapped in try/catch — a failure in one does
   * not prevent the other, and the transition is never rolled back.
   *
   * Lifecycle hooks (if registered) are called in order:
   * `source.onExit()` → `target.onEnter()`. Both may be sync or async.
   * Async hooks are awaited before the transition is marked complete.
   *
   * If `onEnter()` rejects, the transition rolls back: the state remains
   * unchanged, a warning is logged, and `gsm.state.entered` is emitted
   * for the restored (previous) state via the Event Bus.
   *
   * @param target - The state to transition to
   * @returns A Promise that resolves when the transition completes
   *
   * @example
   * ```typescript
   * gsm.init();              // Loading
   * await gsm.transition("Menu");  // Loading → Menu (succeeds)
   * gsm.transition("Racing"); // Menu → Racing (throws GameStateError)
   * ```
   */
  async transition(target: State): Promise<void> {
    // No-op after dispose — system is shut down
    if (this._disposed) {
      return;
    }

    if (this._currentState === undefined) {
      throw new GameStateError("Uninitialized", target);
    }

    // Same-state transition: silent no-op
    if (target === this._currentState) {
      return;
    }

    // If busy, enqueue for later execution
    if (this._busy) {
      this._enqueue(target);
      return;
    }

    const allowed = TRANSITIONS[this._currentState];
    if (!allowed?.includes(target)) {
      throw new GameStateError(this._currentState, target);
    }

    const sourceDef = this._stateDefinitions.get(this._currentState);
    const targetDef = this._stateDefinitions.get(target);
    const previousState = this._currentState;

    this._busy = true;

    try {
      // Call source onExit — errors propagate to caller
      if (sourceDef?.onExit) {
        await sourceDef.onExit();
      }

      // Guard: disposed during onExit — skip onEnter, skip events
      if (this._disposed) {
        return;
      }

      // Call target onEnter — errors trigger rollback
      try {
        if (targetDef?.onEnter) {
          await targetDef.onEnter();
        }

        // Guard: disposed during onEnter — skip state change, skip events
        if (this._disposed) {
          return;
        }

        // Transition complete — update state
        this._currentState = target;

        // Record successful transition in ring buffer (debug tooling)
        this._recordTransition(previousState, target);

        // Emit Event Bus events (exited before entered, both resilient to failure)
        this._warnIfEbMissing();
        this._emitExited(previousState);
        this._emitEntered(previousState, target);
      } catch (error) {
        // Guard: disposed — no rollback events
        if (this._disposed) {
          return;
        }
        // Rollback: stay in previous state
        console.warn("[GSM] onEnter failed for", target, error);
        // Re-emit gsm.state.entered for previous state (restored)
        this._warnIfEbMissing();
        this._emitEntered(previousState, previousState);
      }
    } finally {
      this._busy = false;
    }
  }

  /**
   * Process at most 1 queued transition per call.
   *
   * Called externally by the FixedUpdatePipeline at the start of each frame.
   * If no transitions are queued, this is a no-op. If the GSM is busy with
   * an in-flight transition, this is a no-op (the next tick will pick up).
   *
   * If the dequeued transition is invalid against the **current** state
   * (state may have changed since the call was queued), the error is logged
   * and the GSM continues — the queue is not corrupted.
   *
   * After `dispose()`, `tick()` is a permanent no-op.
   *
   * @example
   * ```typescript
   * // Called once per frame by FixedUpdatePipeline
   * pipeline.on("frame", () => gsm.tick());
   * ```
   */
  tick(): void {
    if (this._disposed || this._busy) return;
    const next = this._queue.shift();
    if (next === undefined) return;
    // Fire and forget — errors are logged internally; caller does not await
    this._doTransition(next).catch((error) => {
      console.warn("[GSM] Queued transition failed:", error);
    });
  }

  /**
   * Dispose the GSM — marks as disposed, clears all queues and history,
   * and prevents any further transitions, events, or tick processing.
   *
   * After dispose:
   * - `transition()` is a no-op (returns silently, no error)
   * - `tick()` is a no-op
   * - `init()` is a no-op
   * - No further events are emitted on the Event Bus
   * - `getCurrentState()` returns `undefined`
   *
   * If called mid-transition (`_busy` is true), the current transition is
   * aborted: onExit of the current state runs (fire-and-forget), but onEnter
   * of the target state does NOT run and no events are emitted.
   *
   * Once disposed, the GSM is not reusable — create a new instance instead.
   * Calling `init()` after `dispose()` is a no-op.
   *
   * @see TR-GSM-008 — Dispose during mid-transition aborts
   */
  dispose(): void {
    // If mid-transition, initiate onExit of the current state fire-and-forget.
    // The transition code's guard (_disposed check after onExit) will prevent
    // onEnter from running, and the guard after onEnter will prevent state
    // change and event emission.
    if (this._busy && this._currentState !== undefined) {
      const sourceDef = this._stateDefinitions.get(this._currentState);
      if (sourceDef?.onExit) {
        try {
          const result = sourceDef.onExit();
          if (result instanceof Promise) {
            // Fire-and-forget: suppress floating promise rejection
            result.catch(() => {
              /* dispose: ignoring onExit rejection */
            });
          }
        } catch {
          // Ignore sync errors during dispose — we are shutting down
        }
      }
    }

    this._disposed = true;
    this._queue.length = 0;
    this._history.length = 0;
    this._currentState = undefined;
    // Prevent further Event Bus emissions
    this._eventBus = null;
  }

  /**
   * Get the recorded state transition history for debug tooling.
   *
   * Returns a shallow copy of the internal ring buffer. Mutations to the
   * returned array do not affect internal state.
   *
   * @returns An ordered read-only array of TransitionRecord entries (newest last)
   *
   * @example
   * ```typescript
   * const history = gsm.getHistory();
   * // history[0] => { from: 'Loading', to: 'Menu', timestamp: ..., durationInPreviousState: ... }
   * ```
   */
  getHistory(): ReadonlyArray<TransitionRecord> {
    return [...this._history];
  }

  /**
   * Add a target state to the transition queue.
   *
   * If the queue is at capacity (`maxQueueSize`), the oldest entry is
   * dropped (FIFO) and a warning is logged.
   */
  private _enqueue(target: State): void {
    if (this._queue.length >= this._maxQueueSize) {
      const dropped = this._queue.shift();
      console.warn("[GSM] Transition queue overflow — dropping:", dropped);
    }
    this._queue.push(target);
  }

  /**
   * Execute a queued transition: validate against the **current** state
   * and run lifecycle hooks. Does NOT check `_busy` — that is the caller's
   * responsibility (checked by `tick()` and `transition()`).
   *
   * Same-state transitions are silent no-ops.
   */
  private async _doTransition(target: State): Promise<void> {
    // Same-state at execution time: no-op
    if (target === this._currentState) {
      return;
    }

    const allowed = TRANSITIONS[this._currentState as State];
    if (!allowed?.includes(target)) {
      throw new GameStateError(this._currentState as State, target);
    }

    const sourceDef = this._stateDefinitions.get(this._currentState as State);
    const targetDef = this._stateDefinitions.get(target);
    const previousState = this._currentState as State;

    this._busy = true;

    try {
      // Call source onExit — errors propagate to caller
      if (sourceDef?.onExit) {
        await sourceDef.onExit();
      }

      // Guard: disposed during onExit — skip onEnter, skip events
      if (this._disposed) {
        return;
      }

      // Call target onEnter — errors trigger rollback
      try {
        if (targetDef?.onEnter) {
          await targetDef.onEnter();
        }

        // Guard: disposed during onEnter — skip state change, skip events
        if (this._disposed) {
          return;
        }

        // Transition complete — update state
        this._currentState = target;

        // Record successful transition in ring buffer (debug tooling)
        this._recordTransition(previousState, target);

        // Emit Event Bus events (exited before entered, both resilient to failure)
        this._warnIfEbMissing();
        this._emitExited(previousState);
        this._emitEntered(previousState, target);
      } catch (error) {
        // Guard: disposed — no rollback events
        if (this._disposed) {
          return;
        }
        // Rollback: stay in previous state
        console.warn("[GSM] onEnter failed for", target, error);
        // Re-emit gsm.state.entered for previous state (restored)
        this._warnIfEbMissing();
        this._emitEntered(previousState, previousState);
      }
    } finally {
      this._busy = false;
    }
  }

  /**
   * Record a successful state transition in the ring buffer.
   *
   * Called after `onEnter` resolves and the state has been updated.
   * NOT called for same-state no-ops or rollbacks.
   *
   * Duration is computed as the difference from the last recorded timestamp
   * (or `_initTimestamp` for the first transition). FIFO eviction occurs when
   * the buffer exceeds `_maxHistorySize`.
   */
  private _recordTransition(from: State, to: State): void {
    const now = Date.now();
    const previousEntry = this._history[this._history.length - 1];
    const durationInPreviousState = previousEntry
      ? now - previousEntry.timestamp
      : now - this._initTimestamp;

    const record: TransitionRecord = {
      from,
      to,
      timestamp: now,
      durationInPreviousState,
    };

    if (this._history.length >= GameStateMachine._maxHistorySize) {
      this._history.shift();
    }
    this._history.push(record);
  }

  /**
   * Log a one-time warning if the Event Bus is not available.
   * Suppresses duplicate warnings across multiple transitions.
   */
  private _warnIfEbMissing(): void {
    if (!this._eventBus && !this._warnedEbMissing) {
      this._warnedEbMissing = true;
      console.warn("[GSM] Event Bus unavailable — events will not be emitted");
    }
  }

  /**
   * Emit `gsm.state.exited` for the given previous state.
   * Errors are caught and logged — they never abort the transition.
   */
  private _emitExited(from: State): void {
    try {
      this._eventBus?.emit(GSM_STATE_EXITED, { from });
    } catch (error) {
      console.warn("[GSM] Event Bus emit failed:", error);
    }
  }

  /**
   * Emit `gsm.state.entered` for the given transition.
   * Errors are caught and logged — they never abort the transition.
   */
  private _emitEntered(from: State, to: State): void {
    try {
      this._eventBus?.emit(GSM_STATE_ENTERED, { from, to });
    } catch (error) {
      console.warn("[GSM] Event Bus emit failed:", error);
    }
  }
}
