/**
 * PipelineRuntime — the Babylon.js integration layer for the fixed timestep pipeline.
 *
 * Bridges the Babylon.js render loop (``engine.runRenderLoop``) with the
 * deterministic FixedUpdatePipeline. Manages accumulator state, render-loop
 * lifecycle, Havok auto-step suppression, and NO-OP placeholder slots for
 * future epic systems (2–8).
 *
 * **This is the ONLY file in the Determinism module that imports Babylon.js.**
 *
 * @see ADR-0002 — Fixed Timestep & Determinism Pipeline
 * @see F11 — Pipeline in ``engine.runRenderLoop()`` — NOT in ``scene.onBeforeRenderObservable``
 * @see F17 — Havok: ``scene.enablePhysics()`` IS called; auto-step suppressed via
 *   ``(scene as any)._advancePhysicsEngineStep = () => {}``
 */

import type { Engine } from "@babylonjs/core/Engines/engine";
import type { Scene } from "@babylonjs/core/scene";

import { accumulate, FIXED_DT } from "./accumulator";
import type { IFixedUpdatePipeline } from "./fixed-update-pipeline";
import { FixedUpdatePipeline } from "./fixed-update-pipeline";

/**
 * Pipeline runtime interface.
 *
 * Integrates the deterministic FixedUpdatePipeline with Babylon.js's render loop.
 * Call {@link attach} to start the loop, {@link detach} to stop it.
 */
export interface IPipelineRuntime {
  /**
   * Attach the pipeline to the engine's render loop.
   *
   * Installs a fixed-tick callback into ``engine.runRenderLoop()`` that processes
   * the accumulator, executes pipeline ticks, and renders the active scene.
   * Calling this when already attached is a no-op.
   *
   * @param engine - Babylon.js Engine instance
   * @param activeScene - Getter returning the current active Scene to render
   *
   * @example
   * ```typescript
   * const runtime = new PipelineRuntime();
   * runtime.attach(engine, () => raceScene);
   * ```
   */
  attach(engine: Engine, activeScene: () => Scene): void;

  /**
   * Detach the pipeline from the engine's render loop.
   *
   * Calls ``engine.stopRenderLoop()`` with the previously installed callback.
   * Safe to call when not attached (no-op).
   *
   * @example
   * ```typescript
   * runtime.detach();
   * ```
   */
  detach(): void;

  /**
   * Suppress Havok's internal auto-step for a scene.
   *
   * After ``scene.enablePhysics()``, Babylon.js registers an internal step
   * function on ``scene._advancePhysicsEngineStep`` that would double-step
   * Havok if left active. This function replaces it with a no-op so the
   * pipeline's physics slot (#2) exclusively controls stepping.
   *
   * **Does NOT belong in attach()** — the Physics epic calls this once after
   * calling ``scene.enablePhysics()``.
   *
   * @param scene - The Babylon.js Scene whose auto-step to suppress
   *
   * @example
   * ```typescript
   * runtime.suppressHavokAutoStep(raceScene);
   * ```
   */
  suppressHavokAutoStep(scene: Scene): void;
}

/**
 * Default system names for NO-OP placeholder slots 2–8.
 * Slot 1 is reserved for Input (registered by the Input epic).
 */
const PLACEHOLDER_SLOTS: Array<{ name: string; slot: number }> = [
  { name: "physics", slot: 2 },
  { name: "ai", slot: 3 },
  { name: "collision", slot: 4 },
  { name: "fuel", slot: 5 },
  { name: "tire", slot: 6 },
  { name: "raceManagement", slot: 7 },
  { name: "pitStop", slot: 8 },
];

/**
 * PipelineRuntime — integrates the fixed timestep pipeline with Babylon.js.
 *
 * Owns a FixedUpdatePipeline instance, manages accumulator state, and
 * orchestrates the render-loop lifecycle.
 *
 * **State machine**:
 * ```
 * ┌─ attached ── detach() ──▶ detached
 * │     ▲
 * └───── attach()
 * ```
 *
 * Default slot layout after construction:
 * | Slot | System         | Note                  |
 * | ---- | -------------- | --------------------- |
 * | 1    | Input          | Reserved (empty)      |
 * | 2    | Physics        | NO-OP placeholder     |
 * | 3    | AI Driver      | NO-OP placeholder     |
 * | 4    | Collision      | NO-OP placeholder     |
 * | 5    | Fuel           | NO-OP placeholder     |
 * | 6    | Tire Wear      | NO-OP placeholder     |
 * | 7    | Race Management| NO-OP placeholder     |
 * | 8    | Pit Stop       | NO-OP placeholder     |
 *
 * @see ADR-0002 — Fixed Timestep & Determinism Pipeline
 * @see F12 — 8 fixed immutable pipeline slots
 */
