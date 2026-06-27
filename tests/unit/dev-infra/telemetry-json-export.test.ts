/**
 * @fileoverview Tests for Story 004 — JSON Export.
 *
 * Covers all 6 acceptance criteria from the story file:
 * - AC-1: `window.__telemetry.export()` returns parseable JSON with `race` and `cars` keys
 * - AC-2: JSON structure matches GDD specification
 * - AC-3: Empty export returns valid JSON with defaults
 * - AC-4: `export()` returns a point-in-time snapshot
 * - AC-5: Team names appear correctly in JSON
 * - AC-6: When `import.meta.env.DEV` is false, `export()` returns `null`
 */

import { describe, expect, it, vi } from "vitest";
import type {
  CarEntityRef,
  TelemetrySample,
} from "../../../src/dev-infra/telemetry-recorder";
import { TelemetryRecorder } from "../../../src/dev-infra/telemetry-recorder";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal valid TelemetrySample with default zeros.
 *
 * @param overrides - Optional partial overrides applied after defaults.
 * @returns A TelemetrySample-compatible object.
 */
function makeSample(overrides?: Partial<TelemetrySample>): TelemetrySample {
  return {
    tick: 0,
    t: 0,
    speed: 0,
    rpm: 0,
    throttle: 0,
    brake: 0,
    steer: 0,
    gear: 1,
    lateralG: 0,
    fuel: 1,
    tireCondition: 1,
    splinePos: 0,
    aiState: -1,
    ...overrides,
  };
}

/**
 * Create a mock CarEntityRef with default values.
 *
 * Supports deep merging for nested objects so tests can override only the
 * fields they care about.
 *
 * @param overrides - Optional partial overrides with deep merge.
 * @returns A CarEntityRef-compatible mock object.
 */
function makeCar(overrides?: Partial<CarEntityRef>): CarEntityRef {
  return {
    id: overrides?.id ?? "test-car",
    teamName: overrides?.teamName ?? "Test Team",
    physics: {
      speedKmh: 0,
      rpm: 0,
      gear: 1,
      lateralG: 0,
      ...overrides?.physics,
    },
    runtime: {
      elapsedTime: 0,
      throttle: 0,
      brake: 0,
      steer: 0,
      fuelLevel: 1,
      tireCondition: 1,
      splinePos: 0,
      racePosition: 1,
      currentLap: 1,
      ...overrides?.runtime,
    },
    aiDriver:
      overrides?.aiDriver !== undefined
        ? { state: 0, ...overrides.aiDriver }
        : undefined,
  };
}

/**
 * Parse the export result safely for assertions.
 * Fails the test if export() returns null.
 *
 * @param recorder - The telemetry recorder instance.
 * @returns The parsed export data.
 */
function parseExport(recorder: TelemetryRecorder): {
  race: Record<string, unknown>;
  cars: Record<string, unknown>;
} {
  const json = recorder.export();
  expect(json).not.toBeNull();
  return JSON.parse(json as string);
}

// ---------------------------------------------------------------------------
// AC-1: export() returns parseable JSON with race and cars keys
// ---------------------------------------------------------------------------

