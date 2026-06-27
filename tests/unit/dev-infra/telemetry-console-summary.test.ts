/**
 * @fileoverview Tests for Story 003 — Console Summary Log.
 *
 * Covers all 6 acceptance criteria from the story file:
 * - AC-1: console.log called at logInterval (default 300 ticks)
 * - AC-2: Output format matches GDD specification
 * - AC-3: Cars sorted by race position ascending
 * - AC-4: logInterval tuning knob (range 60–600)
 * - AC-5: No log when 0 cars registered
 * - AC-6: Gated by isRecording flag
 */

import { describe, expect, it, vi } from "vitest";
import type { CarEntityRef } from "../../../src/dev-infra/telemetry-recorder";
import { TelemetryRecorder } from "../../../src/dev-infra/telemetry-recorder";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a mock CarEntityRef with default values.
 *
 * Supports deep merging for nested objects (physics, runtime, aiDriver)
 * so that tests can override only the fields they care about without
 * losing defaults for unrelated fields.
 *
 * @param overrides - Optional partial overrides applied with deep merge.
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

// ---------------------------------------------------------------------------
// AC-1: console.log called at logInterval (default 300 ticks)
// ---------------------------------------------------------------------------

describe("AC-1: console.log called at logInterval (default 300 ticks)", () => {
  it("should call console.log exactly 2 times over 600 ticks with default interval", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);
    const car = makeCar();

    try {
      for (let tc = 0; tc < 600; tc++) {
        recorder.tick(1 / 60, [car], tc);
      }

      // 600 ticks ÷ 300 interval = 2 log calls
      expect(logSpy).toHaveBeenCalledTimes(2);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("should not log on intermediate ticks (299→300 boundary)", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);
    const car = makeCar();

    try {
      // Tick 299 should NOT trigger a log
      for (let tc = 0; tc < 299; tc++) {
        recorder.tick(1 / 60, [car], tc);
      }
      expect(logSpy).toHaveBeenCalledTimes(0);

      // Tick 300 should trigger a log
      // _tickCounter is 300 here (independent of tickCount param)
      recorder.tick(1 / 60, [car], 299);
      expect(logSpy).toHaveBeenCalledTimes(1);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("should produce 10 logs at 3000 ticks with default interval", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);
    const car = makeCar();

    try {
      for (let tc = 0; tc < 3000; tc++) {
        recorder.tick(1 / 60, [car], tc);
      }

      // 3000 ÷ 300 = 10 log calls (at tickCounter 300, 600, ..., 3000)
      expect(logSpy).toHaveBeenCalledTimes(10);
    } finally {
      logSpy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// AC-2: Output format matches GDD specification
// ---------------------------------------------------------------------------

describe("AC-2: log format matches GDD specification", () => {
  it("should produce the exact GDD format for 3 cars", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);
    recorder.setTotalLaps(5);

    const cars = [
      makeCar({
        id: "macklen",
        teamName: "Macklen",
        physics: { speedKmh: 245 },
        runtime: { racePosition: 1, currentLap: 3 },
      }),
      makeCar({
        id: "willard",
        teamName: "Willard",
        physics: { speedKmh: 241 },
        runtime: { racePosition: 2, currentLap: 3 },
      }),
      makeCar({
        id: "lorris",
        teamName: "Lorris",
        physics: { speedKmh: 218 },
        runtime: { racePosition: 3, currentLap: 3 },
      }),
    ];

    try {
      // Trigger the log at tick 300
      for (let tc = 0; tc < 300; tc++) {
        recorder.tick(1 / 60, cars, tc);
      }

      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        "[TELE] Lap 3/5 | P1 Macklen 245 km/h | P2 Willard 241 km/h | P3 Lorris 218 km/h"
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it("should handle a single car output correctly", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);
    recorder.setTotalLaps(3);

    const car = makeCar({
      teamName: "Solo",
      physics: { speedKmh: 180 },
      runtime: { racePosition: 1, currentLap: 2 },
    });

    try {
      for (let tc = 0; tc < 300; tc++) {
        recorder.tick(1 / 60, [car], tc);
      }

      expect(logSpy).toHaveBeenCalledWith("[TELE] Lap 2/3 | P1 Solo 180 km/h");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("should round speed to nearest integer km/h", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);
    recorder.setTotalLaps(5);

    const car = makeCar({
      teamName: "Fast",
      physics: { speedKmh: 245.7 },
      runtime: { racePosition: 1, currentLap: 1 },
    });

    try {
      for (let tc = 0; tc < 300; tc++) {
        recorder.tick(1 / 60, [car], tc);
      }

      // 245.7 → Math.round → 246
      expect(logSpy).toHaveBeenCalledWith("[TELE] Lap 1/5 | P1 Fast 246 km/h");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("should use leader's currentLap for the display", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);
    recorder.setTotalLaps(5);

    const cars = [
      makeCar({
        id: "leader",
        teamName: "Leader",
        physics: { speedKmh: 250 },
        runtime: { racePosition: 1, currentLap: 4 },
      }),
      makeCar({
        id: "backmarker",
        teamName: "Back",
        physics: { speedKmh: 200 },
        runtime: { racePosition: 8, currentLap: 3 },
      }),
    ];

    try {
      for (let tc = 0; tc < 300; tc++) {
        recorder.tick(1 / 60, cars, tc);
      }

      // Should show Lap 4 (leader's lap, not backmarker's lap)
      expect(logSpy).toHaveBeenCalledWith(
        "[TELE] Lap 4/5 | P1 Leader 250 km/h | P2 Back 200 km/h"
      );
    } finally {
      logSpy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// AC-3: Cars sorted by race position ascending
// ---------------------------------------------------------------------------

describe("AC-3: cars sorted by race position ascending", () => {
  it("should output P1–P3 in correct order when input is mixed", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);
    recorder.setTotalLaps(5);

    // Cars in arbitrary order — not sorted by position
    const cars = [
      makeCar({
        id: "p2_car",
        teamName: "Second",
        physics: { speedKmh: 230 },
        runtime: { racePosition: 2, currentLap: 2 },
      }),
      makeCar({
        id: "p3_car",
        teamName: "Third",
        physics: { speedKmh: 210 },
        runtime: { racePosition: 3, currentLap: 2 },
      }),
      makeCar({
        id: "p1_car",
        teamName: "First",
        physics: { speedKmh: 250 },
        runtime: { racePosition: 1, currentLap: 2 },
      }),
    ];

    try {
      for (let tc = 0; tc < 300; tc++) {
        recorder.tick(1 / 60, cars, tc);
      }

      expect(logSpy).toHaveBeenCalledWith(
        "[TELE] Lap 2/5 | P1 First 250 km/h | P2 Second 230 km/h | P3 Third 210 km/h"
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it("should handle reverse input order (P8 → P1)", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);
    recorder.setTotalLaps(3);

    // Create cars positions 8 down to 1
    const cars = Array.from({ length: 8 }, (_, i) => {
      const pos = 8 - i; // 8, 7, 6, 5, 4, 3, 2, 1
      return makeCar({
        id: `car_p${pos}`,
        teamName: `Team${pos}`,
        physics: { speedKmh: 200 + pos * 5 },
        runtime: { racePosition: pos, currentLap: 1 },
      });
    });

    try {
      for (let tc = 0; tc < 300; tc++) {
        recorder.tick(1 / 60, cars, tc);
      }

      const logArg = logSpy.mock.calls[0][0] as string;
      // P1 should be the first car mentioned
      expect(logArg).toMatch(/^\[TELE\] Lap 1\/3 \| P1 Team1/);
      // P8 should be last
      expect(logArg).toMatch(/P8 Team8 \d+ km\/h$/);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("should not mutate the input cars array order", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);
    recorder.setTotalLaps(5);

    const cars = [
      makeCar({
        id: "p2_car",
        teamName: "Second",
        runtime: { racePosition: 2 },
      }),
      makeCar({
        id: "p1_car",
        teamName: "First",
        runtime: { racePosition: 1 },
      }),
    ];

    const originalOrder = cars.map((c) => c.id);

    try {
      for (let tc = 0; tc < 300; tc++) {
        recorder.tick(1 / 60, cars, tc);
      }

      // Original array should be unchanged
      expect(cars.map((c) => c.id)).toEqual(originalOrder);
    } finally {
      logSpy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// AC-4: logInterval tuning knob (default 300, range 60–600)
// ---------------------------------------------------------------------------

describe("AC-4: logInterval tuning knob", () => {
  it("should log every 60 ticks when logInterval = 60", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const recorder = new TelemetryRecorder(3, 60);
    recorder.setRecording(true);
    const car = makeCar();

    try {
      for (let tc = 0; tc < 120; tc++) {
        recorder.tick(1 / 60, [car], tc);
      }

      // 120 ÷ 60 = 2 log calls
      expect(logSpy).toHaveBeenCalledTimes(2);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("should log every 600 ticks when logInterval = 600", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const recorder = new TelemetryRecorder(3, 600);
    recorder.setRecording(true);
    const car = makeCar();

    try {
      for (let tc = 0; tc < 1800; tc++) {
        recorder.tick(1 / 60, [car], tc);
      }

      // 1800 ÷ 600 = 3 log calls
      expect(logSpy).toHaveBeenCalledTimes(3);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("should log on correct tick boundaries for logInterval = 150", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const recorder = new TelemetryRecorder(3, 150);
    recorder.setRecording(true);
    const car = makeCar();

    try {
      // Call 149 times — should not log yet
      for (let tc = 0; tc < 149; tc++) {
        recorder.tick(1 / 60, [car], tc);
      }
      expect(logSpy).toHaveBeenCalledTimes(0);

      // Call 150 — first log (tickCounter = 150, 150 % 150 = 0)
      recorder.tick(1 / 60, [car], 149);
      expect(logSpy).toHaveBeenCalledTimes(1);

      // Fill the gap to call 299 — tickCounter goes from 150 to 299
      for (let tc = 150; tc < 299; tc++) {
        recorder.tick(1 / 60, [car], tc);
      }
      expect(logSpy).toHaveBeenCalledTimes(1);

      // Call 300 — second log (tickCounter = 300, 300 % 150 = 0)
      recorder.tick(1 / 60, [car], 299);
      expect(logSpy).toHaveBeenCalledTimes(2);
    } finally {
      logSpy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// AC-5: No log when no cars registered
// ---------------------------------------------------------------------------

describe("AC-5: no log when 0 cars registered", () => {
  it("should not call console.log with empty cars array", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);

    try {
      for (let tc = 0; tc < 600; tc++) {
        recorder.tick(1 / 60, [], tc);
      }

      expect(logSpy).toHaveBeenCalledTimes(0);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("should not throw when cars array is empty and log interval fires", () => {
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);

    expect(() => {
      for (let tc = 0; tc < 300; tc++) {
        recorder.tick(1 / 60, [], tc);
      }
    }).not.toThrow();
  });

  it("should not increment logCounter with empty cars array", () => {
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);

    for (let tc = 0; tc < 600; tc++) {
      recorder.tick(1 / 60, [], tc);
    }

    expect(recorder.getLogCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-6: Gated by isRecording flag
// ---------------------------------------------------------------------------

describe("AC-6: gated by isRecording flag", () => {
  it("should not log when isRecording is false (default)", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const recorder = new TelemetryRecorder();
    // NOT calling setRecording(true)
    const car = makeCar();

    try {
      for (let tc = 0; tc < 600; tc++) {
        recorder.tick(1 / 60, [car], tc);
      }

      expect(logSpy).toHaveBeenCalledTimes(0);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("should resume logging after isRecording transitions to true", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const recorder = new TelemetryRecorder();
    const car = makeCar();

    try {
      // First 300 ticks with isRecording = false — no logs
      for (let tc = 0; tc < 300; tc++) {
        recorder.tick(1 / 60, [car], tc);
      }
      expect(logSpy).toHaveBeenCalledTimes(0);

      // Enable recording
      recorder.setRecording(true);

      // Next 300 ticks — should produce 1 log (at tick counter 600)
      for (let tc = 300; tc < 600; tc++) {
        recorder.tick(1 / 60, [car], tc);
      }
      expect(logSpy).toHaveBeenCalledTimes(1);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("should stop logging after isRecording transitions to false mid-race", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);
    const car = makeCar();

    try {
      // First 300 ticks with recording on — 1 log
      for (let tc = 0; tc < 300; tc++) {
        recorder.tick(1 / 60, [car], tc);
      }
      expect(logSpy).toHaveBeenCalledTimes(1);

      // Disable recording
      recorder.setRecording(false);

      // Next 300 ticks — no more logs
      for (let tc = 300; tc < 600; tc++) {
        recorder.tick(1 / 60, [car], tc);
      }
      expect(logSpy).toHaveBeenCalledTimes(1);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("should not increment logCounter when isRecording is false", () => {
    const recorder = new TelemetryRecorder();
    const car = makeCar();

    for (let tc = 0; tc < 600; tc++) {
      recorder.tick(1 / 60, [car], tc);
    }

    expect(recorder.getLogCount()).toBe(0);
  });

  it("should increment logCounter when log fires", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);
    const car = makeCar();

    try {
      for (let tc = 0; tc < 600; tc++) {
        recorder.tick(1 / 60, [car], tc);
      }

      // logCounter should match spy call count
      expect(recorder.getLogCount()).toBe(2);
    } finally {
      logSpy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases: clear() resets recording state
// ---------------------------------------------------------------------------

describe("clear() resets recording state", () => {
  it("should reset isRecording to false after clear()", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);
    const car = makeCar();

    try {
      // Log fires at tick 300
      for (let tc = 0; tc < 300; tc++) {
        recorder.tick(1 / 60, [car], tc);
      }
      expect(logSpy).toHaveBeenCalledTimes(1);

      recorder.clear();

      // After clear, isRecording is false
      for (let tc = 300; tc < 600; tc++) {
        recorder.tick(1 / 60, [car], tc);
      }

      // No more logs despite reaching interval again
      expect(logSpy).toHaveBeenCalledTimes(1);
    } finally {
      logSpy.mockRestore();
    }
  });

  it("should reset totalLaps to 0 after clear()", () => {
    const recorder = new TelemetryRecorder();
    recorder.setTotalLaps(10);

    // Simulate storing totalLaps internally
    recorder.clear();

    // After clear, totalLaps is 0
    // Re-enable recording to test
    recorder.setRecording(true);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const car = makeCar({ runtime: { racePosition: 1, currentLap: 2 } });

    try {
      for (let tc = 0; tc < 300; tc++) {
        recorder.tick(1 / 60, [car], tc);
      }

      // Lap display should show "/0" because totalLaps was reset
      expect(logSpy).toHaveBeenCalledWith(
        "[TELE] Lap 2/0 | P1 Test Team 0 km/h"
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  it("should reset logCounter to 0 after clear()", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const recorder = new TelemetryRecorder();
    recorder.setRecording(true);
    const car = makeCar();

    try {
      for (let tc = 0; tc < 300; tc++) {
        recorder.tick(1 / 60, [car], tc);
      }
      expect(recorder.getLogCount()).toBe(1);

      recorder.clear();
      expect(recorder.getLogCount()).toBe(0);
    } finally {
      logSpy.mockRestore();
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases: setRecording / setTotalLaps method contracts
// ---------------------------------------------------------------------------

describe("setRecording / setTotalLaps contracts", () => {
  it("should accept setRecording(false) multiple times (idempotent)", () => {
    const recorder = new TelemetryRecorder();
    expect(() => {
      recorder.setRecording(false);
      recorder.setRecording(false);
      recorder.setRecording(false);
    }).not.toThrow();
  });

  it("should accept setTotalLaps(0) gracefully", () => {
    const recorder = new TelemetryRecorder();
    expect(() => recorder.setTotalLaps(0)).not.toThrow();
  });

  it("should accept setTotalLaps called multiple times", () => {
    const recorder = new TelemetryRecorder();
    expect(() => {
      recorder.setTotalLaps(3);
      recorder.setTotalLaps(5);
      recorder.setTotalLaps(10);
    }).not.toThrow();
  });
});
