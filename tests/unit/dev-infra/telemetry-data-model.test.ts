import { describe, expect, it } from "vitest";
import type { TelemetrySample } from "../../../src/dev-infra/telemetry-recorder";
import { TelemetryRecorder } from "../../../src/dev-infra/telemetry-recorder";

// ---------------------------------------------------------------------------
// Sample factory — avoids repetition across tests
// ---------------------------------------------------------------------------

/** Create a minimal valid TelemetrySample with default zeros. */
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

// ---------------------------------------------------------------------------
// AC-5: Initial state is empty
// ---------------------------------------------------------------------------

describe("initial state (AC-5)", () => {
  it("should have empty samples map on construction", () => {
    const recorder = new TelemetryRecorder();
    expect(recorder.getCarIds()).toEqual([]);
  });

  it("should have tickCounter === 0 on construction", () => {
    const recorder = new TelemetryRecorder();
    expect(recorder.getTickCount()).toBe(0);
  });

  it("should have logCounter === 0 on construction", () => {
    const recorder = new TelemetryRecorder();
    expect(recorder.getLogCount()).toBe(0);
  });

  it("should return empty array for unknown car on construction", () => {
    const recorder = new TelemetryRecorder();
    expect(recorder.getSamples("unknown")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC-1: TelemetrySample interface fields
// ---------------------------------------------------------------------------

describe("TelemetrySample interface (AC-1)", () => {
  it("should accept a sample with all 13 fields populated at max values", () => {
    const sample: TelemetrySample = {
      tick: 3600,
      t: 60.5,
      speed: 320,
      rpm: 18500,
      throttle: 1,
      brake: 1,
      steer: 1,
      gear: 6,
      lateralG: 18.3,
      fuel: 1,
      tireCondition: 1,
      splinePos: 0.857,
      aiState: 2,
    };

    expect(sample.tick).toBe(3600);
    expect(sample.t).toBe(60.5);
    expect(sample.speed).toBe(320);
    expect(sample.rpm).toBe(18500);
    expect(sample.throttle).toBe(1);
    expect(sample.brake).toBe(1);
    expect(sample.steer).toBe(1);
    expect(sample.gear).toBe(6);
    expect(sample.lateralG).toBe(18.3);
    expect(sample.fuel).toBe(1);
    expect(sample.tireCondition).toBe(1);
    expect(sample.splinePos).toBe(0.857);
    expect(sample.aiState).toBe(2);
  });

  it("should accept a sample at minimum / zero values", () => {
    const sample: TelemetrySample = {
      tick: 0,
      t: 0,
      speed: 0,
      rpm: 0,
      throttle: 0,
      brake: 0,
      steer: -1,
      gear: -1,
      lateralG: 0,
      fuel: 0,
      tireCondition: 0,
      splinePos: 0,
      aiState: -1,
    };

    expect(sample.tick).toBe(0);
    expect(sample.t).toBe(0);
    expect(sample.speed).toBe(0);
    expect(sample.rpm).toBe(0);
    expect(sample.throttle).toBe(0);
    expect(sample.brake).toBe(0);
    expect(sample.steer).toBe(-1);
    expect(sample.gear).toBe(-1);
    expect(sample.lateralG).toBe(0);
    expect(sample.fuel).toBe(0);
    expect(sample.tireCondition).toBe(0);
    expect(sample.splinePos).toBe(0);
    expect(sample.aiState).toBe(-1);
  });

  it("should accept all aiState values: -1 (player), 0, 1, 2 (AI)", () => {
    // Edge case: player
    const player: TelemetrySample = makeSample({ aiState: -1 });
    expect(player.aiState).toBe(-1);

    // Edge case: AI Normal
    const normal: TelemetrySample = makeSample({ aiState: 0 });
    expect(normal.aiState).toBe(0);

    // Edge case: AI Following
    const following: TelemetrySample = makeSample({ aiState: 1 });
    expect(following.aiState).toBe(1);

    // Edge case: AI Passing
    const passing: TelemetrySample = makeSample({ aiState: 2 });
    expect(passing.aiState).toBe(2);
  });

  it("should accept all gear values: -1 (reverse), 1–6", () => {
    const reverse: TelemetrySample = makeSample({ gear: -1 });
    expect(reverse.gear).toBe(-1);

    for (let g = 1; g <= 6; g++) {
      const sample: TelemetrySample = makeSample({ gear: g });
      expect(sample.gear).toBe(g);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-2: Map storage with lazy key creation
// ---------------------------------------------------------------------------

describe("addSample / lazy key creation (AC-2)", () => {
  it("should create a per-car array on first sample", () => {
    const recorder = new TelemetryRecorder();
    recorder.addSample("macklen", makeSample({ tick: 3 }));

    const carIds = recorder.getCarIds();
    expect(carIds).toEqual(["macklen"]);
    expect(recorder.getSamples("macklen").length).toBe(1);
  });

  it("should keep cars in separate arrays", () => {
    const recorder = new TelemetryRecorder();
    recorder.addSample("macklen", makeSample({ tick: 0 }));
    recorder.addSample("willard", makeSample({ tick: 3 }));

    expect(recorder.getCarIds()).toEqual(["macklen", "willard"]);
    expect(recorder.getSamples("macklen").length).toBe(1);
    expect(recorder.getSamples("willard").length).toBe(1);
  });

  it("should append multiple samples to the same car array", () => {
    const recorder = new TelemetryRecorder();
    recorder.addSample("macklen", makeSample({ tick: 0 }));
    recorder.addSample("macklen", makeSample({ tick: 3 }));
    recorder.addSample("macklen", makeSample({ tick: 6 }));

    const samples = recorder.getSamples("macklen");
    expect(samples).toHaveLength(3);
    expect(samples[0].tick).toBe(0);
    expect(samples[1].tick).toBe(3);
    expect(samples[2].tick).toBe(6);
  });

  it("should handle many cars (8-car grid)", () => {
    const recorder = new TelemetryRecorder();
    const cars = [
      "car_01",
      "car_02",
      "car_03",
      "car_04",
      "car_05",
      "car_06",
      "car_07",
      "car_08",
    ];

    for (const carId of cars) {
      recorder.addSample(carId, makeSample({ tick: 0 }));
    }

    expect(recorder.getCarIds()).toEqual(cars);
    expect(recorder.getCarIds()).toHaveLength(8);
  });

  it("should not share arrays between cars with similar IDs", () => {
    const recorder = new TelemetryRecorder();
    recorder.addSample("a", makeSample({ tick: 10 }));
    recorder.addSample("b", makeSample({ tick: 20 }));

    expect(recorder.getSamples("a")).toHaveLength(1);
    expect(recorder.getSamples("a")[0].tick).toBe(10);
    expect(recorder.getSamples("b")).toHaveLength(1);
    expect(recorder.getSamples("b")[0].tick).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// AC-3: clear() empties all arrays and resets counters
// ---------------------------------------------------------------------------

describe("clear() resets state (AC-3)", () => {
  it("should empty all per-car arrays", () => {
    const recorder = new TelemetryRecorder();
    recorder.addSample("macklen", makeSample({ tick: 0 }));
    recorder.addSample("macklen", makeSample({ tick: 3 }));
    recorder.addSample("willard", makeSample({ tick: 6 }));

    recorder.clear();

    expect(recorder.getSamples("macklen")).toHaveLength(0);
    expect(recorder.getSamples("willard")).toHaveLength(0);
    expect(recorder.getCarIds()).toEqual([]);
  });

  it("should reset tickCounter to 0", () => {
    const recorder = new TelemetryRecorder();
    // tickCounter starts at 0; tick() (Story 002) will increment it.
    // clear() must ensure it returns to 0.
    recorder.clear();
    expect(recorder.getTickCount()).toBe(0);
  });

  it("should reset logCounter to 0", () => {
    const recorder = new TelemetryRecorder();
    // logCounter starts at 0; printConsoleSummary() (Story 003) will increment it.
    // clear() must ensure it returns to 0.
    recorder.clear();
    expect(recorder.getLogCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-4: clear() is idempotent
// ---------------------------------------------------------------------------

describe("clear() idempotence (AC-4)", () => {
  it("should not throw on already-empty state", () => {
    const recorder = new TelemetryRecorder();
    expect(() => recorder.clear()).not.toThrow();
  });

  it("should keep state unchanged when called twice on empty state", () => {
    const recorder = new TelemetryRecorder();
    recorder.clear();
    recorder.clear();

    expect(recorder.getCarIds()).toEqual([]);
    expect(recorder.getTickCount()).toBe(0);
    expect(recorder.getLogCount()).toBe(0);
  });

  it("should keep state unchanged when called twice on populated state", () => {
    const recorder = new TelemetryRecorder();
    recorder.addSample("car_01", makeSample({ tick: 0 }));
    recorder.addSample("car_02", makeSample({ tick: 3 }));
    recorder.addSample("car_03", makeSample({ tick: 6 }));

    // First clear
    recorder.clear();
    expect(recorder.getCarIds()).toEqual([]);

    // Second clear — must be a no-op with no errors
    expect(() => recorder.clear()).not.toThrow();
    expect(recorder.getCarIds()).toEqual([]);
    expect(recorder.getTickCount()).toBe(0);
    expect(recorder.getLogCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Edge cases: getSamples for unknown car
// ---------------------------------------------------------------------------

describe("getSamples() for unknown car", () => {
  it("should return an empty array (not null or undefined)", () => {
    const recorder = new TelemetryRecorder();
    const samples = recorder.getSamples("nonexistent");
    expect(samples).toEqual([]);
    // Validate immutability contract — empty array is safe to spread
    expect([...samples]).toEqual([]);
  });

  it("should not create a map entry for unknown car access", () => {
    const recorder = new TelemetryRecorder();
    recorder.getSamples("ghost");
    expect(recorder.getCarIds()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Edge cases: getCarIds returns correct list
// ---------------------------------------------------------------------------

describe("getCarIds()", () => {
  it("should return an empty array when no cars recorded", () => {
    const recorder = new TelemetryRecorder();
    expect(recorder.getCarIds()).toEqual([]);
  });

  it("should return all car IDs that have samples", () => {
    const recorder = new TelemetryRecorder();
    recorder.addSample("macklen", makeSample({ tick: 0 }));
    recorder.addSample("lorris", makeSample({ tick: 3 }));
    recorder.addSample("willard", makeSample({ tick: 6 }));

    const ids = recorder.getCarIds();
    expect(ids).toContain("macklen");
    expect(ids).toContain("lorris");
    expect(ids).toContain("willard");
    expect(ids).toHaveLength(3);
  });

  it("should return a new array each time (no mutation leak)", () => {
    const recorder = new TelemetryRecorder();
    recorder.addSample("car_01", makeSample({ tick: 0 }));

    const first = recorder.getCarIds();
    const second = recorder.getCarIds();
    expect(first).toEqual(second);
    // Mutating one should not affect the other
    first.push("injected");
    expect(recorder.getCarIds()).toEqual(["car_01"]);
  });
});

// ---------------------------------------------------------------------------
// Edge cases: counters
// ---------------------------------------------------------------------------

describe("getTickCount() and getLogCount()", () => {
  it("should reflect the initial state as 0", () => {
    const recorder = new TelemetryRecorder();
    expect(recorder.getTickCount()).toBe(0);
    expect(recorder.getLogCount()).toBe(0);
  });

  it("should be reset to 0 after clear()", () => {
    const recorder = new TelemetryRecorder();
    // Simulate state where counters might be non-zero (actual
    // increment happens in tick() / printConsoleSummary(), Stories 002–003).
    // For now, verify clear() keeps them at 0.
    recorder.clear();
    expect(recorder.getTickCount()).toBe(0);
    expect(recorder.getLogCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration-style: multiple operations
// ---------------------------------------------------------------------------

describe("combined operations", () => {
  it("should handle add → clear → add cycle", () => {
    const recorder = new TelemetryRecorder();

    recorder.addSample("macklen", makeSample({ tick: 0 }));
    expect(recorder.getCarIds()).toHaveLength(1);

    recorder.clear();
    expect(recorder.getCarIds()).toHaveLength(0);

    // Re-add after clear — should work fresh
    recorder.addSample("willard", makeSample({ tick: 3 }));
    expect(recorder.getCarIds()).toEqual(["willard"]);
    expect(recorder.getSamples("willard")).toHaveLength(1);
    expect(recorder.getSamples("macklen")).toHaveLength(0);
  });

  it("should preserve sample data integrity across addSample calls", () => {
    const recorder = new TelemetryRecorder();
    const sample1 = makeSample({ tick: 0, speed: 100, fuel: 0.8, aiState: 0 });
    const sample2 = makeSample({ tick: 3, speed: 150, fuel: 0.79, aiState: 1 });

    recorder.addSample("car_01", sample1);
    recorder.addSample("car_01", sample2);

    const samples = recorder.getSamples("car_01");
    expect(samples[0].speed).toBe(100);
    expect(samples[0].fuel).toBe(0.8);
    expect(samples[0].aiState).toBe(0);
    expect(samples[1].speed).toBe(150);
    expect(samples[1].fuel).toBe(0.79);
    expect(samples[1].aiState).toBe(1);
  });
});