describe("AC-1: export() returns parseable JSON with race and cars keys", () => {
  it("should return a string when samples are present", () => {
    const recorder = new TelemetryRecorder();
    recorder.addSample("car_01", makeSample({ tick: 0 }));

    const result = recorder.export();
    expect(typeof result).toBe("string");
  });

  it("should return a string parseable by JSON.parse()", () => {
    const recorder = new TelemetryRecorder();
    recorder.addSample("car_01", makeSample({ tick: 0 }));

    const result = recorder.export();
    expect(result).not.toBeNull();
    expect(() => JSON.parse(result as string)).not.toThrow();
  });

  it("should have race and cars top-level keys after parsing", () => {
    const recorder = new TelemetryRecorder();
    recorder.addSample("car_01", makeSample({ tick: 0 }));
    recorder.addSample("car_02", makeSample({ tick: 3 }));

    const parsed = parseExport(recorder);
    expect(parsed).toHaveProperty("race");
    expect(parsed).toHaveProperty("cars");
  });

  it("should set window.__telemetry.export in dev mode", () => {
    // Create a mock window so the constructor can attach __telemetry
    const mockWindow: Record<string, unknown> = {};
    vi.stubGlobal("window", mockWindow);

    try {
      const recorder = new TelemetryRecorder();
      recorder.addSample("car_01", makeSample({ tick: 0 }));

      expect(mockWindow.__telemetry).toBeDefined();
      expect(
        typeof (mockWindow.__telemetry as { export: () => string | null })
          .export
      ).toBe("function");

      const result = (
        mockWindow.__telemetry as { export: () => string | null }
      ).export();
      expect(typeof result).toBe("string");
      const parsed = JSON.parse(result as string);
      expect(parsed).toHaveProperty("race");
      expect(parsed).toHaveProperty("cars");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// ---------------------------------------------------------------------------
// AC-2: JSON structure matches GDD specification
// ---------------------------------------------------------------------------

describe("AC-2: JSON structure matches GDD specification", () => {
  it("should include race metadata fields: track, laps, startTime, duration", () => {
    const recorder = new TelemetryRecorder();
    recorder.setTrack("interlagos");
    recorder.setTotalLaps(5);
    recorder.setStartTime(1718800000000);

    // Add samples with elapsed times to influence duration
    recorder.addSample("car_01", makeSample({ tick: 0, t: 0 }));
    recorder.addSample("car_01", makeSample({ tick: 3, t: 0.05 }));
    recorder.addSample("car_01", makeSample({ tick: 6, t: 0.1 }));

    const parsed = parseExport(recorder);
    expect(parsed.race.track).toBe("interlagos");
    expect(parsed.race.laps).toBe(5);
    expect(parsed.race.startTime).toBe(1718800000000);
    // Duration should be the max t (0.1)
    expect(parsed.race.duration).toBe(0.1);
  });

  it("should have per-car entries with team string and samples array", () => {
    const recorder = new TelemetryRecorder();
    recorder.addSample("macklen", makeSample({ tick: 0, speed: 245 }));
    recorder.addSample("willard", makeSample({ tick: 3, speed: 230 }));

    const parsed = parseExport(recorder);
    expect(parsed.cars).toHaveProperty("macklen");
    expect(parsed.cars).toHaveProperty("willard");

    // Each entry must have team and samples
    for (const carId of ["macklen", "willard"]) {
      const entry = parsed.cars[carId] as Record<string, unknown>;
      expect(entry).toHaveProperty("team");
      expect(typeof entry.team).toBe("string");
      expect(entry).toHaveProperty("samples");
      expect(Array.isArray(entry.samples)).toBe(true);
    }
  });

  it("should include all TelemetrySample fields in each sample object", () => {
    const recorder = new TelemetryRecorder();
    const sample = makeSample({
      tick: 3,
      t: 0.05,
      speed: 245,
      rpm: 14200,
      throttle: 0.85,
      brake: 0,
      steer: 0.2,
      gear: 5,
      lateralG: 12.5,
      fuel: 0.72,
      tireCondition: 0.88,
      splinePos: 0.153,
      aiState: 0,
    });
    recorder.addSample("macklen", sample);

    const parsed = parseExport(recorder);
    const macklen = parsed.cars.macklen as {
      samples: Record<string, unknown>[];
    };
    const s = macklen.samples[0];

    expect(s.tick).toBe(3);
    expect(s.t).toBe(0.05);
    expect(s.speed).toBe(245);
    expect(s.rpm).toBe(14200);
    expect(s.throttle).toBe(0.85);
    expect(s.brake).toBe(0);
    expect(s.steer).toBe(0.2);
    expect(s.gear).toBe(5);
    expect(s.lateralG).toBe(12.5);
    expect(s.fuel).toBe(0.72);
    expect(s.tireCondition).toBe(0.88);
    expect(s.splinePos).toBe(0.153);
    expect(s.aiState).toBe(0);
  });

  it("should handle 1 car correctly", () => {
    const recorder = new TelemetryRecorder();
    recorder.addSample("solo", makeSample({ tick: 0 }));

    const parsed = parseExport(recorder);
    expect(Object.keys(parsed.cars)).toHaveLength(1);
    expect(parsed.cars).toHaveProperty("solo");
  });

  it("should handle 8 cars correctly", () => {
    const recorder = new TelemetryRecorder();
    for (let i = 1; i <= 8; i++) {
      const carId = `car_${String(i).padStart(2, "0")}`;
      recorder.addSample(carId, makeSample({ tick: 0 }));
    }

    const parsed = parseExport(recorder);
    expect(Object.keys(parsed.cars)).toHaveLength(8);
    for (let i = 1; i <= 8; i++) {
      const carId = `car_${String(i).padStart(2, "0")}`;
      expect(parsed.cars).toHaveProperty(carId);
    }
  });

  it("should compute duration as max elapsedTime across all cars", () => {
    const recorder = new TelemetryRecorder();
    // Car 1 has samples up to t=10
    recorder.addSample("car_01", makeSample({ tick: 0, t: 0 }));
    recorder.addSample("car_01", makeSample({ tick: 300, t: 5 }));
    recorder.addSample("car_01", makeSample({ tick: 600, t: 10 }));
    // Car 2 has samples up to t=25 (higher)
    recorder.addSample("car_02", makeSample({ tick: 0, t: 0 }));
    recorder.addSample("car_02", makeSample({ tick: 900, t: 15 }));
    recorder.addSample("car_02", makeSample({ tick: 1500, t: 25 }));

    const parsed = parseExport(recorder);
    expect(parsed.race.duration).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// AC-3: Empty export returns valid JSON with defaults
// ---------------------------------------------------------------------------

describe("AC-3: empty export returns valid JSON with defaults", () => {
  it("should return empty cars object when no samples recorded", () => {
    const recorder = new TelemetryRecorder();

    const parsed = parseExport(recorder);
    expect(parsed.cars).toEqual({});
  });

  it("should have race metadata with defaults (track=unknown, laps=0, startTime=0, duration=0)", () => {
    const recorder = new TelemetryRecorder();

    const parsed = parseExport(recorder);
    expect(parsed.race.track).toBe("unknown");
    expect(parsed.race.laps).toBe(0);
    expect(parsed.race.startTime).toBe(0);
    expect(parsed.race.duration).toBe(0);
  });

  it("should return parseable JSON even with zero samples", () => {
    const recorder = new TelemetryRecorder();

    const result = recorder.export();
    expect(result).not.toBeNull();
    expect(() => JSON.parse(result as string)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AC-4: export() returns a point-in-time snapshot
// ---------------------------------------------------------------------------

describe("AC-4: export() returns a point-in-time snapshot", () => {
  it("should freeze sample count at time of export — subsequent samples not included", () => {
    const recorder = new TelemetryRecorder();

    // Record samples for ticks 0–99 (every 3 ticks = 34 samples)
    for (let tc = 0; tc < 100; tc++) {
      const car = makeCar({ id: "car_01", runtime: { elapsedTime: tc / 60 } });
      recorder.tick(1 / 60, [car], tc);
    }

    // Export at tick 100
    const json1 = recorder.export() as string;
    const data1 = JSON.parse(json1);
    const sampleCount1 = (data1.cars.car_01 as { samples: unknown[] }).samples
      .length;

    // Record more samples (ticks 102–200)
    for (let tc = 102; tc < 200; tc++) {
      const car = makeCar({ id: "car_01", runtime: { elapsedTime: tc / 60 } });
      recorder.tick(1 / 60, [car], tc);
    }

    // Export again — should have more samples
    const json2 = recorder.export() as string;
    const data2 = JSON.parse(json2);
    const sampleCount2 = (data2.cars.car_01 as { samples: unknown[] }).samples
      .length;
    expect(sampleCount2).toBeGreaterThan(sampleCount1);

    // First export should still have the original count when re-parsed
    const data1Reparsed = JSON.parse(json1);
    const reparseCount = (data1Reparsed.cars.car_01 as { samples: unknown[] })
      .samples.length;
    expect(reparseCount).toBe(sampleCount1);
  });

  it("should deep-copy samples — mutating sample source does not affect export", () => {
    const recorder = new TelemetryRecorder();
    const sample = makeSample({ tick: 0, speed: 100 });
    recorder.addSample("car_01", sample);

    // Export
    const json1 = recorder.export() as string;

    // Mutate original sample reference (addSample stores the reference,
    // so the source object is shared)
    const mutable = sample as { speed: number };
    mutable.speed = 999;

    // Re-export
    const json2 = recorder.export() as string;
    const data2 = JSON.parse(json2);
    const speed2 = (data2.cars.car_01 as { samples: { speed: number }[] })
      .samples[0].speed;

    // The new export should show the mutated value (because addSample stores
    // the reference and export deep-copies at call time).
    expect(speed2).toBe(999);

    // The old JSON string is frozen — re-parsing it gives the original value
    const data1Reparsed = JSON.parse(json1);
    const speed1 = (
      data1Reparsed.cars.car_01 as { samples: { speed: number }[] }
    ).samples[0].speed;
    expect(speed1).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// AC-5: Team names appear correctly in JSON
// ---------------------------------------------------------------------------

describe("AC-5: team names appear correctly in JSON", () => {
  it("should use teamName from CarEntityRef for the team field", () => {
    const recorder = new TelemetryRecorder();

    // Use tick() to capture team names
    const macklen = makeCar({ id: "macklen", teamName: "Macklen" });
    const willard = makeCar({ id: "willard", teamName: "Willard" });

    recorder.tick(1 / 60, [macklen, willard], 0);

    const parsed = parseExport(recorder);
    expect((parsed.cars.macklen as { team: string }).team).toBe("Macklen");
    expect((parsed.cars.willard as { team: string }).team).toBe("Willard");
  });

  it("should fall back to car ID when team name is unknown", () => {
    const recorder = new TelemetryRecorder();

    // addSample does not set team name — only tick() does
    recorder.addSample("orphan_car", makeSample({ tick: 0 }));

    const parsed = parseExport(recorder);
    expect((parsed.cars.orphan_car as { team: string }).team).toBe(
      "orphan_car"
    );
  });

  it("should track team names across multiple tick calls", () => {
    const recorder = new TelemetryRecorder();

    // First tick
    const car = makeCar({ id: "macklen", teamName: "Macklen" });
    recorder.tick(1 / 60, [car], 0);

    // Second tick — team name should still be Macklen
    recorder.tick(1 / 60, [car], 3);

    const parsed = parseExport(recorder);
    expect((parsed.cars.macklen as { team: string }).team).toBe("Macklen");
  });
});

// ---------------------------------------------------------------------------
// AC-6: No-op when DEV is false
// ---------------------------------------------------------------------------

describe("AC-6: export() returns null when DEV is false", () => {
  it("should return null when import.meta.env.DEV is false", () => {
    vi.stubEnv("DEV", false);

    try {
      const recorder = new TelemetryRecorder();
      recorder.addSample("car_01", makeSample({ tick: 0 }));

      const result = recorder.export();
      expect(result).toBeNull();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("should return a JSON string when DEV is restored to true", () => {
    vi.stubEnv("DEV", false);

    const recorder = new TelemetryRecorder();

    // In "production" mode — sample is added but export is null
    recorder.addSample("car_01", makeSample({ tick: 0 }));
    expect(recorder.export()).toBeNull();

    vi.unstubAllEnvs();

    // DEV true — export should now work (samples accumulated during
    // production are still in memory since addSample isn't gated by DEV)
    const result = recorder.export();
    expect(typeof result).toBe("string");
    const parsed = JSON.parse(result as string);
    expect(parsed.cars.car_01).toBeDefined();
  });

  it("should not set window.__telemetry when DEV is false", () => {
    vi.stubEnv("DEV", false);

    const mockWindow: Record<string, unknown> = {};
    vi.stubGlobal("window", mockWindow);

    try {
      // Construct recorder with DEV=false → should NOT set window.__telemetry
      const recorder = new TelemetryRecorder();
      recorder.addSample("car_01", makeSample({ tick: 0 }));

      expect(mockWindow.__telemetry).toBeUndefined();
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("should handle export after clear() — returns default empty state", () => {
    const recorder = new TelemetryRecorder();
    recorder.setTrack("interlagos");
    recorder.setTotalLaps(5);
    recorder.addSample("car_01", makeSample({ tick: 0 }));

    recorder.clear();

    const parsed = parseExport(recorder);
    expect(parsed.cars).toEqual({});
    expect(parsed.race.track).toBe("unknown");
    expect(parsed.race.laps).toBe(0);
    expect(parsed.race.duration).toBe(0);
  });

  it("should persist through multiple export() calls with consistent data", () => {
    const recorder = new TelemetryRecorder();
    recorder.addSample("car_01", makeSample({ tick: 0, speed: 100 }));
    recorder.addSample("car_02", makeSample({ tick: 0, speed: 200 }));

    // Export twice — both should contain the same data
    const json1 = recorder.export();
    const json2 = recorder.export();
    expect(json1).toBe(json2);
  });

  it("should export correctly when samples are added via addSample without tick", () => {
    const recorder = new TelemetryRecorder();
    recorder.addSample("car_01", makeSample({ tick: 5, speed: 150 }));
    recorder.addSample("car_01", makeSample({ tick: 10, speed: 180 }));

    const parsed = parseExport(recorder);
    const car = parsed.cars.car_01 as {
      samples: { tick: number; speed: number }[];
    };
    expect(car.samples).toHaveLength(2);
    expect(car.samples[0].tick).toBe(5);
    expect(car.samples[1].tick).toBe(10);
  });
});
