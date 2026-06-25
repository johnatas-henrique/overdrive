import { describe, expect, it } from "vitest";
import type {
  EventMap,
  IEventBus,
  PitState,
  RaceResults,
} from "../../src/foundation/event-bus";
import { EventBusError } from "../../src/foundation/event-bus";

// ---------------------------------------------------------------------------
// EventMap type correctness
// ---------------------------------------------------------------------------

describe("EventMap type correctness", () => {
  it("should accept valid payload for gsm.state.entered", () => {
    const payload: EventMap["gsm.state.entered"] = {
      state: "Racing",
      previous: "Grid",
    };
    expect(payload.state).toBe("Racing");
    expect(payload.previous).toBe("Grid");
  });

  it("should accept valid payload for gsm.state.exited", () => {
    const payload: EventMap["gsm.state.exited"] = {
      state: "Grid",
      next: "Racing",
    };
    expect(payload.state).toBe("Grid");
    expect(payload.next).toBe("Racing");
  });

  it("should accept valid payload for entity.spawned", () => {
    const payload: EventMap["entity.spawned"] = { carId: "car_01" };
    expect(payload.carId).toBe("car_01");
  });

  it("should accept valid payload for entity.despawned", () => {
    const payload: EventMap["entity.despawned"] = { carId: "car_01" };
    expect(payload.carId).toBe("car_01");
  });

  it("should accept valid payload for collision.impact", () => {
    const payload: EventMap["collision.impact"] = {
      carIdA: "car_01",
      carIdB: "car_03",
      impulse: 4500.5,
    };
    expect(payload.carIdA).toBe("car_01");
    expect(payload.carIdB).toBe("car_03");
    expect(payload.impulse).toBe(4500.5);
  });

  it("should accept valid payload for car.fuel_empty", () => {
    const payload: EventMap["car.fuel_empty"] = { carId: "player" };
    expect(payload.carId).toBe("player");
  });

  it("should accept valid payload for car.tire_blown", () => {
    const payload: EventMap["car.tire_blown"] = { carId: "car_05" };
    expect(payload.carId).toBe("car_05");
  });

  it("should accept valid payload for car.stopped", () => {
    const payload: EventMap["car.stopped"] = { carId: "car_02" };
    expect(payload.carId).toBe("car_02");
  });

  it("should accept valid payload for pit.entry", () => {
    const payload: EventMap["pit.entry"] = { carId: "car_07" };
    expect(payload.carId).toBe("car_07");
  });

  it("should accept valid payload for pit.exit", () => {
    const payload: EventMap["pit.exit"] = { carId: "car_07" };
    expect(payload.carId).toBe("car_07");
  });

  it("should accept valid payload for pit.status", () => {
    const payload: EventMap["pit.status"] = {
      carId: "car_04",
      status: "pitStopped",
    };
    expect(payload.carId).toBe("car_04");
    expect(payload.status).toBe("pitStopped");
  });

  it("should accept valid payload for pit.fuel_status", () => {
    const payload: EventMap["pit.fuel_status"] = {
      carId: "car_04",
      progress: 0.65,
    };
    expect(payload.carId).toBe("car_04");
    expect(payload.progress).toBeCloseTo(0.65);
  });

  it("should accept valid payload for pit.tire_status", () => {
    const payload: EventMap["pit.tire_status"] = {
      carId: "car_04",
      progress: 0.3,
    };
    expect(payload.carId).toBe("car_04");
    expect(payload.progress).toBeCloseTo(0.3);
  });

  it("should accept valid payload for position.changed", () => {
    const payload: EventMap["position.changed"] = {
      carId: "car_01",
      old: 3,
      new: 2,
    };
    expect(payload.carId).toBe("car_01");
    expect(payload.old).toBe(3);
    expect(payload.new).toBe(2);
  });

  it("should accept valid payload for car.lap.completed", () => {
    const payload: EventMap["car.lap.completed"] = {
      carId: "car_01",
      lap: 5,
      lapTime: 92.34,
    };
    expect(payload.carId).toBe("car_01");
    expect(payload.lap).toBe(5);
    expect(payload.lapTime).toBeCloseTo(92.34);
  });

  it("should accept valid payload for car.dnf", () => {
    const payload: EventMap["car.dnf"] = {
      carId: "car_06",
      reason: "engine failure",
    };
    expect(payload.carId).toBe("car_06");
    expect(payload.reason).toBe("engine failure");
  });

  it("should accept valid payload for car.stalled_in_pit", () => {
    const payload: EventMap["car.stalled_in_pit"] = { carId: "car_08" };
    expect(payload.carId).toBe("car_08");
  });

  it("should accept empty payload for race.starting", () => {
    const payload: EventMap["race.starting"] = {};
    expect(payload).toEqual({});
  });

  it("should accept valid payload for race.light.countdown", () => {
    const payload: EventMap["race.light.countdown"] = { lightsOn: 3 };
    expect(payload.lightsOn).toBe(3);
  });

  it("should accept empty payload for race.green.flag", () => {
    const payload: EventMap["race.green.flag"] = {};
    expect(payload).toEqual({});
  });

  it("should accept valid payload for race.completed", () => {
    const results: RaceResults = {
      positions: [
        { carId: "car_01", position: 1, totalTime: 3620.5 },
        { carId: "car_03", position: 2, totalTime: 3621.8 },
      ],
      fastestLap: { carId: "car_01", lapTime: 89.2 },
      totalLaps: 40,
    };
    const payload: EventMap["race.completed"] = { results };
    expect(payload.results.positions).toHaveLength(2);
    expect(payload.results.fastestLap.carId).toBe("car_01");
    expect(payload.results.totalLaps).toBe(40);
  });

  it("should accept valid payload for race.checkered", () => {
    const results: RaceResults = {
      positions: [{ carId: "car_01", position: 1, totalTime: 3620.5 }],
      fastestLap: { carId: "car_01", lapTime: 89.2 },
      totalLaps: 40,
    };
    const payload: EventMap["race.checkered"] = {
      carId: "car_01",
      lap: 40,
      results,
    };
    expect(payload.carId).toBe("car_01");
    expect(payload.lap).toBe(40);
    expect(payload.results.totalLaps).toBe(40);
  });

  it("should accept empty payload for race.abandoned", () => {
    const payload: EventMap["race.abandoned"] = {};
    expect(payload).toEqual({});
  });

  it("should accept valid payload for asset.error", () => {
    const payload: EventMap["asset.error"] = {
      assetId: "car_ferrari_01",
      error: new Error("File not found"),
    };
    expect(payload.assetId).toBe("car_ferrari_01");
    expect(payload.error).toBeInstanceOf(Error);
    expect(payload.error.message).toBe("File not found");
  });
});

