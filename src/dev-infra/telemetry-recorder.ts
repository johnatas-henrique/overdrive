/**
 * @fileoverview Dev-only telemetry data model and storage for Overdrive.
 *
 * Defines the {@link TelemetrySample} interface and {@link TelemetryRecorder}
 * class that accumulates per-car simulation data during a race, with JSON
 * export via `window.__telemetry.export()`.
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
 *
 * ```typescript
 * // Export usage (dev-only, via Dev Tools minimise keybind — default: 2):
 * const json = window.__telemetry?.export();
 * if (json) {
 *   console.log(json);
 * }
 * ```
 */

// ---------------------------------------------------------------------------
// Global type augmentation for window.__telemetry
// ---------------------------------------------------------------------------

/**
 * Telemetry export surface exposed on `window.__telemetry` in dev builds.
 */
export interface TelemetryExport {
  /** Returns a JSON string of all recorded telemetry data, or `null` in production. */
  export: () => string | null;
}

declare global {
  interface Window {
    __telemetry?: TelemetryExport;
  }
}

import type { IEventBus, Subscription } from "@/foundation/event-bus/types";

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
// CarEntityRef
// ---------------------------------------------------------------------------

/**
 * Minimal CarEntity reference for telemetry reads.
 *
 * Only exposes the fields that the Telemetry Recorder needs — physics state,
 * runtime state, and optional AI driver state. The full CarEntity definition
 * lives in ADR-0005 (Entity/Car Lifecycle) and its implementing ADRs.
 *
 * All fields are readonly: the Telemetry Recorder is a read-only observer
 * (Dev Infra Rule D-F2) that never writes to any system.
 */
export interface CarEntityRef {
  /** Stable car identifier. */
  readonly id: string;

  /** Display name for console log output (e.g. "Macklen", "Willard"). */
  readonly teamName: string;

  /** Physics subsystem state (speed, rpm, gear, lateral G). */
  readonly physics: {
    readonly speedKmh: number;
    readonly rpm: number;
    readonly gear: number;
    readonly lateralG: number;
  };

  /** Runtime state (throttle, brake, steer, fuel, tires, spline position). */
  readonly runtime: {
    readonly elapsedTime: number;
    readonly throttle: number;
    readonly brake: number;
    readonly steer: number;
    readonly fuelLevel: number;
    readonly tireCondition: number;
    readonly splinePos: number;

    /** Race position (1-based, 1 = first place). */
    readonly racePosition: number;

    /** Current lap number (1-based, 1 = lap 1). */
    readonly currentLap: number;
  };

  /** Optional AI driver subsystem. `undefined` for player cars. */
  readonly aiDriver?: {
    readonly state: number;
  };
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

  /**
   * Total `tick()` calls processed — used by Story 003 for console log interval.
   * Increments on every pipeline call, not just sample ticks.
   */
  private _tickCounter = 0;

  /** Total console-log outputs emitted (incremented by Story 003). */
  private _logCounter = 0;

  /** Active Event Bus subscription refs for clean unsubscribe on re-init (T-001). */
  private _subscriptions: Subscription[] = [];

  /** Sampling interval in ticks. Every Nth tick produces a sample. */
  private _sampleInterval: number;

  /** Log interval in ticks. Every Nth tick prints a console summary (default 300 = 5s at 60Hz). */
  private _logInterval: number;

  /** Whether recording is active — gates console log output (set by Story 005). */
  private _isRecording = false;

  /** Total race laps for the summary display (set by Story 005). */
  private _totalLaps = 0;

  /** Track name for export metadata (set by Story 005 from race config). Defaults to "unknown". */
  private _track = "unknown";

  /** Race start timestamp in ms for export metadata (set by Story 005). Defaults to 0. */
  private _startTime = 0;

  /**
   * Per-car team names keyed by car ID.
   * Updated on every {@link tick} call from {@link CarEntityRef.teamName}.
   * Used by {@link export} to populate the `team` field in JSON output.
   */
  private _teamNames: Map<string, string> = new Map();

  /**
   * Connect the recorder to an Event Bus and subscribe to race lifecycle events.
   *
   * Subscribes to:
   * - `race.started` — clears previous data, enables recording, captures start
   *   time, track, and total laps from the payload.
   * - `gsm.state.entered` — disables recording when the GSM enters `"PostRace"`.
   *
   * Stores subscription refs and unsubscribes them individually on re-init
   * (T-001 — previously used `off(event)` which removed ALL subscribers
   * for that event, not just our own).
   *
   * @param eventBus - An initialised {@link IEventBus} instance.
   *
   * @example
   * ```typescript
   * const bus = new EventBus();
   * bus.init();
   * const recorder = new TelemetryRecorder();
   * recorder.init(bus);
   * ```
   */
  init(eventBus: IEventBus): void {
    // Unsubscribe previous subscriptions first (safe: off(subscription)
    // only removes our own handler, not all handlers for the event).
    for (const sub of this._subscriptions) {
      eventBus.off(sub);
    }
    this._subscriptions = [];

    this._subscriptions.push(
      eventBus.on("race.started", (payload) => {
        this.clear();
        this.setRecording(true);
        this.setStartTime(Date.now());
        this.setTrack(payload.track);
        this.setTotalLaps(payload.totalLaps);
      })
    );

    this._subscriptions.push(
      eventBus.on("gsm.state.entered", (payload) => {
        if (payload.to === "PostRace") {
          this.setRecording(false);
        }
      })
    );
  }

