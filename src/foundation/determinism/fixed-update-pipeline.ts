/**
 * Fixed-time step simulation pipeline.
 *
 * Manages 8 immutable pipeline slots executed in fixed order each tick:
 * Input → Physics → AI → Collision → Fuel → Tire → Race Management → Pit Stop.
 *
 * **State machine**:
 * ```
 * Uninitialized ──start()──▶ Ready ──stop()──▶ Stopped
 *     │                        │                 │
 *     └─────── dispose() ──────┴────── dispose() ─┘
 *                                     │
 *                                     ▼
 *                                  Disposed (terminal)
 * ```
 *
 * - `Uninitialized`: accepts `register()` calls.
 * - `Ready`: accepts `executeTick()` calls.
 * - `Stopped`: accepts `start()` to re-enter Ready (counter resets).
 * - `Disposed`: terminal — all operations throw `PipelineError`.
 *
 * @see ADR-0002 — Fixed Timestep & Determinism Pipeline
 * @see F12 — 8 fixed immutable pipeline slots
 * @see F13 — Fixed timestep at 1/60s
 * @see F-G2 — Pipeline: < 0.001ms overhead per tick
 */

import { PipelineError } from "./pipeline-error";

/**
 * Pipeline state machine states.
 * - `uninitialized`: accepting registrations
 * - `ready`: executing ticks
 * - `stopped`: paused, can restart via start()
 * - `disposed`: terminal
 */
type PipelineState = "uninitialized" | "ready" | "stopped" | "disposed";

/**
 * Internal slot entry holding a registered system's identity and update function.
 */
interface SlotEntry {
  readonly systemId: string;
  readonly update: (dt: number) => void;
}

/**
 * Fixed-time step simulation pipeline interface.
 *
 * Defines the contract for the 8 immutable pipeline slots that execute
 * in fixed order each tick: Input → Physics → AI → Collision → Fuel →
 * Tire → Race Management → Pit Stop.
 *
 * @see ADR-0002 — Fixed Timestep & Determinism Pipeline
 * @see F12 — 8 fixed immutable pipeline slots
 */
export interface IFixedUpdatePipeline {
  /**
   * Register a system at a specific slot index.
   *
   * @param systemId - Unique identifier for the system
   * @param update - Update function called every tick with delta time
   * @param slotIndex - Slot index (1–8), lower = earlier execution
   * @throws PipelineError if pipeline is not in Uninitialized state
   * @throws PipelineError if slotIndex is outside 1–8
   * @throws PipelineError if systemId is already registered in any slot
   * @throws PipelineError if the target slot is already occupied
   *
   * @example
   * ```typescript
   * pipeline.register('input', (dt) => { /* ... *\/ }, 1);
   * pipeline.register('physics', (dt) => { /* ... *\/ }, 2);
   * ```
   */
  register(
    systemId: string,
    update: (dt: number) => void,
    slotIndex: number
  ): void;

  /**
   * Start the pipeline.
   *
   * Transitions from `Uninitialized` or `Stopped` to `Ready`.
   * Resets the tick counter to 0.
   *
   * @throws PipelineError if not in `Uninitialized` or `Stopped` state
   *
   * @example
   * ```typescript
   * pipeline.start();
   * ```
   */
  start(): void;

  /**
   * Stop the pipeline.
   *
   * Transitions from `Ready` to `Stopped`. The pipeline can be restarted
   * via `start()`.
   *
   * Safe to call from any non-terminal state.
   *
   * @example
   * ```typescript
   * pipeline.stop();
   * ```
   */
  stop(): void;

  /**
   * Execute one simulation tick.
   *
   * Iterates slots 1–8 in ascending order, calling each registered update
   * function with the provided delta time. A throwing slot does not prevent
   * subsequent slots from executing.
   *
   * Increments the tick counter by 1 after all slots have been called.
   *
   * @param dt - Delta time for this tick (typically `FIXED_DT` = 1/60)
   * @throws PipelineError if pipeline is not in `Ready` state
   *
   * @example
   * ```typescript
   * pipeline.executeTick(1 / 60);
   * ```
   */
  executeTick(dt: number): void;

  /**
   * Get the current tick count since the last `start()` call.
   *
   * @returns Number of ticks executed since last `start()`
   *
   * @example
   * ```typescript
   * const tick = pipeline.getCurrentTick();
   * ```
   */
  getCurrentTick(): number;

  /**
   * Dispose the pipeline.
   *
   * Transitions to terminal `Disposed` state from any state.
   * Safe to call multiple times.
   *
   * @example
   * ```typescript
   * pipeline.dispose();
   * ```
   */
  dispose(): void;
}

/**
 * Fixed-time step simulation pipeline implementation.
 *
 * Allocates an array of 9 slot entries (index 0 unused, slots 1–8 valid).
 * Slot order is immutable after the pipeline leaves `Uninitialized` state.
 *
 * Memory: ~200 bytes (8 slot references + state + tick counter).
 * Overhead: < 0.001ms per tick (direct function calls, no allocations).
 */
export class FixedUpdatePipeline implements IFixedUpdatePipeline {
  /**
   * Internal slots array.
   * Index 0 is unused; slots at indices 1–8 hold registered systems.
   * Pre-allocated with null to avoid per-register allocation.
   */
  private readonly _slots: (SlotEntry | null)[] = new Array(9).fill(null);

  /** Current pipeline state. */
  private _state: PipelineState = "uninitialized";

  /** Number of ticks executed since the last `start()` call. */
  private _currentTick = 0;

  /**
   * @inheritdoc
   */
  register(
    systemId: string,
    update: (dt: number) => void,
    slotIndex: number
  ): void {
    if (this._state !== "uninitialized") {
      throw new PipelineError("Cannot register after pipeline has started");
    }
    if (!Number.isInteger(slotIndex) || slotIndex < 1 || slotIndex > 8) {
      throw new PipelineError(`Invalid slot index: ${slotIndex}`);
    }
    // Enforce unique systemId across all slots (AC-10)
    for (let i = 1; i <= 8; i++) {
      if (this._slots[i]?.systemId === systemId) {
        throw new PipelineError(`System already registered: ${systemId}`);
      }
    }
    if (this._slots[slotIndex] !== null) {
      throw new PipelineError(
        `Slot ${slotIndex} already occupied by: ${this._slots[slotIndex]?.systemId}`
      );
    }
    this._slots[slotIndex] = { systemId, update };
  }

  /**
   * @inheritdoc
   */
  start(): void {
    if (this._state !== "uninitialized" && this._state !== "stopped") {
      throw new PipelineError("Pipeline not started");
    }
    this._state = "ready";
    this._currentTick = 0;
  }

  /**
   * @inheritdoc
   */
  stop(): void {
    if (this._state === "ready" || this._state === "stopped") {
      this._state = "stopped";
    }
  }

  /**
   * @inheritdoc
   */
  executeTick(dt: number): void {
    if (this._state === "disposed") {
      throw new PipelineError("Pipeline is disposed");
    }
    if (this._state !== "ready") {
      throw new PipelineError("Pipeline not started");
    }
    for (let i = 1; i <= 8; i++) {
      const slot = this._slots[i];
      if (slot !== null) {
        try {
          slot.update(dt);
        } catch {
          // Slot threw — continue to subsequent slots per AC-6.
          // Each slot is isolated; a failure in one does not
          // prevent others from executing.
        }
      }
    }
    this._currentTick++;
  }

  /**
   * @inheritdoc
   */
  getCurrentTick(): number {
    return this._currentTick;
  }

  /**
   * @inheritdoc
   */
  dispose(): void {
    this._state = "disposed";
  }
}
