import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EventMap,
  IEventBus,
  PitState,
  RaceResults,
} from "../../src/foundation/event-bus";
import { EventBus, EventBusError } from "../../src/foundation/event-bus";

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
// EventBus runtime — Story 002
// ---------------------------------------------------------------------------

describe("EventBus runtime", () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  // --- AC-1a: init/dispose lifecycle ---

  describe("AC-1a: init/dispose lifecycle", () => {
    it("should transition to Ready after init()", () => {
      bus.init();
      // Verify operational: subscribe and emit should work
      let received = false;
      bus.on("race.starting", () => {
        received = true;
      });
      bus.emit("race.starting", {});
      expect(received).toBe(true);
    });

    it("should transition to Disposed after dispose()", () => {
      bus.init();
      bus.dispose();
      // After dispose, emit should throw
      expect(() => bus.emit("race.starting", {})).toThrow(EventBusError);
    });
  });

  // --- AC-1b: Guards on uninitialized/disposed state ---

  describe("AC-1b: Guards on uninitialized/disposed state", () => {
    it("should throw 'Not initialized' when emit() called before init()", () => {
      expect(() => bus.emit("race.starting", {})).toThrow(EventBusError);
      expect(() => bus.emit("race.starting", {})).toThrow("Not initialized");
    });

    it("should throw 'Not initialized' when on() called before init()", () => {
      expect(() => bus.on("race.starting", () => {})).toThrow(EventBusError);
      expect(() => bus.on("race.starting", () => {})).toThrow(
        "Not initialized"
      );
    });

    it("should throw 'Already disposed' when emit() called after dispose()", () => {
      bus.init();
      bus.dispose();
      expect(() => bus.emit("race.starting", {})).toThrow(EventBusError);
      expect(() => bus.emit("race.starting", {})).toThrow("Already disposed");
    });

    it("should throw 'Already disposed' when on() called after dispose()", () => {
      bus.init();
      bus.dispose();
      expect(() => bus.on("race.starting", () => {})).toThrow(EventBusError);
      expect(() => bus.on("race.starting", () => {})).toThrow(
        "Already disposed"
      );
    });
  });

  // --- AC-1c: Idempotent init/dispose ---

  describe("AC-1c: Idempotent init/dispose", () => {
    it("should be safe to call init() twice", () => {
      bus.init();
      bus.init(); // No error
      // Existing subscriptions should remain intact
      let received = false;
      bus.on("race.starting", () => {
        received = true;
      });
      bus.emit("race.starting", {});
      expect(received).toBe(true);
    });

    it("should be safe to call dispose() twice", () => {
      bus.init();
      bus.dispose();
      bus.dispose(); // No error
    });
  });

  // --- AC-2: Basic subscribe + emit ---

  describe("AC-2: Basic subscribe + emit with correct payload", () => {
    it("should execute handler with correct payload", () => {
      bus.init();
      let result: EventMap["race.completed"] | undefined;
      bus.on("race.completed", (data) => {
        result = data;
      });

      const results: RaceResults = {
        positions: [{ carId: "car_01", position: 1, totalTime: 3600 }],
        fastestLap: { carId: "car_01", lapTime: 88.5 },
        totalLaps: 40,
      };
      bus.emit("race.completed", { results });

      expect(result).toBeDefined();
      expect(result?.results.totalLaps).toBe(40);
      expect(result?.results.fastestLap.carId).toBe("car_01");
    });

    it("should handle empty payload", () => {
      bus.init();
      let called = false;
      bus.on("race.starting", () => {
        called = true;
      });
      bus.emit("race.starting", {});
      expect(called).toBe(true);
    });
  });

  // --- AC-3: Multiple subscribers fire in registration order ---

  describe("AC-3: Multiple subscribers fire in registration order", () => {
    it("should execute handlers in registration order", () => {
      bus.init();
      const order: string[] = [];

      bus.on("race.starting", () => {
        order.push("A");
      });
      bus.on("race.starting", () => {
        order.push("B");
      });
      bus.on("race.starting", () => {
        order.push("C");
      });

      bus.emit("race.starting", {});

      expect(order).toEqual(["A", "B", "C"]);
    });

    it("should execute 25+ subscribers in registration order", () => {
      bus.init();
      const order: number[] = [];

      for (let i = 0; i < 30; i++) {
        bus.on("race.starting", () => {
          order.push(i);
        });
      }

      bus.emit("race.starting", {});

      expect(order).toHaveLength(30);
      expect(order).toEqual(Array.from({ length: 30 }, (_, i) => i));
    });
  });

  // --- AC-5: off() removes specific handler ---

  describe("AC-5: off() removes specific handler", () => {
    it("should not fire removed handler", () => {
      bus.init();
      const order: string[] = [];

      const subA = bus.on("race.starting", () => {
        order.push("A");
      });
      bus.on("race.starting", () => {
        order.push("B");
      });

      bus.off(subA);
      bus.emit("race.starting", {});

      expect(order).toEqual(["B"]);
    });

    it("should be safe to call off() twice (idempotent)", () => {
      bus.init();
      const order: string[] = [];

      const sub = bus.on("race.starting", () => {
        order.push("A");
      });
      bus.off(sub);
      bus.off(sub); // Second call — no error
      bus.emit("race.starting", {});

      expect(order).toEqual([]);
    });

    it("should not affect subscribers on different events", () => {
      bus.init();
      let raceStartCalled = false;
      let raceFinishCalled = false;

      const sub = bus.on("race.starting", () => {
        raceStartCalled = true;
      });
      bus.on("race.completed", () => {
        raceFinishCalled = true;
      });

      bus.off(sub); // Remove from race.starting only
      bus.emit("race.starting", {});
      bus.emit("race.completed", {
        results: {
          positions: [{ carId: "car_01", position: 1, totalTime: 3600 }],
          fastestLap: { carId: "car_01", lapTime: 88.5 },
          totalLaps: 40,
        },
      });

      expect(raceStartCalled).toBe(false);
      expect(raceFinishCalled).toBe(true);
    });
  });

  // --- AC-6: emit() with zero subscribers ---

  describe("AC-6: emit() with zero subscribers", () => {
    it("should succeed silently with no error", () => {
      bus.init();
      expect(() => bus.emit("race.starting", {})).not.toThrow();
    });

    it("should be callable 1000 times with 0 subscribers without leak", () => {
      bus.init();
      for (let i = 0; i < 1000; i++) {
        bus.emit("race.starting", {});
      }
      // If we get here without error, test passes
      expect(true).toBe(true);
    });

    it("should succeed after all subscribers removed", () => {
      bus.init();
      const sub = bus.on("race.starting", () => {});
      bus.off(sub);
      expect(() => bus.emit("race.starting", {})).not.toThrow();
    });
  });

  // --- AC-8: Handler throw does not prevent other handlers ---

  describe("AC-8: Handler throw does not prevent other handlers", () => {
    it("should execute all handlers even when some throw", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      bus.init();
      const log: string[] = [];

      bus.on("race.starting", () => {
        throw new Error("fail");
      });
      bus.on("race.starting", () => {
        log.push("B");
      });
      bus.on("race.starting", () => {
        throw new Error("fail2");
      });

      bus.emit("race.starting", {});

      expect(log).toEqual(["B"]);
      errorSpy.mockRestore();
    });

    it("should not propagate errors to emit() caller", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      bus.init();
      bus.on("race.starting", () => {
        throw new Error("boom");
      });
      expect(() => bus.emit("race.starting", {})).not.toThrow();
      errorSpy.mockRestore();
    });

    it("should catch non-Error thrown values", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      bus.init();
      const log: string[] = [];

      bus.on("race.starting", () => {
        throw "string error";
      });
      bus.on("race.starting", () => {
        log.push("ok");
      });

      bus.emit("race.starting", {});
      expect(log).toEqual(["ok"]);
      errorSpy.mockRestore();
    });

    it("should log each thrown handler via console.error", () => {
      bus.init();
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      bus.on("race.starting", () => {
        throw new Error("fail1");
      });
      bus.on("race.starting", () => {
        throw new Error("fail2");
      });

      bus.emit("race.starting", {});

      expect(errorSpy).toHaveBeenCalledTimes(2);
      errorSpy.mockRestore();
    });

    it("should not propagate when ALL handlers throw", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      bus.init();
      bus.on("race.starting", () => {
        throw new Error("fail1");
      });
      bus.on("race.starting", () => {
        throw new Error("fail2");
      });
      bus.on("race.starting", () => {
        throw new Error("fail3");
      });

      expect(() => bus.emit("race.starting", {})).not.toThrow();
      errorSpy.mockRestore();
    });
  });

  // --- Additional edge cases (QA gaps) ---

  describe("AC-1b extended: off() guards", () => {
    it("should throw 'Not initialized' when off() called before init()", () => {
      const sub = { unsubscribe: () => {} };
      expect(() => bus.off(sub)).toThrow(EventBusError);
      expect(() => bus.off(sub)).toThrow("Not initialized");
    });

    it("should throw 'Already disposed' when off() called after dispose()", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      bus.init();
      const sub = bus.on("race.starting", () => {});
      bus.dispose();
      expect(() => bus.off(sub)).toThrow(EventBusError);
      expect(() => bus.off(sub)).toThrow("Already disposed");
      warnSpy.mockRestore();
    });
  });

  describe("AC-1a extended: dispose() clears handlers", () => {
    it("should not fire handlers after dispose (state guard blocks emit)", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      bus.init();
      const log: string[] = [];
      bus.on("race.starting", () => log.push("before"));
      bus.dispose();

      // dispose clears _handlers internally; state guard also blocks emit
      expect(() => bus.emit("race.starting", {})).toThrow(EventBusError);
      expect(log).toEqual([]);
      warnSpy.mockRestore();
    });
  });

  describe("AC-1c extended: init() after dispose()", () => {
    it("should throw 'Already disposed' when init() called after dispose()", () => {
      bus.init();
      bus.dispose();
      expect(() => bus.init()).toThrow(EventBusError);
      expect(() => bus.init()).toThrow("Already disposed");
    });
  });

  describe("AC-2 extended: emit() return type", () => {
    it("should return undefined (void)", () => {
      bus.init();
      const result = bus.emit("race.starting", {});
      expect(result).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// EventBus edge cases — Story 003
// ---------------------------------------------------------------------------

describe("EventBus edge cases", () => {
  // --- AC-4a: once() fires exactly once ---

  describe("AC-4a: once() fires exactly once", () => {
    it("should fire handler on first emit and not on second", () => {
      const bus = new EventBus();
      bus.init();
      let callCount = 0;

      bus.once("race.starting", () => {
        callCount++;
      });

      bus.emit("race.starting", {});
      bus.emit("race.starting", {});

      expect(callCount).toBe(1);
    });

    it("should fire once alongside regular on() handlers", () => {
      const bus = new EventBus();
      bus.init();
      let onceCount = 0;
      let onCount = 0;

      bus.once("race.starting", () => {
        onceCount++;
      });
      bus.on("race.starting", () => {
        onCount++;
      });

      bus.emit("race.starting", {});
      bus.emit("race.starting", {});

      expect(onceCount).toBe(1);
      expect(onCount).toBe(2);
    });

    it("should not leak on dispose when once() handler never fires", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const bus = new EventBus();
      bus.init();
      bus.once("race.starting", () => {});

      // once() subscription should auto-clean on dispose (handler removed from Set)
      expect(() => bus.dispose()).not.toThrow();
      warnSpy.mockRestore();
    });
  });

  // --- AC-4b: off() on once()-returned Subscription ---

  describe("AC-4b: off() on once()-returned Subscription", () => {
    it("should prevent once() handler from firing if off() called before emit", () => {
      const bus = new EventBus();
      bus.init();
      let callCount = 0;

      const sub = bus.once("race.starting", () => {
        callCount++;
      });

      bus.off(sub);
      bus.emit("race.starting", {});

      expect(callCount).toBe(0);
    });

    it("should be safe to call off() twice on same once-Subscription (idempotent)", () => {
      const bus = new EventBus();
      bus.init();
      let callCount = 0;

      const sub = bus.once("race.starting", () => {
        callCount++;
      });

      bus.off(sub);
      bus.off(sub); // second call — no error
      bus.emit("race.starting", {});

      expect(callCount).toBe(0);
    });

    it("should be safe to call off() on a once-Subscription that already auto-unsubscribed", () => {
      const bus = new EventBus();
      bus.init();
      let callCount = 0;

      const sub = bus.once("race.starting", () => {
        callCount++;
      });

      bus.emit("race.starting", {}); // fires and auto-unsubscribes
      bus.off(sub); // already unsubscribed — no error, no throw

      expect(callCount).toBe(1);
    });
  });

  // --- AC-7a: Subscribe during dispatch does not receive current event ---

  describe("AC-7a: Subscribe during dispatch does not receive current event", () => {
    it("should not fire a handler subscribed during the current dispatch", () => {
      const bus = new EventBus();
      bus.init();
      const log: string[] = [];

      bus.on("race.starting", () => {
        log.push("A");
        // Subscribe B during A's execution
        bus.on("race.starting", () => {
          log.push("B");
        });
      });

      bus.emit("race.starting", {});

      expect(log).toEqual(["A"]);
    });

    it("should fire the late-subscribed handler on the next emit", () => {
      const bus = new EventBus();
      bus.init();
      const log: string[] = [];
      let subscribedB = false;

      bus.on("race.starting", () => {
        log.push("A");
        if (!subscribedB) {
          subscribedB = true;
          bus.on("race.starting", () => {
            log.push("B");
          });
        }
      });

      bus.emit("race.starting", {});
      bus.emit("race.starting", {});

      expect(log).toEqual(["A", "A", "B"]);
    });

    it("should handle multiple handlers subscribing new handlers during dispatch", () => {
      const bus = new EventBus();
      bus.init();
      const log: string[] = [];

      bus.on("race.starting", () => {
        log.push("A1");
        bus.on("race.starting", () => log.push("B"));
      });
      bus.on("race.starting", () => {
        log.push("A2");
        bus.on("race.starting", () => log.push("C"));
      });

      bus.emit("race.starting", {}); // A1, A2 run; B, C do NOT run
      bus.emit("race.starting", {}); // A1, A2, B, C all run

      expect(log).toEqual(["A1", "A2", "A1", "A2", "B", "C"]);
    });
  });

  // --- AC-7b: Unsubscribe during dispatch does not cancel current handler ---

  describe("AC-7b: Unsubscribe during dispatch does not cancel current handler", () => {
    it("should allow handler B to run even if A removes B during dispatch", () => {
      const bus = new EventBus();
      bus.init();
      const log: string[] = [];

      // A registered first, then B — A runs first in snapshot
      const _subA = bus.on("race.starting", () => {
        log.push("A");
        bus.off(subB); // remove B during A's execution
      });
      const subB = bus.on("race.starting", () => {
        log.push("B");
      });

      bus.emit("race.starting", {}); // A runs, B still runs (in snapshot)

      expect(log).toEqual(["A", "B"]);
    });

    it("should not fire B on next emit after A removed it during dispatch", () => {
      const bus = new EventBus();
      bus.init();
      const log: string[] = [];

      const _subA = bus.on("race.starting", () => {
        log.push("A");
        bus.off(subB);
      });
      const subB = bus.on("race.starting", () => {
        log.push("B");
      });

      bus.emit("race.starting", {}); // A + B (snapshot)
      bus.emit("race.starting", {}); // A only (B removed)

      expect(log).toEqual(["A", "B", "A"]);
    });

    it("should allow a handler to remove itself during dispatch and run to completion", () => {
      const bus = new EventBus();
      bus.init();
      const log: string[] = [];

      let selfSub: Subscription;
      selfSub = bus.on("race.starting", () => {
        log.push("self");
        bus.off(selfSub);
      });

      bus.emit("race.starting", {}); // runs to completion
      bus.emit("race.starting", {}); // removed — does not run

      expect(log).toEqual(["self"]);
    });

    it("should handle all handlers removing themselves during dispatch", () => {
      const bus = new EventBus();
      bus.init();
      const log: string[] = [];

      let subA: Subscription;
      let subB: Subscription;
      subA = bus.on("race.starting", () => {
        log.push("A");
        bus.off(subA);
      });
      subB = bus.on("race.starting", () => {
        log.push("B");
        bus.off(subB);
      });

      bus.emit("race.starting", {}); // both run
      bus.emit("race.starting", {}); // neither runs

      expect(log).toEqual(["A", "B"]);
    });
  });

  // --- AC-9a: Circular emit detection (default depth 10) ---

  describe("AC-9a: Circular emit detection (default depth 10)", () => {
    it("should throw at depth > 10 (depth exactly 10 succeeds)", () => {
      const bus = new EventBus();
      bus.init();

      // Simple A→B→A cycle — handler always re-emits, depth guard catches it
      bus.on("a", () => bus.emit("b", { carId: "test" }));
      bus.on("b", () => bus.emit("a", { carId: "test" }));

      // Depth 11 exceeds default limit of 10
      expect(() => bus.emit("a", { carId: "test" })).toThrow(EventBusError);
      expect(() => bus.emit("a", { carId: "test" })).toThrow(
        "Max emit depth exceeded"
      );
    });

    it("should reset depth after throw so subsequent emits work", () => {
      const bus = new EventBus();
      bus.init();
      let triggered = false;

      // Create a circular chain
      const subA = bus.on("a", () => bus.emit("b", { carId: "test" }));
      const subB = bus.on("b", () => bus.emit("a", { carId: "test" }));

      // This will throw at depth 11
      expect(() => bus.emit("a", { carId: "test" })).toThrow(
        "Max emit depth exceeded"
      );

      // Remove circular handlers so subsequent emit is non-circular
      bus.off(subA);
      bus.off(subB);

      // Depth should be reset — this normal emit should work
      bus.on("a", () => {
        triggered = true;
      });
      bus.emit("a", { carId: "test" });
      expect(triggered).toBe(true);
    });

    it("should detect cycles in 3+ event chains (A→B→C→A)", () => {
      const bus = new EventBus();
      bus.init();

      bus.on("a", () => bus.emit("b", { carId: "test" }));
      bus.on("b", () => bus.emit("c", { carId: "test" }));
      bus.on("c", () => bus.emit("a", { carId: "test" }));

      expect(() => bus.emit("a", { carId: "test" })).toThrow(
        "Max emit depth exceeded"
      );
    });
  });

  // --- AC-9b: Configurable max emit depth ---

  describe("AC-9b: Configurable max emit depth", () => {
    it("should throw at custom depth limit (maxEmitDepth=3)", () => {
      const bus = new EventBus({ maxEmitDepth: 3 });
      bus.init();

      bus.on("a", () => bus.emit("b", { carId: "test" }));
      bus.on("b", () => bus.emit("a", { carId: "test" }));

      // Depth 1: emit a → handler runs, emit b (depth 2) → handler runs, emit a (depth 3) → handler runs
      // Depth 4: emit b → throws
      expect(() => bus.emit("a", { carId: "test" })).toThrow(
        "Max emit depth exceeded"
      );
    });

    it("should succeed at depth exactly equal to maxEmitDepth", () => {
      const bus = new EventBus({ maxEmitDepth: 2 });
      bus.init();
      const log: string[] = [];

      // A emits B (depth 2 = maxEmitDepth, should succeed)
      bus.on("a", () => {
        log.push("a");
        bus.emit("b", { carId: "test" });
      });
      bus.on("b", () => {
        log.push("b");
      });

      bus.emit("a", { carId: "test" });
      expect(log).toEqual(["a", "b"]);
    });

    it("should use default maxEmitDepth=10 when no config provided", () => {
      const bus = new EventBus();
      bus.init();

      // Verify that an unbounded cycle does NOT throw at depth 10.
      // We track the actual depth via the depth guard's reset behavior:
      // if depth > 10, it throws; if not, it completes normally.
      // With A→B→A cycle and default maxEmitDepth=10, the 11th nested emit
      // throws. We verify the cycle completes 10 levels without error by
      // using a depth-limited chain that stops emitting at depth 10.
      let maxDepthReached = 0;

      // Manually track depth via a counter incremented per emit
      const depthCounter = { value: 0 };

      bus.on("a", () => {
        depthCounter.value++;
        maxDepthReached = Math.max(maxDepthReached, depthCounter.value);
        if (depthCounter.value < 10) {
          bus.emit("b", { carId: "test" });
        }
        depthCounter.value--;
      });
      bus.on("b", () => {
        depthCounter.value++;
        maxDepthReached = Math.max(maxDepthReached, depthCounter.value);
        if (depthCounter.value < 10) {
          bus.emit("a", { carId: "test" });
        }
        depthCounter.value--;
      });

      // Depth 10 succeeds — no throw
      expect(() => bus.emit("a", { carId: "test" })).not.toThrow();
      expect(maxDepthReached).toBe(10);
    });

    it("should throw at depth 11 with default config", () => {
      const bus = new EventBus();
      bus.init();

      // Unbounded cycle — always re-emits, depth guard catches at 11
      bus.on("a", () => bus.emit("b", { carId: "test" }));
      bus.on("b", () => bus.emit("a", { carId: "test" }));

      expect(() => bus.emit("a", { carId: "test" })).toThrow(
        "Max emit depth exceeded"
      );
    });

    it("should allow maxEmitDepth=1 (even a single nested emit throws)", () => {
      const bus = new EventBus({ maxEmitDepth: 1 });
      bus.init();

      bus.on("a", () => bus.emit("b", { carId: "test" }));
      bus.on("b", () => {});

      // Depth 1: emit a → handler runs, emit b (depth 2 > 1) → throws
      expect(() => bus.emit("a", { carId: "test" })).toThrow(
        "Max emit depth exceeded"
      );
    });
  });

  // --- AC-10a: Leak detection warns on dispose ---

  describe("AC-10a: Leak detection warns on dispose with active subscriptions", () => {
    it("should call console.warn when disposing with active subscriptions", () => {
      const bus = new EventBus();
      bus.init();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      bus.on("race.finish", () => {});
      bus.dispose();

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toContain("Leaked subscriptions");
      expect(warnSpy.mock.calls[0][0]).toContain("race");
      warnSpy.mockRestore();
    });

    it("should not warn when disposing with no active subscriptions", () => {
      const bus = new EventBus();
      bus.init();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      bus.dispose();

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("should identify multiple leaked namespaces", () => {
      const bus = new EventBus();
      bus.init();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      bus.on("race.finish", () => {});
      bus.on("car.fuel_empty", () => {});
      bus.on("pit.entry", () => {});
      bus.dispose();

      expect(warnSpy).toHaveBeenCalledTimes(1);
      const message = warnSpy.mock.calls[0][0] as string;
      expect(message).toContain("namespaces");
      expect(message).toContain("car");
      expect(message).toContain("pit");
      expect(message).toContain("race");
      warnSpy.mockRestore();
    });

    it("should warn with singular 'namespace' when only one event leaks", () => {
      const bus = new EventBus();
      bus.init();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      bus.on("race.finish", () => {});
      bus.dispose();

      const message = warnSpy.mock.calls[0][0] as string;
      expect(message).toContain("namespace");
      expect(message).not.toContain("namespaces");
      warnSpy.mockRestore();
    });
  });

  // --- AC-10b: Leak detection level silent suppresses warning ---

  describe("AC-10b: Leak detection level silent suppresses warning", () => {
    it("should NOT call console.warn when leakDetectionLevel is 'silent'", () => {
      const bus = new EventBus({ leakDetectionLevel: "silent" });
      bus.init();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      bus.on("race.finish", () => {});
      bus.dispose();

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("should default to warn level when no config provided", () => {
      const bus = new EventBus();
      bus.init();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      bus.on("race.finish", () => {});
      bus.dispose();

      expect(warnSpy).toHaveBeenCalledTimes(1);
      warnSpy.mockRestore();
    });
  });

  // --- Empty Set in Map: on() → unsubscribe → dispose should NOT warn ---

  // --- Subscribe to different event during dispatch is immediate ---

  describe("Subscribe to different event during dispatch is immediate", () => {
    it("should fire a handler subscribed to a different event during dispatch", () => {
      const bus = new EventBus();
      bus.init();
      const log: string[] = [];

      // Handler A subscribes B to a DIFFERENT event during its execution
      bus.on("race.starting", () => {
        log.push("A");
        bus.on("race.completed", () => {
          log.push("B");
        });
      });

      bus.emit("race.starting", {}); // A fires, subscribes B to race.completed
      // B's subscription was immediate and independent of race.starting dispatch
      bus.emit("race.completed", {
        results: {
          positions: [{ carId: "car_01", position: 1, totalTime: 3600 }],
          fastestLap: { carId: "car_01", lapTime: 88.5 },
          totalLaps: 40,
        },
      }); // B fires

      expect(log).toEqual(["A", "B"]);
    });
  });

  // --- once() handler calling on() for same event does not fire for current emit ---

  describe("once() handler calling on() for same event does not fire for current emit", () => {
    it("should not fire a handler subscribed via on() inside once() for the current emit", () => {
      const bus = new EventBus();
      bus.init();
      const log: string[] = [];

      bus.once("race.starting", () => {
        log.push("once");
        // Subscribe secondHandler via on() for the same event
        bus.on("race.starting", () => {
          log.push("second");
        });
      });

      bus.emit("race.starting", {}); // once fires, secondHandler registered but NOT in snapshot
      bus.emit("race.starting", {}); // secondHandler fires this time

      expect(log).toEqual(["once", "second"]);
    });
  });

  describe("Empty handler Set in Map after unsubscribe", () => {
    it("should not warn on dispose when all handlers were unsubscribed (empty Set remains in Map)", () => {
      const bus = new EventBus();
      bus.init();
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Subscribe — creates Set in _handlers Map
      const sub = bus.on("race.finish", () => {});
      // Unsubscribe — Set is now empty but key still exists in Map
      sub.unsubscribe();
      // dispose iterates _handlers, finds empty Set, should skip it
      bus.dispose();

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
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
