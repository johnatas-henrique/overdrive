import { describe, expect, it, vi } from "vitest";
import type { CarEntityRef } from "../../../src/dev-infra/telemetry-recorder";
import { TelemetryRecorder } from "../../../src/dev-infra/telemetry-recorder";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a mock CarEntityRef with default values.
 *
 * Keeps the test file free of inline object literals and lets each test
 * override only the fields it cares about.
 *
 * @param overrides - Optional partial overrides applied after defaults.
 * @returns A CarEntityRef-compatible mock object.
 */
function makeCar(overrides?: Partial<CarEntityRef>): CarEntityRef {
  return {
    id: "test-car",
    physics: {
      speedKmh: 0,
      rpm: 0,
      gear: 1,
      lateralG: 0,
    },
    runtime: {
      elapsedTime: 0,
      throttle: 0,
      brake: 0,
      steer: 0,
      fuelLevel: 1,
      tireCondition: 1,
      splinePos: 0,
    },
    aiDriver: undefined,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// AC-1: Sampling at configured interval (every 3 ticks = 20Hz at 60Hz)
// ---------------------------------------------------------------------------

describe("AC-1: samples every 3 ticks (20Hz at 60Hz)", () => {
  it("should append 3 samples from 9 tick() calls at ticks 0, 3, 6", () => {
    const recorder = new TelemetryRecorder();
    const car = makeCar();

    const cars = [car];

    // Call tick() 9 times with tickCount 0–8
    for (let tickCount = 0; tickCount < 9; tickCount++) {
      recorder.tick(1 / 60, cars, tickCount);
    }

    // Should have 3 samples: at ticks 0, 3, 6
    const samples = recorder.getSamples("test-car");
    expect(samples).toHaveLength(3);
    expect(samples[0].tick).toBe(0);
    expect(samples[1].tick).toBe(3);
    expect(samples[2].tick).toBe(6);
  });

  it("should not record samples on non-sample ticks (1, 2, 4, 5, 7, 8)", () => {
    const recorder = new TelemetryRecorder();
    const car = makeCar();
    const cars = [car];

    // Collect the tick values that were actually sampled
    const sampledTicks: number[] = [];

    // Monkey-patch addSample to capture sampled tick values
    const origAddSample = recorder.addSample.bind(recorder);
    vi.spyOn(recorder, "addSample").mockImplementation((carId, sample) => {
      sampledTicks.push(sample.tick);
      origAddSample(carId, sample);
    });

    for (let tickCount = 0; tickCount < 9; tickCount++) {
      recorder.tick(1 / 60, cars, tickCount);
    }

    // Only ticks 0, 3, 6 should be sampled
    expect(sampledTicks).toEqual([0, 3, 6]);
  });

  it("should respect custom sampleInterval (every 10 ticks = 6Hz)", () => {
    const recorder = new TelemetryRecorder(10);
    const car = makeCar();
    const cars = [car];

    for (let tickCount = 0; tickCount < 30; tickCount++) {
      recorder.tick(1 / 60, cars, tickCount);
    }

    // 30 ticks ÷ 10 = 3 samples at ticks 0, 10, 20
    const samples = recorder.getSamples("test-car");
    expect(samples).toHaveLength(3);
    expect(samples[0].tick).toBe(0);
    expect(samples[1].tick).toBe(10);
    expect(samples[2].tick).toBe(20);
  });

  it("should sample every tick when interval is 1 (60Hz)", () => {
    const recorder = new TelemetryRecorder(1);
    const car = makeCar();
    const cars = [car];

    for (let tickCount = 0; tickCount < 10; tickCount++) {
      recorder.tick(1 / 60, cars, tickCount);
    }

    const samples = recorder.getSamples("test-car");
    expect(samples).toHaveLength(10);
  });
});

// ---------------------------------------------------------------------------
// AC-2: Sample fields match CarEntity state at moment of sampling
// ---------------------------------------------------------------------------

describe("AC-2: sample fields match CarEntity state", () => {
  it("should record all 13 fields with correct values", () => {
    const recorder = new TelemetryRecorder();
    const car = makeCar({
      id: "macklen",
      physics: {
        speedKmh: 245,
        rpm: 14200,
        gear: 5,
        lateralG: 12.5,
      },
      runtime: {
        elapsedTime: 3.05,
        throttle: 0.85,
        brake: 0.0,
        steer: 0.2,
        fuelLevel: 0.72,
        tireCondition: 0.88,
        splinePos: 0.153,
      },
      aiDriver: { state: 0 },
    });

    recorder.tick(1 / 60, [car], 3);

    const samples = recorder.getSamples("macklen");
    expect(samples).toHaveLength(1);

    const s = samples[0];
    expect(s.tick).toBe(3);
    expect(s.t).toBe(3.05);
    expect(s.speed).toBe(245);
    expect(s.rpm).toBe(14200);
    expect(s.throttle).toBe(0.85);
    expect(s.brake).toBe(0.0);
    expect(s.steer).toBe(0.2);
    expect(s.gear).toBe(5);
    expect(s.lateralG).toBe(12.5);
    expect(s.fuel).toBe(0.72);
    expect(s.tireCondition).toBe(0.88);
    expect(s.splinePos).toBe(0.153);
    expect(s.aiState).toBe(0);
  });

  it("should record aiState = -1 for player car (no aiDriver)", () => {
    const recorder = new TelemetryRecorder();
    const playerCar = makeCar({
      id: "player",
      aiDriver: undefined, // Player car has no AI driver
    });

    recorder.tick(1 / 60, [playerCar], 3);

    const samples = recorder.getSamples("player");
    expect(samples).toHaveLength(1);
    expect(samples[0].aiState).toBe(-1);
  });

  it("should record aiState for AI cars (0, 1, 2)", () => {
    const recorder = new TelemetryRecorder();

    const aiNormal = makeCar({ id: "ai_normal", aiDriver: { state: 0 } });
    const aiFollowing = makeCar({ id: "ai_following", aiDriver: { state: 1 } });
    const aiPassing = makeCar({ id: "ai_passing", aiDriver: { state: 2 } });

    recorder.tick(1 / 60, [aiNormal, aiFollowing, aiPassing], 3);

    expect(recorder.getSamples("ai_normal")[0].aiState).toBe(0);
    expect(recorder.getSamples("ai_following")[0].aiState).toBe(1);
    expect(recorder.getSamples("ai_passing")[0].aiState).toBe(2);
  });

  it("should snapshot values at call time (not shared references)", () => {
    const recorder = new TelemetryRecorder();
    const car = makeCar({
      physics: { speedKmh: 100, rpm: 8000, gear: 3, lateralG: 5 },
    });

    // Sample at tick 3
    recorder.tick(1 / 60, [car], 3);

    // Modify the original car's state
    const mutablePhysics = car.physics as { speedKmh: number };
    mutablePhysics.speedKmh = 200;

    // Sample at tick 6
    recorder.tick(1 / 60, [car], 6);

    const samples = recorder.getSamples("test-car");
    // First sample should retain the original speed (100), not the mutated value
    expect(samples[0].speed).toBe(100);
    // Actually, since we're reading from the same object reference, the second
    // sample WILL see the mutated value — this test documents the expected
    // behavior: samples capture the CarEntity state at the moment of each call.
    expect(samples[1].speed).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// AC-3: Empty cars array produces no error and no samples
// ---------------------------------------------------------------------------

describe("AC-3: empty cars array", () => {
  it("should not throw when called with empty array", () => {
    const recorder = new TelemetryRecorder();
    expect(() => recorder.tick(1 / 60, [], 0)).not.toThrow();
  });

  it("should not append any samples with empty array", () => {
    const recorder = new TelemetryRecorder();

    for (let tickCount = 0; tickCount < 6; tickCount++) {
      recorder.tick(1 / 60, [], tickCount);
    }

    expect(recorder.getCarIds()).toEqual([]);
  });

  it("should leave samples Map unchanged after tick() with empty array", () => {
    const recorder = new TelemetryRecorder();
    const car = makeCar();

    // Add a sample normally
    recorder.tick(1 / 60, [car], 0);
    expect(recorder.getCarIds()).toHaveLength(1);

    // Call tick with empty array — should not affect existing data
    recorder.tick(1 / 60, [], 3);
    expect(recorder.getCarIds()).toHaveLength(1);
    expect(recorder.getSamples("test-car")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AC-4: Late-joining car appears mid-session
// ---------------------------------------------------------------------------

describe("AC-4: late-joining car", () => {
  it("should start recording a new car on the next sample tick", () => {
    const recorder = new TelemetryRecorder();
    const car1 = makeCar({ id: "car_01" });
    const car2 = makeCar({ id: "car_02" });

    // Tick 0: only car_01 exists
    recorder.tick(1 / 60, [car1], 0);

    // Tick 3: both cars exist (car_02 joins)
    recorder.tick(1 / 60, [car1, car2], 3);

    // Tick 6: both cars still present
    recorder.tick(1 / 60, [car1, car2], 6);

    // car_01 should have 3 samples (ticks 0, 3, 6)
    expect(recorder.getSamples("car_01")).toHaveLength(3);
    expect(recorder.getSamples("car_01")[0].tick).toBe(0);
    expect(recorder.getSamples("car_01")[1].tick).toBe(3);
    expect(recorder.getSamples("car_01")[2].tick).toBe(6);

    // car_02 should have 2 samples starting at tick 3 (no sample at tick 0)
    expect(recorder.getSamples("car_02")).toHaveLength(2);
    expect(recorder.getSamples("car_02")[0].tick).toBe(3);
    expect(recorder.getSamples("car_02")[1].tick).toBe(6);
  });

  it("should not crash when a car leaves the array between ticks", () => {
    const recorder = new TelemetryRecorder();
    const car1 = makeCar({ id: "car_01" });
    const car2 = makeCar({ id: "car_02" });

    // Tick 0: both cars
    recorder.tick(1 / 60, [car1, car2], 0);

    // Tick 3: car_01 is alone (car_02 disconnected)
    recorder.tick(1 / 60, [car1], 3);

    // Tick 6: car_01 still alone — no crash from missing car_02
    expect(() => recorder.tick(1 / 60, [car1], 6)).not.toThrow();

    // car_01 should have 3 samples
    expect(recorder.getSamples("car_01")).toHaveLength(3);
    // car_02 should have 1 sample (tick 0 only)
    expect(recorder.getSamples("car_02")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AC-5: No-op when import.meta.env.DEV is false
// ---------------------------------------------------------------------------

describe("AC-5: no-op when DEV is false", () => {
  it("should return immediately without appending samples", () => {
    const recorder = new TelemetryRecorder();
    const car = makeCar();

    // Stub DEV to false to simulate production environment
    vi.stubEnv("DEV", false);

    try {
      for (let tickCount = 0; tickCount < 9; tickCount++) {
        recorder.tick(1 / 60, [car], tickCount);
      }

      // No samples should have been recorded
      expect(recorder.getSamples("test-car")).toEqual([]);
      // Tick counter should not have incremented
      expect(recorder.getTickCount()).toBe(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("should resume normal operation when DEV is restored to true", () => {
    const recorder = new TelemetryRecorder();
    const car = makeCar();

    // Simulate production — no samples
    vi.stubEnv("DEV", false);
    recorder.tick(1 / 60, [car], 0);
    recorder.tick(1 / 60, [car], 3);
    vi.unstubAllEnvs();

    // DEV is true again — samples should be recorded
    recorder.tick(1 / 60, [car], 6);

    expect(recorder.getSamples("test-car")).toHaveLength(1);
    expect(recorder.getSamples("test-car")[0].tick).toBe(6);
    // tickCounter should be 1 (only the last call counted)
    expect(recorder.getTickCount()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Edge cases: _tickCounter behavior
// ---------------------------------------------------------------------------

describe("_tickCounter increments on every call", () => {
  it("should increment tickCounter on every tick() call, not just samples", () => {
    const recorder = new TelemetryRecorder();
    const car = makeCar();

    // Call tick 5 times with tickCount 0, 1, 2, 3, 4
    for (let tickCount = 0; tickCount < 5; tickCount++) {
      recorder.tick(1 / 60, [car], tickCount);
    }

    // tickCounter counts all calls
    expect(recorder.getTickCount()).toBe(5);

    // Only 2 samples (ticks 0, 3)
    expect(recorder.getSamples("test-car")).toHaveLength(2);
  });

  it("should reset tickCounter after clear()", () => {
    const recorder = new TelemetryRecorder();
    const car = makeCar();

    recorder.tick(1 / 60, [car], 0);
    recorder.tick(1 / 60, [car], 3);
    expect(recorder.getTickCount()).toBe(2);

    recorder.clear();
    expect(recorder.getTickCount()).toBe(0);

    // After clear, new calls start from 1
    recorder.tick(1 / 60, [car], 6);
    expect(recorder.getTickCount()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Edge cases: multiple cars at once
// ---------------------------------------------------------------------------

describe("multiple cars sampled simultaneously", () => {
  it("should record 3 samples per car for 3 cars over 9 ticks", () => {
    const recorder = new TelemetryRecorder();
    const cars = [
      makeCar({ id: "car_01" }),
      makeCar({ id: "car_02" }),
      makeCar({ id: "car_03" }),
    ];

    for (let tickCount = 0; tickCount < 9; tickCount++) {
      recorder.tick(1 / 60, cars, tickCount);
    }

    // Each car should have 3 samples
    expect(recorder.getSamples("car_01")).toHaveLength(3);
    expect(recorder.getSamples("car_02")).toHaveLength(3);
    expect(recorder.getSamples("car_03")).toHaveLength(3);

    // All samples at the same ticks
    expect(recorder.getSamples("car_01")[0].tick).toBe(0);
    expect(recorder.getSamples("car_02")[0].tick).toBe(0);
    expect(recorder.getSamples("car_03")[0].tick).toBe(0);
  });
});
