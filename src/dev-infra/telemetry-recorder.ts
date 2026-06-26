/**
 * @fileoverview Dev-only telemetry data model and storage for Overdrive.
 *
 * Defines the {@link TelemetrySample} interface and {@link TelemetryRecorder}
 * class that accumulates per-car simulation data during a race.
 *
 * ## Dev Guard
 *
 * This file is intended to be dynamically imported only behind
 * `import.meta.env.DEV`. Production code must never statically import
 * from this module (see Dev Infra Layer Rule D-F4). Vite tree-shakes
 * the entire module in production builds because no production code
 * references it via static import.
 *
 * @example
 * ```typescript
 * // Correct instantiation pattern (in production code):
 * let recorder: TelemetryRecorder | null = null;
 * if (import.meta.env.DEV) {
 *   const { TelemetryRecorder } = await import('./dev-infra/telemetry-recorder');
 *   recorder = new TelemetryRecorder();
 * }
 * ```
 */

// ---------------------------------------------------------------------------
// TelemetrySample
// ---------------------------------------------------------------------------

/**
 * A single telemetry data sample for one car at one point in time.
 *
 * All fields are flat scalars — no nested objects, no serialization step
 * needed. Values are direct reads from CarEntity subsystems (Physics, Fuel,
 * Tire, AI Driver, Race Management).
 *
 * | Field           | Unit / Range  | Source System             |
 * |-----------------|---------------|---------------------------|
 * | `tick`          | physics tick  | Pipeline tick count       |
 * | `t`             | seconds       | Race Management           |
 * | `speed`         | km/h          | Physics                   |
 * | `rpm`           | —             | Physics                   |
 * | `throttle`      | 0.0 – 1.0     | Input / AI                |
 * | `brake`         | 0.0 – 1.0     | Input / AI                |
 * | `steer`         | -1.0 – 1.0    | Input / AI                |
 * | `gear`          | -1, 1 – 6     | Physics                   |
 * | `lateralG`      | m/s²          | Physics                   |
 * | `fuel`          | 0.0 – 1.0     | Fuel                      |
 * | `tireCondition` | 0.0 – 1.0     | Tire Wear                 |
 * | `splinePos`     | 0.0 – 1.0     | Race Management           |
 * | `aiState`       | -1, 0, 1, 2   | AI Driver (or -1 player)  |
 */
export interface TelemetrySample {
  /** Physics tick when the sample was captured. */
  readonly tick: number;

  /** Elapsed race time in seconds. */
  readonly t: number;

  /** Speed in km/h. */
  readonly speed: number;

  /** Engine RPM. */
  readonly rpm: number;

  /** Throttle position. 0.0 = none, 1.0 = full. */
  readonly throttle: number;

  /** Brake application. 0.0 = none, 1.0 = full. */
  readonly brake: number;

  /** Steering input. -1.0 = full right, 1.0 = full left. */
  readonly steer: number;

  /** Current gear. -1 = reverse, 1–6 = forward gears. */
  readonly gear: number;

  /** Lateral acceleration in m/s². */
  readonly lateralG: number;

  /** Fuel level as fraction of capacity. 0.0 = empty, 1.0 = full. */
  readonly fuel: number;

  /** Tire condition. 0.0 = worn out, 1.0 = pristine. */
  readonly tireCondition: number;

  /** Position along the track spline. 0.0–1.0 representing start to finish. */
  readonly splinePos: number;

  /**
   * AI driver state identifier.
   * - `-1` — player car (no AI driver)
   * - `0` — Normal (AI following racing line)
   * - `1` — Following (AI tailing another car)
   * - `2` — Passing (AI executing overtake)
   */
  readonly aiState: number;
}

// ---------------------------------------------------------------------------
// TelemetryRecorder
// ---------------------------------------------------------------------------

/**
 * Dev-only recorder that accumulates {@link TelemetrySample} arrays per car.
 *
 * Maintains a `Map<string, TelemetrySample[]>` where each car ID maps to a
 * plain array of samples. Arrays are created lazily — the first sample for
 * a car creates its array. The recorder is fully read-only with respect to
 * game state (Dev Infra Rule D-F2): it never writes to any system.
 *
 * **Instances must only be created behind `import.meta.env.DEV`** (see file-level
 * doc comment for the correct dynamic-import pattern).
 *
 * @example
 * ```typescript
 * const recorder = new TelemetryRecorder();
 * recorder.addSample("car_01", { tick: 0, t: 0, speed: 0, <other fields...> });
 * recorder.addSample("car_01", { tick: 3, t: 0.05, speed: 12, <other fields...> });
 * console.log(recorder.getCarIds()); // ["car_01"]
 * console.log(recorder.getSamples("car_01").length); // 2
 * recorder.clear(); // all counters + arrays reset
 * ```
 */
export class TelemetryRecorder {
  /** Per-car sample arrays. Keyed by stable car ID. */
  private _samples: Map<string, TelemetrySample[]> = new Map();

  /** Total ticks processed (incremented by `tick()` in Story 002). */
  private _tickCounter = 0;

  /** Total console-log outputs emitted (incremented by Story 003). */
  private _logCounter = 0;

  /**
   * Appends a telemetry sample for the given car.
   *
   * Creates a new array for the car if none exists yet (lazy key creation).
   *
   * @param carId - Stable car identifier (matches CarEntity `id`).
   * @param sample - The sample to record.
   */
  addSample(carId: string, sample: TelemetrySample): void {
    const arr = this._samples.get(carId);
    if (arr) {
      arr.push(sample);
    } else {
      this._samples.set(carId, [sample]);
    }
  }

  /**
   * Resets all per-car sample arrays, tick counter, and log counter.
   *
   * Idempotent — calling on already-empty state produces no error and no
   * memory leak. Intended to be called when `race.started` fires (Story 005).
   */
  clear(): void {
    this._samples.clear();
    this._tickCounter = 0;
    this._logCounter = 0;
  }

  /**
   * Returns a read-only view of samples for the given car.
   *
   * @param carId - Stable car identifier.
   * @returns An immutable reference to the car's sample array, or an empty
   *          array if the car has no recorded samples.
   */
  getSamples(carId: string): readonly TelemetrySample[] {
    return this._samples.get(carId) ?? [];
  }

  /**
   * Returns the list of all car IDs that have at least one recorded sample.
   *
   * @returns A new array of car ID strings. Order is insertion order.
   */
  getCarIds(): string[] {
    return Array.from(this._samples.keys());
  }

  /**
   * Returns the total number of sample ticks processed.
   *
   * Incremented by `tick()` (Story 002) on every pipeline call.
   */
  getTickCount(): number {
    return this._tickCounter;
  }

  /**
   * Returns the total number of console summary lines emitted.
   *
   * Incremented by `printConsoleSummary()` (Story 003).
   */
  getLogCount(): number {
    return this._logCounter;
  }
}
