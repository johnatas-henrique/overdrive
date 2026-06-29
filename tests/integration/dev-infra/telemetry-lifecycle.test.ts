/**
 * Integration tests: TelemetryRecorder ↔ EventBus lifecycle.
 *
 * Verifies that the TelemetryRecorder correctly responds to race lifecycle
 * events (`race.started`, `gsm.state.entered`) when wired via its `init()`
 * method, with full session isolation across multiple race instances.
 *
 * @see ADR-0022 — Telemetry Recorder
 * @see Story 005 — Race Lifecycle Integration
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CarEntityRef,
  TelemetrySample,
} from "../../../src/dev-infra/telemetry-recorder";
import { TelemetryRecorder } from "../../../src/dev-infra/telemetry-recorder";
import { EventBus } from "../../../src/foundation/event-bus";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Suppress console.log output during tests. */
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

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

/** Create a mock CarEntityRef with default values. */
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Hardcoded race config used across tests. */
const RACE_CONFIG = {
  track: "interlagos",
  totalLaps: 40,
  playerCarId: "player_one",
} as const;

/** Number of ticks to run to get a deterministic sample count. */
const TICKS_PER_SAMPLE = 3; // default sampling interval

// ---------------------------------------------------------------------------
// AC-1: race.started fires → clear + recording enabled
// ---------------------------------------------------------------------------