export class PipelineRuntime implements IPipelineRuntime {
  /** The underlying FixedUpdatePipeline instance. */
  private readonly _pipeline: IFixedUpdatePipeline;

  /** Whether the pipeline is currently attached to an engine's render loop. */
  private _attached = false;

  /**
   * Accumulated time (in seconds) from past frames.
   * Updated each render-loop invocation, consumed by the fixed timestep
   * accumulator to determine how many simulation ticks to execute.
   */
  private _accumulator = 0;

  /** The Babylon.js Engine we're attached to (null when detached). */
  private _engine: Engine | null = null;

  /**
   * The bound render-loop callback.
   * Stored so it can be passed to both ``runRenderLoop`` and ``stopRenderLoop``
   * with the exact same function reference.
   */
  private _loopCallback: (() => void) | null = null;

  /**
   * Create a new PipelineRuntime.
   *
   * Instantiates a FixedUpdatePipeline, registers NO-OP placeholders for
   * slots 2–8 (slot 1 is reserved for Input), and transitions the pipeline
   * to the Ready state.
   *
   * @example
   * ```typescript
   * const runtime = new PipelineRuntime();
   * runtime.attach(engine, () => raceScene);
   * ```
   */
  constructor() {
    this._pipeline = new FixedUpdatePipeline();
    this._registerPlaceholders();
  }

  /**
   * Expose the internal pipeline for read-only access.
   *
   * Used by Core epics to register their system update functions into
   * the appropriate pipeline slots (e.g. Input → slot 1, Physics → slot 2).
   *
   * @example
   * ```typescript
   * runtime.pipeline.register('input', input.update, 1);
   * ```
   */
  get pipeline(): IFixedUpdatePipeline {
    return this._pipeline;
  }

  /**
   * @inheritdoc
   */
  attach(engine: Engine, activeScene: () => Scene): void {
    if (this._attached) {
      return; // no-op — already attached
    }

    this._attached = true;
    this._engine = engine;
    this._accumulator = 0;

    // Start the pipeline — transitions to Ready and installs the
    // dev-mode determinism guard (Math.random, Date.now, performance.now
    // are replaced with throwing wrappers in dev builds).
    this._pipeline.start();

    // Capture as locals — guaranteed non-null for the lifetime of this callback
    const getDeltaTime = () => engine.getDeltaTime();
    const render = () => activeScene().render();

    this._loopCallback = () => {
      // 1. Accumulate frame delta (getDeltaTime() returns ms, convert to seconds)
      const result = accumulate(this._accumulator, getDeltaTime() / 1000);
      this._accumulator = result.newAccumulator;

      // 2. Execute the required number of fixed-time step ticks
      for (let i = 0; i < result.ticks; i++) {
        this._pipeline.executeTick(FIXED_DT);
      }

      // 3. Render the active scene once per frame
      render();
    };

    engine.runRenderLoop(this._loopCallback);
  }

  /**
   * @inheritdoc
   */
  detach(): void {
    if (!this._attached || !this._engine || !this._loopCallback) {
      return; // no-op — not attached
    }

    this._engine.stopRenderLoop(this._loopCallback);
    this._pipeline.stop();
    this._attached = false;
  }

  /**
   * @inheritdoc
   */
  suppressHavokAutoStep(scene: Scene): void {
    (
      scene as unknown as { _advancePhysicsEngineStep: () => void }
    )._advancePhysicsEngineStep = () => {
      /* no-op — pipeline controls stepping exclusively */
    };
  }

  /**
   * Register NO-OP placeholder functions for slots 2–8.
   *
   * Each placeholder logs a dev-mode warning when ticked, indicating the slot
   * has not yet been claimed by its owning epic system.
   *
   * Slot 1 (Input) is deliberately left empty — the Input epic registers
   * there during its init.
   *
   * Must be called before the pipeline is started.
   */
  private _registerPlaceholders(): void {
    for (const { name, slot } of PLACEHOLDER_SLOTS) {
      let warned = false;
      this._pipeline.register(
        name,
        () => {
          if (!warned) {
            console.warn(
              `[Pipeline] Slot ${slot} (${name}) — no system registered yet`
            );
            warned = true;
          }
        },
        slot
      );
    }
  }
}