describe("PitState values", () => {
  it("should accept all four pit states", () => {
    const states: PitState[] = [
      "onTrack",
      "pitEntry",
      "pitStopped",
      "departing",
    ];
    expect(states).toHaveLength(4);
  });

  it("should work as payload for pit.status event", () => {
    const statuses: Array<EventMap["pit.status"]> = [
      { carId: "car_01", status: "onTrack" },
      { carId: "car_01", status: "pitEntry" },
      { carId: "car_01", status: "pitStopped" },
      { carId: "car_01", status: "departing" },
    ];
    expect(statuses).toHaveLength(4);
    expect(statuses[0].status).toBe("onTrack");
    expect(statuses[1].status).toBe("pitEntry");
    expect(statuses[2].status).toBe("pitStopped");
    expect(statuses[3].status).toBe("departing");
  });
});

describe("RaceResults shape", () => {
  it("should accept a full RaceResults object", () => {
    const results: RaceResults = {
      positions: [
        { carId: "car_01", position: 1, totalTime: 3600.0 },
        { carId: "car_03", position: 2, totalTime: 3601.5 },
        { carId: "car_05", position: 3, totalTime: 3603.2 },
      ],
      fastestLap: { carId: "car_01", lapTime: 88.5 },
      totalLaps: 40,
    };

    expect(results.positions).toHaveLength(3);
    expect(results.positions[0].carId).toBe("car_01");
    expect(results.positions[0].position).toBe(1);
    expect(results.positions[0].totalTime).toBe(3600.0);
    expect(results.fastestLap.lapTime).toBeCloseTo(88.5);
    expect(results.totalLaps).toBe(40);
  });

  it("should accept a single-position RaceResults (minimum viable)", () => {
    const results: RaceResults = {
      positions: [{ carId: "car_01", position: 1, totalTime: 3600.0 }],
      fastestLap: { carId: "car_01", lapTime: 88.5 },
      totalLaps: 1,
    };
    expect(results.positions).toHaveLength(1);
    expect(results.totalLaps).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TS compile-time checks (tsc --noEmit)
// ---------------------------------------------------------------------------

describe("TS compile-time checks (tsc --noEmit)", () => {
  it("should reject wrong payload type at compile time (AC-11a)", () => {
    // @ts-expect-error — "foo" is not a number, should fail at compile time
    const _a: EventMap["race.light.countdown"] = { lightsOn: "foo" };
    void _a;
  });

  it("should reject missing required payload fields at compile time (AC-11a)", () => {
    // @ts-expect-error — missing `position` field in RaceResults entry
    const _b: RaceResults["positions"][number] = { carId: "car_01" };
    void _b;
  });

  it("should reject non-existent event key in emit/on (AC-11c)", () => {
    // @ts-expect-error — 'nonexistent' is not a key of EventMap
    type _Check = EventMap["nonexistent"];
  });

  it("should accept valid event name in emit (AC-11c positive)", () => {
    // Compiles if key exists — no runtime assertion needed
    type _Check = EventMap["car.fuel_empty"];
    void 0 as unknown as _Check;
  });

  it("should accept valid event name and payload (AC-11b)", () => {
    const _e: EventMap["car.fuel_empty"] = { carId: "player" };
    expect(_e.carId).toBe("player");
  });

  it("should ensure IEventBus.on handler receives correct payload type (AC-11b)", () => {
    // @ts-expect-error — payload type mismatch between { carId: string } and { carId: number }
    const _cb: (p: EventMap["car.fuel_empty"]) => void = (p: {
      carId: number;
    }) => {
      void p;
    };
    void _cb;
  });

  it("should reject extra properties in payload (exact type check)", () => {
    // @ts-expect-error — 'extraField' is not part of the payload type
    const _f: EventMap["pit.entry"] = { carId: "car_01", extraField: true };
    void _f;
  });
});

// ---------------------------------------------------------------------------
// EventBusError
// ---------------------------------------------------------------------------

describe("EventBusError", () => {
  it("should construct with a message", () => {
    const err = new EventBusError("Max emit depth exceeded");
    expect(err.message).toBe("Max emit depth exceeded");
  });

  it("should have name set to EventBusError", () => {
    const err = new EventBusError("test");
    expect(err.name).toBe("EventBusError");
  });

  it("should be an instance of Error", () => {
    const err = new EventBusError("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("should be an instance of EventBusError", () => {
    const err = new EventBusError("test");
    expect(err).toBeInstanceOf(EventBusError);
  });

  it("should capture stack trace", () => {
    const err = new EventBusError("test");
    expect(err.stack).toBeDefined();
  });

  it("should have empty message when called without arguments", () => {
    const err = new EventBusError("");
    expect(err.message).toBe("");
  });

  it("should preserve message with special characters", () => {
    const err = new EventBusError("error: circular emit (depth=10)");
    expect(err.message).toBe("error: circular emit (depth=10)");
  });
});

// ---------------------------------------------------------------------------
// IEventBus interface structural checks
// ---------------------------------------------------------------------------

describe("IEventBus interface", () => {
  // Test double: no Event Bus runtime exists in Story 001 (types only)
  const createMockBus = (): IEventBus => ({
    on: () => ({ unsubscribe: () => {} }),
    once: () => ({ unsubscribe: () => {} }),
    emit: () => {},
    off: () => {},
    dispose: () => {},
  });

  it("should define an on method returning Subscription", () => {
    const bus = createMockBus();
    const sub = bus.on("race.starting", () => {});
    expect(typeof sub.unsubscribe).toBe("function");
  });

  it("should define a once method returning Subscription", () => {
    const bus = createMockBus();
    const sub = bus.once("race.green.flag", () => {});
    expect(typeof sub.unsubscribe).toBe("function");
  });

  it("should define an emit method", () => {
    const bus = createMockBus();
    expect(typeof bus.emit).toBe("function");
  });

  it("should define an off method", () => {
    const bus = createMockBus();
    expect(typeof bus.off).toBe("function");
  });

  it("should define a dispose method", () => {
    const bus = createMockBus();
    expect(typeof bus.dispose).toBe("function");
  });

  it("should type-check on() payload with RaceResults events", () => {
    const bus = createMockBus();
    bus.on("race.completed", (payload) => {
      expect(typeof payload.results.totalLaps).toBe("number");
    });
  });

  it("should type-check on() payload with empty events", () => {
    const bus = createMockBus();
    bus.on("race.starting", (payload) => {
      expect(payload).toEqual({});
    });
  });

  it("should emit to an event with empty payload", () => {
    const bus = createMockBus();
    // Verifies the emit signature accepts Record<string, never>
    bus.emit("race.starting", {});
  });
});

// ---------------------------------------------------------------------------
// Zero imports — verify Event Bus source files have no external deps
// ---------------------------------------------------------------------------

describe("Zero imports", () => {
  it("should have zero imports from @babylonjs in types.ts", async () => {
    const content = await readSourceFile("src/foundation/event-bus/types.ts");
    expect(hasForbiddenImport(content)).toBe(false);
  });

  it("should have zero imports from @babylonjs in errors.ts", async () => {
    const content = await readSourceFile("src/foundation/event-bus/errors.ts");
    expect(hasForbiddenImport(content)).toBe(false);
  });

  it("should have zero imports from @babylonjs in index.ts", async () => {
    const content = await readSourceFile("src/foundation/event-bus/index.ts");
    expect(hasForbiddenImport(content)).toBe(false);
  });

  it("should have zero imports from any npm package in types.ts", async () => {
    const content = await readSourceFile("src/foundation/event-bus/types.ts");
    expect(content).not.toContain("from '@");
    expect(content).not.toContain('from "npm:');
  });

  it("should have zero imports from any npm package in errors.ts", async () => {
    const content = await readSourceFile("src/foundation/event-bus/errors.ts");
    expect(content).not.toContain("from '@");
    expect(content).not.toContain('from "npm:');
  });

  it("should have zero imports from any npm package in index.ts", async () => {
    const content = await readSourceFile("src/foundation/event-bus/index.ts");
    expect(content).not.toContain("from '@");
    expect(content).not.toContain('from "npm:');
  });

  it("should allow local sibling imports in index.ts", async () => {
    const content = await readSourceFile("src/foundation/event-bus/index.ts");
    expect(content).toContain("./errors");
    expect(content).toContain("./types");
  });

  it("should allow standard TypeScript lib references in types.ts", async () => {
    const content = await readSourceFile("src/foundation/event-bus/types.ts");
    // Should not have any runtime imports from external packages
    const lines = content.split("\n");
    const importLines = lines.filter((l) =>
      l.trimStart().startsWith("import ")
    );
    // types.ts is pure types — no imports at all
    expect(importLines).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read a source file relative to project root via dynamic import.
 * Vitest with node environment can read files directly.
 */
async function readSourceFile(relativePath: string): Promise<string> {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const fullPath = path.resolve(__dirname, "../../", relativePath);
  return fs.readFileSync(fullPath, "utf-8");
}

/**
 * Check if file content contains a forbidden import.
 * Forbidden = any import from @babylonjs or npm packages (starting with '@').
 */
function hasForbiddenImport(content: string): boolean {
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // Only check actual import/export from statements
    if (trimmed.startsWith("import ") || trimmed.startsWith("export ")) {
      // Allow local imports (starting with ./ or ../)
      if (trimmed.includes("from './") || trimmed.includes('from "./'))
        continue;
      if (trimmed.includes("from '../") || trimmed.includes('from "..'))
        continue;

      // Any other 'from' is a forbidden package import
      if (trimmed.includes(" from ")) return true;
    }
  }
  return false;
}