describe("AC-1: race.started fires → clear + recording enabled", () => {
  let bus: EventBus;
  let recorder: TelemetryRecorder;

  beforeEach(() => {
    bus = new EventBus();
    bus.init();
    recorder = new TelemetryRecorder();
    recorder.init(bus);
  });

  it("should clear samples and enable recording on race.started", () => {
    // Arrange: add some samples and recording state
    recorder.addSample("car_01", makeSample());
    recorder.addSample("car_02", makeSample());
    recorder.setRecording(false);

    // Act
    bus.emit("race.started", RACE_CONFIG);

    // Assert: samples cleared, counters reset, recording enabled
    expect(recorder.getCarIds()).toEqual([]);
    expect(recorder.getTickCount()).toBe(0);
    expect(recorder.getLogCount()).toBe(0);
  });

  it("should set recording=true after race.started", () => {
    bus.emit("race.started", RACE_CONFIG);

    // Trigger console summary via 300 tick() calls — _isRecording gates it
    const cars = [makeCar()];
    for (let i = 0; i < 300; i++) {
      recorder.tick(0, cars, 0);
    }
    expect(recorder.getLogCount()).toBe(1);
  });

  it("should set track and totalLaps from race.started payload", () => {
    bus.emit("race.started", RACE_CONFIG);

    // Add a sample so export produces data
    recorder.addSample("car_01", makeSample({ tick: 0, t: 0 }));
    const json = recorder.export();
    expect(json).not.toBeNull();
    const data = JSON.parse(json as string);
    expect(data.race.track).toBe("interlagos");
    expect(data.race.laps).toBe(40);
    expect(data.race.startTime).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC-2: Multiple race.started events without PostRace — no error
// ---------------------------------------------------------------------------

describe("AC-2: Multiple race.started events w/out PostRace", () => {
  it("should clear correctly on consecutive race.started", () => {
    const bus = new EventBus();
    bus.init();
    const recorder = new TelemetryRecorder();
    recorder.init(bus);

    // Add samples from "first race"
    recorder.addSample("car_01", makeSample());
    recorder.addSample("car_01", makeSample());
    expect(recorder.getCarIds()).toEqual(["car_01"]);

    // First race.started
    bus.emit("race.started", RACE_CONFIG);
    expect(recorder.getCarIds()).toEqual([]);

    // Add samples from "second race"
    recorder.addSample("car_02", makeSample());
    expect(recorder.getCarIds()).toEqual(["car_02"]);

    // Second race.started — no error, no cross-contamination
    bus.emit("race.started", RACE_CONFIG);
    expect(recorder.getCarIds()).toEqual([]);
  });

  it("should not throw on multiple race.started without PostRace in between", () => {
    const bus = new EventBus();
    bus.init();
    const recorder = new TelemetryRecorder();
    recorder.init(bus);

    // Add some samples
    recorder.addSample("car_01", makeSample());

    // Fire three race.started in a row
    expect(() => {
      bus.emit("race.started", RACE_CONFIG);
      bus.emit("race.started", RACE_CONFIG);
      bus.emit("race.started", RACE_CONFIG);
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AC-3: PostRace makes data available, stops recording
// ---------------------------------------------------------------------------

describe("AC-3: PostRace → isRecording=false, export still works", () => {
  it("should set recording=false on gsm.state.entered(PostRace)", () => {
    const bus = new EventBus();
    bus.init();
    const recorder = new TelemetryRecorder();
    recorder.init(bus);

    // Start a race
    bus.emit("race.started", RACE_CONFIG);

    // Enter PostRace immediately (before any ticks)
    bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });

    // Run 300 ticks — log should fire at tick 300 if recording were on
    const cars = [makeCar()];
    for (let i = 0; i < 300; i++) {
      recorder.tick(0, cars, 0);
    }
    // Log should NOT have fired because recording is disabled
    expect(recorder.getLogCount()).toBe(0);
  });

  it("should still export full race data after PostRace", () => {
    const bus = new EventBus();
    bus.init();
    const recorder = new TelemetryRecorder();
    recorder.init(bus);

    // Start a race with config
    bus.emit("race.started", {
      track: "monza",
      totalLaps: 30,
      playerCarId: "player",
    });

    // Record some samples
    recorder.addSample("player", makeSample({ t: 10, speed: 200 }));
    recorder.addSample("ai_01", makeSample({ t: 10, speed: 195, aiState: 0 }));

    // Enter PostRace
    bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });

    // Export should still contain all data
    const json = recorder.export();
    expect(json).not.toBeNull();
    const data = JSON.parse(json as string);
    expect(data.race.track).toBe("monza");
    expect(data.race.laps).toBe(30);
    expect(Object.keys(data.cars)).toHaveLength(2);
    expect(data.cars.player.samples).toHaveLength(1);
    expect(data.cars.ai_01.samples).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AC-4: Player car recorded alongside AI cars
// ---------------------------------------------------------------------------

describe("AC-4: Player car recorded alongside AI cars", () => {
  it("should record player with aiState=-1 and AI cars with aiState in {0,1,2}", () => {
    const bus = new EventBus();
    bus.init();
    const recorder = new TelemetryRecorder();
    recorder.init(bus);

    bus.emit("race.started", RACE_CONFIG);

    // 7 AI cars + 1 player car
    const aiStates = [0, 1, 2, 0, 1, 2, 0];
    const cars: CarEntityRef[] = [
      makeCar({ id: "player_one", teamName: "Lorris" }), // player — no aiDriver
      ...aiStates.map((state, i) =>
        makeCar({
          id: `ai_${i + 1}`,
          teamName: `Team ${i + 1}`,
          aiDriver: { state },
        })
      ),
    ];

    // Run 3 ticks (one sampling cycle at interval 3)
    for (let tick = 0; tick < TICKS_PER_SAMPLE; tick++) {
      recorder.tick(0, cars, tick);
    }

    // 8 cars recorded
    expect(recorder.getCarIds()).toHaveLength(8);

    // Player sample has aiState === -1
    const playerSamples = recorder.getSamples("player_one");
    expect(playerSamples).toHaveLength(1);
    expect(playerSamples[0].aiState).toBe(-1);

    // AI samples have aiState in {0, 1, 2}
    for (let i = 1; i <= 7; i++) {
      const aiSamples = recorder.getSamples(`ai_${i}`);
      expect(aiSamples).toHaveLength(1);
      expect([0, 1, 2]).toContain(aiSamples[0].aiState);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-5: Full lifecycle isolation — two complete race sessions
// ---------------------------------------------------------------------------

describe("AC-5: Full lifecycle isolation", () => {
  it("should isolate sessions across race.started → PostRace → race.started", () => {
    const bus = new EventBus();
    bus.init();
    const recorder = new TelemetryRecorder();
    recorder.init(bus);

    // --- Session 1 ---
    bus.emit("race.started", RACE_CONFIG);

    const cars = [makeCar({ id: "car_01" })];

    // Run 100 ticks at sample interval 3 → ≈33 samples per car
    for (let tick = 0; tick < 100; tick++) {
      recorder.tick(0, cars, tick);
    }
    expect(recorder.getCarIds()).toEqual(["car_01"]);

    const session1SampleCount = recorder.getSamples("car_01").length;
    expect(session1SampleCount).toBeGreaterThan(30); // ≈33 expected

    // PostRace — stops recording
    bus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });

    // --- Session 2 ---
    bus.emit("race.started", RACE_CONFIG);

    // After clear, car_01 is gone — wait, after clear samples are gone
    expect(recorder.getCarIds()).toEqual([]);

    // Now run 50 ticks — expecting ≈16 samples
    for (let tick = 0; tick < 50; tick++) {
      recorder.tick(0, cars, tick);
    }

    expect(recorder.getCarIds()).toEqual(["car_01"]);
    const session2SampleCount = recorder.getSamples("car_01").length;
    // 50 ticks / 3 ≈ 16.67 → 16 or 17 samples
    expect(session2SampleCount).toBeGreaterThanOrEqual(16);
    expect(session2SampleCount).toBeLessThanOrEqual(17);

    // Session 1 samples should be gone
    expect(session2SampleCount).not.toBe(session1SampleCount);
  });

  it("should handle PostRace before race.started gracefully", () => {
    const bus = new EventBus();
    bus.init();
    const recorder = new TelemetryRecorder();
    recorder.init(bus);

    // No race started yet — PostRace event is a no-op (recording already false)
    expect(() => {
      bus.emit("gsm.state.entered", { from: "", to: "PostRace" });
    }).not.toThrow();
  });

  it("should ignore non-PostRace gsm.state.entered events", () => {
    const bus = new EventBus();
    bus.init();
    const recorder = new TelemetryRecorder();
    recorder.init(bus);

    // Start a race — recording enabled
    bus.emit("race.started", RACE_CONFIG);

    // Enter a non-PostRace state (e.g., another race phase)
    bus.emit("gsm.state.entered", { from: "Grid", to: "Racing" });

    // Recording should still be active
    const cars = [makeCar()];
    for (let i = 0; i < 300; i++) {
      recorder.tick(0, cars, 0);
    }
    expect(recorder.getLogCount()).toBe(1);
  });

  it("should handle race restart before any samples recorded", () => {
    const bus = new EventBus();
    bus.init();
    const recorder = new TelemetryRecorder();
    recorder.init(bus);

    // race.started → immediately another race.started (no ticks between)
    bus.emit("race.started", RACE_CONFIG);
    bus.emit("race.started", RACE_CONFIG);

    // Should be clean
    expect(recorder.getCarIds()).toEqual([]);
    expect(recorder.getTickCount()).toBe(0);
  });
});

// ─── Coverage gap: re-init subscriptions ───

describe("Coverage gap — re-init subscriptions", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should unsubscribe previous subscriptions on re-init", () => {
    const bus = new EventBus();
    bus.init();
    const recorder = new TelemetryRecorder();

    // First init
    recorder.init(bus);

    // Count subscriptions after first init
    const subs1 = bus.getSubscriptions();
    const raceStartedCount1 = subs1.get("race.started") ?? 0;

    // Second init — should unsubscribe first, then resubscribe
    recorder.init(bus);

    const subs2 = bus.getSubscriptions();
    const raceStartedCount2 = subs2.get("race.started") ?? 0;

    // Should have same count (not doubled)
    expect(raceStartedCount2).toBe(raceStartedCount1);
  });
});