  /**
   * Creates a new TelemetryRecorder with the given intervals.
   *
   * @param sampleInterval - Ticks between samples (default 3 = 20Hz at 60Hz).
   *                         Range 1–10 per GDD tuning knobs specification.
   * @param logInterval - Ticks between console summary logs (default 300 = 5s at 60Hz).
   *                      Range 60–600 per GDD tuning knobs specification.
   */
  constructor(sampleInterval: number = 3, logInterval: number = 300) {
    // Validate parameters (T-002 — constructor validation).
    if (sampleInterval <= 0) {
      throw new RangeError(
        `TelemetryRecorder: sampleInterval must be > 0, got ${sampleInterval}`
      );
    }
    if (logInterval <= 0) {
      throw new RangeError(
        `TelemetryRecorder: logInterval must be > 0, got ${logInterval}`
      );
    }

    this._sampleInterval = sampleInterval;
    this._logInterval = logInterval;

    // Expose the export function on window.__telemetry in dev builds only.
    // The Dev Tools epic binds the minimise keypress to this surface.
    if (import.meta.env.DEV && typeof window !== "undefined") {
      window.__telemetry = {
        export: () => this.export(),
      };
    }
  }

  /**
   * Called every pipeline tick. Reads {@link CarEntityRef} state and appends
   * samples at the configured sampling interval.
   *
   * Guards against execution in production builds via `import.meta.env.DEV`
   * (see file-level doc comment). In production (`import.meta.env.DEV === false`),
   * this method is a no-op — and Vite tree-shakes the entire method body
   * via the dev guard.
   *
   * The method is fully read-only with respect to game state (Dev Infra Rule
   * D-F2): it never writes to any CarEntity field or system. It only reads
   * from CarEntity physics/runtime fields and appends to internal arrays.
   *
   * No Event Bus events are emitted (Dev Infra Rule D-F3).
   *
   * @param _dt - Frame delta time in seconds (unused, kept for pipeline slot
   *             signature compatibility).
   * @param cars - Array of {@link CarEntityRef} objects to sample from.
   * @param tickCount - Current physics pipeline tick count.
   */
  tick(_dt: number, cars: CarEntityRef[], tickCount: number): void {
    if (!import.meta.env.DEV) return;

    this._tickCounter++;

    // Console summary at configured log interval — print every Nth tick.
    // Default 300 → logs on calls 300, 600, 900, ... at 60Hz (every 5s).
    if (this._tickCounter % this._logInterval === 0) {
      this.printConsoleSummary(cars);
    }

    // Sample at configured interval — only capture on ticks divisible by the
    // interval. Default 3 → samples on ticks 0, 3, 6, 9, ... at 60Hz.
    if (tickCount % this._sampleInterval !== 0) return;

    for (const car of cars) {
      // Keep team names up-to-date for JSON export
      this._teamNames.set(car.id, car.teamName);

      this.addSample(car.id, {
        tick: tickCount,
        t: car.runtime.elapsedTime,
        speed: car.physics.speedKmh,
        rpm: car.physics.rpm,
        throttle: car.runtime.throttle,
        brake: car.runtime.brake,
        steer: car.runtime.steer,
        gear: car.physics.gear,
        lateralG: car.physics.lateralG,
        fuel: car.runtime.fuelLevel,
        tireCondition: car.runtime.tireCondition,
        splinePos: car.runtime.splinePos,
        aiState: car.aiDriver?.state ?? -1,
      });
    }
  }

  /**
   * Appends a telemetry sample for the given car.
   *
   * Creates a new array for the car if none exists yet (lazy key creation).
   * The caller retains ownership — mutations to the sample object after
   * addSample() will be reflected in future exports. The export() method
   * deep-copies at call-time, not at add-time.
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
    this._teamNames.clear();
    this._tickCounter = 0;
    this._logCounter = 0;
    this._isRecording = false;
    this._totalLaps = 0;
    this._track = "unknown";
    this._startTime = 0;
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

  /**
   * Enables or disables recording for the current race.
   *
   * Gates console summary output. Set by Story 005 via race lifecycle events.
   * When `false`, {@link printConsoleSummary} is a no-op regardless of tick
   * interval. Default is `false` after construction or {@link clear}.
   *
   * @param enabled - `true` to allow console summary output during a race.
   */
  setRecording(enabled: boolean): void {
    this._isRecording = enabled;
  }

  /**
   * Sets the total number of race laps for the summary display.
   *
   * Used by {@link printConsoleSummary} to format the `Lap X/Y` portion.
   * Set by Story 005 from the race configuration. Default is `0` after
   * construction or {@link clear} (produces `Lap X/0` if log fires before
   * the value is set, though in practice `setRecording(true)` won't happen
   * before this is configured).
   *
   * @param laps - Total race lap count. Values ≤ 0 are clamped to 1.
   */
  setTotalLaps(laps: number): void {
    this._totalLaps = Math.max(1, laps);
  }

  /**
   * Sets the track name for export metadata.
   *
   * Set by Story 005 from the race configuration.
   * Default is `"unknown"` after construction or {@link clear}.
   *
   * @param track - Track name (e.g. `"interlagos"`).
   */
  setTrack(track: string): void {
    this._track = track;
  }

  /**
   * Sets the race start timestamp for export metadata.
   *
   * Captured by Story 005 when `race.started` fires.
   * Default is `0` after construction or {@link clear}.
   *
   * @param ms - Epoch timestamp in milliseconds.
   */
  setStartTime(ms: number): void {
    this._startTime = ms;
  }

  /**
   * Exports all recorded telemetry data as a JSON string.
   *
   * Returns `null` when `import.meta.env.DEV` is `false` (production guard).
   * The returned JSON has `race` metadata and `cars` entries with per-car
   * sample arrays. Samples are deep-copied to provide a point-in-time
   * snapshot that subsequent recording does not mutate.
   *
   * Race metadata:
   * - `track` — set by {@link setTrack} (default `"unknown"`)
   * - `laps` — set by {@link setTotalLaps} (default `0`)
   * - `startTime` — set by {@link setStartTime} (default `0`)
   * - `duration` — computed as the maximum `t` (elapsedTime) across all samples
   *
   * Car entries are keyed by car ID, each containing:
   * - `team` — team name string from {@link CarEntityRef.teamName}
   * - `samples` — array of deep-copied {@link TelemetrySample} objects
   *
   * @returns A JSON string, or `null` in production builds.
   *
   * @example
   * ```typescript
   * const json = recorder.export();
   * if (json) {
   *   const data = JSON.parse(json);
   *   console.log(data.race.track); // "interlagos"
   *   console.log(Object.keys(data.cars).length); // number of cars
   * }
   * ```
   */
  export(): string | null {
    if (!import.meta.env.DEV) return null;

    // Compute duration as the maximum elapsedTime across all samples
    let duration = 0;
    for (const samples of this._samples.values()) {
      const last = samples.at(-1);
      if (last && last.t > duration) {
        duration = last.t;
      }
    }

    const cars: Record<string, { team: string; samples: TelemetrySample[] }> =
      {};
    for (const [carId, samples] of this._samples) {
      // Deep copy: spread each sample into a new object (all fields are
      // primitives, so a shallow spread is equivalent to a deep copy).
      cars[carId] = {
        team: this._teamNames.get(carId) ?? carId,
        samples: samples.map((s) => ({ ...s })),
      };
    }

    const data = {
      race: {
        track: this._track,
        laps: this._totalLaps,
        startTime: this._startTime,
        duration,
      },
      cars,
    };

    return JSON.stringify(data);
  }

  /**
   * Prints a one-line console summary of current race positions and speeds.
   *
   * Gated by {@link _isRecording} — no output when recording is inactive.
   * Silently skips when the cars array is empty (no crash, no output).
   *
   * Format:
   * ```
   * [TELE] Lap 3/5 | P1 Macklen 245 km/h | P2 Willard 241 km/h | ...
   * ```
   *
   * Cars are sorted by `racePosition` ascending (P1 = first place).
   * Speed values are rounded to the nearest integer km/h.
   *
   * Dev Infra compliance:
   * - D-F2 (read-only): never writes to game state.
   * - D-F3 (no Event Bus): pure console output, no events emitted.
   *
   * @param cars - Current set of cars to summarize. Sorted in-place copy;
   *               original array is not mutated.
   */
  private printConsoleSummary(cars: CarEntityRef[]): void {
    if (!this._isRecording) return;
    if (cars.length === 0) return;

    // Sort a shallow copy by race position (ascending — P1 first).
    const sorted = [...cars].sort(
      (a, b) => a.runtime.racePosition - b.runtime.racePosition
    );

    const currentLap = sorted[0].runtime.currentLap;

    const parts = sorted.map(
      (car, i) =>
        `P${i + 1} ${car.teamName} ${Math.round(car.physics.speedKmh)} km/h`
    );

    console.log(
      `[TELE] Lap ${currentLap}/${this._totalLaps} | ${parts.join(" | ")}`
    );

    this._logCounter++;
  }
}
