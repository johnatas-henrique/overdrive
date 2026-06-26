import { describe, expect, it } from "vitest";
import {
  type FullGameSnapshot,
  fnv1a,
  type ISnapshotable,
  SimulationSnapshot,
  SnapshotError,
} from "../../src/foundation/simulation-snapshot";

// ---------------------------------------------------------------------------
// Test system — concrete ISnapshotable implementation
// ---------------------------------------------------------------------------

class TestSnapshotSystem implements ISnapshotable {
  readonly systemId: string;
  private state: Record<string, unknown>;
  /** Tracks calls to `serialize()` — used by AC-10 to verify dispose calls it. */
  serializeCallCount = 0;

  constructor(systemId: string, initialState?: Record<string, unknown>) {
    this.systemId = systemId;
    this.state = initialState ? { ...initialState } : {};
  }

  serialize(): Record<string, unknown> {
    this.serializeCallCount++;
    return { ...this.state };
  }

  deserialize(state: Record<string, unknown>): void {
    this.state = JSON.parse(JSON.stringify(state));
  }

  hash(): string {
    return fnv1a(JSON.stringify(this.serialize()));
  }
}

// ---------------------------------------------------------------------------
// AC-1: ISnapshotable interface definition
// ---------------------------------------------------------------------------

describe("AC-1: ISnapshotable interface", () => {
  it("should define a system with all 4 members", () => {
    const system: ISnapshotable = new TestSnapshotSystem("test");
    // Compile-time check: ISnapshotable is implemented.
    // Runtime: verify all 4 members are present and typed correctly.
    expect(system.systemId).toBe("test");
    expect(typeof system.serialize).toBe("function");
    expect(typeof system.deserialize).toBe("function");
    expect(typeof system.hash).toBe("function");
  });

  it("should have readonly systemId — enforced at compile time", () => {
    const system: ISnapshotable = new TestSnapshotSystem("physics");
    // Read access is fine
    expect(system.systemId).toBe("physics");
    // @ts-expect-error — readonly prevents assignment at compile time
    system.systemId = "mutated";
  });

  it("should accept any string for systemId", () => {
    const a = new TestSnapshotSystem("physics");
    const b = new TestSnapshotSystem("fuel-system");
    const c = new TestSnapshotSystem("");
    expect(a.systemId).toBe("physics");
    expect(b.systemId).toBe("fuel-system");
    expect(c.systemId).toBe("");
  });

  it("should type serialize() as Record<string, unknown>", () => {
    const system: ISnapshotable = new TestSnapshotSystem("tire");
    const state: Record<string, unknown> = system.serialize();
    expect(state).toEqual({});
  });

  it("should type deserialize() as (state: Record<string, unknown>) => void", () => {
    const system: ISnapshotable = new TestSnapshotSystem("test");
    // Should accept any Record<string, unknown> and return undefined
    const result: undefined = system.deserialize({ a: 1 });
    expect(result).toBeUndefined();
  });

  it("should type hash() as () => string", () => {
    const system: ISnapshotable = new TestSnapshotSystem("test");
    const hash: string = system.hash();
    expect(typeof hash).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// AC-2: Concrete test system serializes and deserializes state
// ---------------------------------------------------------------------------

describe("AC-2: concrete test system serialize/deserialize round-trip", () => {
  it("should serialize initial state", () => {
    const system = new TestSnapshotSystem("test", { value: 42, label: "test" });
    expect(system.serialize()).toEqual({ value: 42, label: "test" });
  });

  it("should deserialize and restore state", () => {
    const system = new TestSnapshotSystem("test", { value: 42, label: "test" });
    system.deserialize({ value: 99, label: "updated" });
    expect(system.serialize()).toEqual({ value: 99, label: "updated" });
  });

  it("should round-trip identical state through serialize→deserialize→serialize", () => {
    const system = new TestSnapshotSystem("test", { x: 1, y: 2 });
    const state = system.serialize();
    system.deserialize(state);
    expect(system.serialize()).toEqual({ x: 1, y: 2 });
  });

  it("should handle state with nested objects", () => {
    const system = new TestSnapshotSystem("test", {
      position: { x: 10, y: 20 },
    });
    system.deserialize({ position: { x: 99, y: 200 } });
    expect(system.serialize()).toEqual({ position: { x: 99, y: 200 } });
  });

  it("should handle state with arrays", () => {
    const system = new TestSnapshotSystem("test", {
      lapTimes: [90.5, 91.2, 88.7],
    });
    system.deserialize({ lapTimes: [95.0, 94.3] });
    expect(system.serialize()).toEqual({ lapTimes: [95.0, 94.3] });
  });

  it("should handle empty state {}", () => {
    const system = new TestSnapshotSystem("test", { a: 1 });
    system.deserialize({});
    expect(system.serialize()).toEqual({});
  });

  it("should handle state with null values", () => {
    const system = new TestSnapshotSystem("test", { a: null });
    expect(system.serialize()).toEqual({ a: null });
    system.deserialize({ a: "replaced", b: null });
    expect(system.serialize()).toEqual({ a: "replaced", b: null });
  });

  it("should return a copy of state (not a reference)", () => {
    const system = new TestSnapshotSystem("test", { value: 42 });
    const state = system.serialize();
    // Mutating the returned object should not affect internal state
    state.value = 99;
    expect(system.serialize()).toEqual({ value: 42 });
  });

  it("should not share references after deserialize", () => {
    const system = new TestSnapshotSystem("test", {});
    const external = { data: "original" };
    system.deserialize({ ref: external });
    // Mutating external should not affect the system's state
    external.data = "mutated";
    expect(system.serialize()).toEqual({ ref: { data: "original" } });
  });

  it("should preserve boolean and number primitives through round-trip", () => {
    const system = new TestSnapshotSystem("test", {
      int: 42,
      float: 3.14,
      bool: true,
      negative: -1,
      zero: 0,
    });
    const state = system.serialize();
    system.deserialize(state);
    expect(system.serialize()).toEqual({
      int: 42,
      float: 3.14,
      bool: true,
      negative: -1,
      zero: 0,
    });
  });

  it("should handle multiple deserialize calls sequentially", () => {
    const system = new TestSnapshotSystem("test", { v: 0 });
    system.deserialize({ v: 1 });
    expect(system.serialize()).toEqual({ v: 1 });
    system.deserialize({ v: 2 });
    expect(system.serialize()).toEqual({ v: 2 });
    system.deserialize({});
    expect(system.serialize()).toEqual({});
  });

  it("should work with systemId 'test-system' and complex nested arrays", () => {
    const system = new TestSnapshotSystem("test-system", {
      grid: [
        [1, 2],
        [3, 4],
      ],
      meta: { name: "test" },
    });
    const state = system.serialize();
    expect(state).toEqual({
      grid: [
        [1, 2],
        [3, 4],
      ],
      meta: { name: "test" },
    });
  });
});

// ---------------------------------------------------------------------------
// AC-3: fnv1a returns 16-character hex string
// ---------------------------------------------------------------------------

const HEX16_RE = /^[0-9a-f]{16}$/;

describe("AC-3: fnv1a returns 16-character hex string", () => {
  it('should return 16-char hex for "hello"', () => {
    const result = fnv1a("hello");
    expect(result).toMatch(HEX16_RE);
  });

  it('should return 16-char hex for "" (empty string)', () => {
    const result = fnv1a("");
    expect(result).toMatch(HEX16_RE);
  });

  it('should return 16-char hex for single character "a"', () => {
    const result = fnv1a("a");
    expect(result).toMatch(HEX16_RE);
  });

  it("should return 16-char hex for unicode characters (ñ, ü, 中文)", () => {
    const result = fnv1a("ññoñoü中文");
    expect(result).toMatch(HEX16_RE);
  });

  it("should return 16-char hex for large JSON string (~10KB)", () => {
    const large = JSON.stringify({
      key: "x".repeat(10000),
      arr: Array.from({ length: 100 }, (_, i) => i),
    });
    const result = fnv1a(large);
    expect(result).toMatch(HEX16_RE);
  });

  it("should return 16-char hex for a very long string (100k chars)", () => {
    const longStr = "a".repeat(100000);
    const result = fnv1a(longStr);
    expect(result).toMatch(HEX16_RE);
  });

  it("should return 16-char hex for strings with special characters", () => {
    expect(fnv1a("tab\tseparated")).toMatch(HEX16_RE);
    expect(fnv1a("newline\nseparated")).toMatch(HEX16_RE);
    expect(fnv1a("\0null char")).toMatch(HEX16_RE);
  });

  it("should return 16-char hex for a JSON blob with nested structure", () => {
    const jsonBlob = JSON.stringify({
      players: [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ],
      settings: { volume: 0.8, muted: false },
    });
    const result = fnv1a(jsonBlob);
    expect(result).toMatch(HEX16_RE);
  });
});

// ---------------------------------------------------------------------------
// AC-4: fnv1a is deterministic — same input → same output
// ---------------------------------------------------------------------------

describe("AC-4: fnv1a determinism — same input, same output", () => {
  it('should return identical hash for "test data" over 1000 calls', () => {
    const expected = fnv1a("test data");
    for (let i = 0; i < 1000; i++) {
      expect(fnv1a("test data")).toBe(expected);
    }
  });

  it('should return identical hash for "" (empty string) every time', () => {
    const expected = fnv1a("");
    for (let i = 0; i < 100; i++) {
      expect(fnv1a("")).toBe(expected);
    }
  });

  it("should be deterministic for large 10KB blob across 100 calls", () => {
    const large = "x".repeat(10240);
    const expected = fnv1a(large);
    for (let i = 0; i < 100; i++) {
      expect(fnv1a(large)).toBe(expected);
    }
  });

  it("should be deterministic for unicode across multiple calls", () => {
    const expected = fnv1a("🏎️ 💨 overdrive 🏁");
    for (let i = 0; i < 50; i++) {
      expect(fnv1a("🏎️ 💨 overdrive 🏁")).toBe(expected);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-5: Different inputs produce different hashes (no collisions on 20+)
// ---------------------------------------------------------------------------

describe("AC-5: different inputs produce different hashes", () => {
  it("should produce unique hashes for 20+ distinct inputs", () => {
    const inputs: string[] = [
      // Empty and single char
      "",
      "a",
      "b",
      // Similar strings
      "abc",
      "abd",
      "ABC",
      "abc ",
      " abc",
      // Common words and variants
      "hello",
      "world",
      "Hello",
      "hello!",
      "hello\n",
      // Numbers as strings
      "0",
      "1",
      "10",
      // Unicode and special chars
      "unicode: ñoño",
      "emoji: 🏎️",
      "tab\tseparated",
      "newline\nseparated",
      // JSON-like strings
      '{"a":1}',
      '{"a":2}',
      '{"b":1}',
      // Large strings
      "a".repeat(1000),
      "a".repeat(1001),
      "b".repeat(1000),
    ];

    expect(inputs.length).toBeGreaterThanOrEqual(20);
    const hashes = inputs.map((input) => fnv1a(input));
    const unique = new Set(hashes);

    expect(unique.size).toBe(inputs.length);
  });

  it("should produce unique hashes for 25 sensible game-state strings", () => {
    const gameStates: string[] = [
      JSON.stringify({ tick: 0, fuel: 100, speed: 0 }),
      JSON.stringify({ tick: 1, fuel: 99.8, speed: 10 }),
      JSON.stringify({ tick: 2, fuel: 99.6, speed: 25 }),
      JSON.stringify({ tick: 3, fuel: 99.3, speed: 40 }),
      JSON.stringify({ tick: 4, fuel: 95.0, speed: 50 }),
      JSON.stringify({ tick: 5, fuel: 90.0, speed: 60 }),
      JSON.stringify({ tick: 6, fuel: 85.0, speed: 55 }),
      JSON.stringify({ tick: 7, fuel: 80.0, speed: 70 }),
      JSON.stringify({ tick: 8, fuel: 75.0, speed: 80 }),
      JSON.stringify({ tick: 9, fuel: 70.0, speed: 90 }),
      JSON.stringify({ tick: 10, fuel: 65.0, speed: 100 }),
      JSON.stringify({ tick: 0, fuel: 100, speed: 0, brake: true }),
      JSON.stringify({ tick: 1, fuel: 99.9, speed: 5, brake: false }),
      JSON.stringify({ tick: 0, position: { x: 0, y: 0, z: 0 } }),
      JSON.stringify({ tick: 1, position: { x: 1.5, y: 0, z: 3 } }),
      JSON.stringify({ tick: 2, position: { x: 3.0, y: 0.1, z: 6 } }),
      JSON.stringify({ tick: 0, tireTemp: [80, 82, 79, 81] }),
      JSON.stringify({ tick: 1, tireTemp: [82, 84, 80, 83] }),
      JSON.stringify({ tick: 2, tireTemp: [85, 88, 83, 86] }),
      JSON.stringify({ lap: 1, splits: [30.5, 60.2, 95.1] }),
      JSON.stringify({ lap: 2, splits: [29.8, 59.5, 94.0] }),
      JSON.stringify({ lap: 3, splits: [29.2, 58.9, 92.8] }),
      JSON.stringify({ activePowerUps: [] }),
      JSON.stringify({ activePowerUps: ["nitro"] }),
      JSON.stringify({ activePowerUps: ["nitro", "shield"] }),
    ];

    expect(gameStates.length).toBeGreaterThanOrEqual(20);
    const hashes = gameStates.map((s) => fnv1a(s));
    const unique = new Set(hashes);

    expect(unique.size).toBe(gameStates.length);
  });

  it('should differ for "abc" vs "abd" (single char difference)', () => {
    expect(fnv1a("abc")).not.toBe(fnv1a("abd"));
  });

  it('should differ for "abc" vs "ABC" (case difference)', () => {
    expect(fnv1a("abc")).not.toBe(fnv1a("ABC"));
  });

  it('should differ for "abc" vs "abc " (trailing whitespace)', () => {
    expect(fnv1a("abc")).not.toBe(fnv1a("abc "));
  });

  it("should differ for empty string vs single char", () => {
    expect(fnv1a("")).not.toBe(fnv1a(" "));
    expect(fnv1a("")).not.toBe(fnv1a("a"));
  });
});

// ---------------------------------------------------------------------------
// AC-6: hash() delegates to fnv1a(JSON.stringify(serialize()))
// ---------------------------------------------------------------------------

describe("AC-6: hash() delegates to fnv1a(JSON.stringify(serialize()))", () => {
  it("should produce the same hash as calling fnv1a directly", () => {
    const system = new TestSnapshotSystem("test", { x: 1, y: 2 });
    const expected = fnv1a(JSON.stringify({ x: 1, y: 2 }));
    expect(system.hash()).toBe(expected);
  });

  it("should produce same hash for same state across separate instances", () => {
    const a = new TestSnapshotSystem("test", { value: 42 });
    const b = new TestSnapshotSystem("test", { value: 42 });
    expect(a.hash()).toBe(b.hash());
  });

  it("should change when state is modified via deserialize", () => {
    const system = new TestSnapshotSystem("test", { value: 1 });
    const hashA = system.hash();
    system.deserialize({ value: 2 });
    const hashB = system.hash();
    expect(hashA).not.toBe(hashB);
  });

  it("should return same hash after round-trip serialize→deserialize→serialize", () => {
    const system = new TestSnapshotSystem("test", { fuel: 50, speed: 100 });

    // Hash before mutation
    const hashBefore = system.hash();

    // Mutate then restore
    system.deserialize({ fuel: 0, speed: 0 });
    system.deserialize({ fuel: 50, speed: 100 });

    // Hash should match original
    expect(system.hash()).toBe(hashBefore);
  });

  it("should match fnv1a(JSON.stringify(serialize())) precisely", () => {
    const system = new TestSnapshotSystem("test", {
      nested: { arr: [1, 2, 3] },
      flag: false,
      label: "hello",
    });
    const direct = fnv1a(JSON.stringify(system.serialize()));
    expect(system.hash()).toBe(direct);
  });

  it("should update hash after multiple deserialize calls", () => {
    const system = new TestSnapshotSystem("test", { v: 0 });
    const hashes = new Set<string>();

    for (let i = 0; i < 10; i++) {
      system.deserialize({ v: i });
      hashes.add(system.hash());
    }

    // All 10 hashes should be unique (different states)
    expect(hashes.size).toBe(10);
  });

  it("should handle empty state hash delegation", () => {
    const system = new TestSnapshotSystem("empty-test");
    const expected = fnv1a(JSON.stringify({}));
    expect(system.hash()).toBe(expected);
  });

  it("should handle state with null values hash delegation", () => {
    const system = new TestSnapshotSystem("test", { a: null, b: 0 });
    const expected = fnv1a(JSON.stringify({ a: null, b: 0 }));
    expect(system.hash()).toBe(expected);
  });

  it("should handle state with boolean and number edge cases", () => {
    const system = new TestSnapshotSystem("test", {
      int: 0,
      float: -0.0,
      bool: false,
      neg: -1,
    });
    const expected = fnv1a(JSON.stringify(system.serialize()));
    expect(system.hash()).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Zero dependencies (implied by AC constraints)
// ---------------------------------------------------------------------------

describe("Zero engine dependencies", () => {
  it("should be instantiatable without any Babylon.js imports", () => {
    // Verify fnv1a is a pure function with no engine dependency
    const result = fnv1a("test");
    expect(result).toMatch(HEX16_RE);
  });

  it("should implement ISnapshotable without engine imports", () => {
    const system: ISnapshotable = new TestSnapshotSystem("standalone");
    expect(system.hash()).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Known FNV-1a test vectors (regression)
// ---------------------------------------------------------------------------

describe("FNV-1a known values (regression)", () => {
  it('should produce consistent hash for "" (empty string)', () => {
    // FNV-1a 64-bit: empty string → offset basis (no loop iterations)
    expect(fnv1a("")).toBe("cbf29ce484222325");
  });

  it("should produce consistent hash for a single char 'a'", () => {
    // Verified against FNV-1a 64-bit reference implementation
    expect(fnv1a("a")).toBe("af63dc4c8601ec8c");
  });

  it("should produce consistent hash for 'hello'", () => {
    // Verified against FNV-1a 64-bit reference implementation
    expect(fnv1a("hello")).toBe("a430d84680aabd0b");
  });
});

// ===========================================================================
// SimulationSnapshot — Core Lifecycle (Story 002)
// ===========================================================================

const hex16 = /^[0-9a-f]{16}$/;

// ---------------------------------------------------------------------------
// AC-1: init/dispose lifecycle guards
// ---------------------------------------------------------------------------

describe("AC-1: init/dispose lifecycle guards", () => {
  it("should start in Uninitialized state", () => {
    const ss = new SimulationSnapshot();
    // Cannot register or takeSnapshot before init
    expect(() => ss.register(new TestSnapshotSystem("x"))).toThrow(
      SnapshotError
    );
    expect(() => ss.takeSnapshot(0)).toThrow(SnapshotError);
  });

  it("init() transitions to Ready", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    // After init, register and takeSnapshot work
    const sys = new TestSnapshotSystem("a", { v: 1 });
    ss.register(sys);
    const snap = ss.takeSnapshot(0);
    expect(snap).not.toBeNull();
    expect(snap?.systems.a.state).toEqual({ v: 1 });
  });

  it("double init() is a no-op", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.init(); // second init should not throw
    const sys = new TestSnapshotSystem("x", { ok: true });
    ss.register(sys);
    expect(ss.takeSnapshot(0)?.systems.x.state).toEqual({ ok: true });
  });

  it("init() after dispose() throws", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.dispose();
    expect(() => ss.init()).toThrow(SnapshotError);
  });

  it('pre-init register() throws SnapshotError("Not initialized")', () => {
    const ss = new SimulationSnapshot();
    const sys = new TestSnapshotSystem("x");
    expect(() => ss.register(sys)).toThrow(SnapshotError);
    expect(() => ss.register(sys)).toThrow("Not initialized");
  });

  it('pre-init takeSnapshot() throws SnapshotError("Not initialized")', () => {
    const ss = new SimulationSnapshot();
    expect(() => ss.takeSnapshot(0)).toThrow(SnapshotError);
    expect(() => ss.takeSnapshot(0)).toThrow("Not initialized");
  });
});

// ---------------------------------------------------------------------------
// AC-2: Dispose clears registry
// ---------------------------------------------------------------------------

describe("AC-2: Dispose clears registry", () => {
  it("dispose() clears registry and disables takeSnapshot()", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new TestSnapshotSystem("a"));
    ss.register(new TestSnapshotSystem("b"));
    ss.register(new TestSnapshotSystem("c"));

    ss.dispose();

    // After dispose, systems should no longer be in registry
    // takeSnapshot should return empty systems or throw — it throws per story
    expect(() => ss.takeSnapshot(0)).toThrow(SnapshotError);
  });

  it("post-dispose register() throws", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.dispose();
    expect(() => ss.register(new TestSnapshotSystem("x"))).toThrow(
      SnapshotError
    );
  });

  it("double dispose() is idempotent (no error)", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new TestSnapshotSystem("a"));
    ss.dispose();
    // Second dispose should be a no-op
    expect(() => ss.dispose()).not.toThrow();
  });

  it("dispose() from Uninitialized state transitions to Disposed", () => {
    const ss = new SimulationSnapshot();
    // Dispose before init — should work, transition to Disposed
    ss.dispose();
    // Now in Disposed — register/takeSnapshot should throw
    expect(() => ss.register(new TestSnapshotSystem("x"))).toThrow(
      SnapshotError
    );
    expect(() => ss.takeSnapshot(0)).toThrow(SnapshotError);
    // Double-dispose still idempotent
    expect(() => ss.dispose()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// AC-3: Register makes system appear in snapshot
// ---------------------------------------------------------------------------

describe("AC-3: Register makes system appear in snapshot output", () => {
  it("should include registered system state in snapshot", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new TestSnapshotSystem("test-sys", { value: 42 }));

    const snap = ss.takeSnapshot(0);
    expect(snap).not.toBeNull();
    expect(snap?.systems["test-sys"]).toBeDefined();
    expect(snap?.systems["test-sys"].state).toEqual({ value: 42 });
  });

  it("should include all registered systems", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new TestSnapshotSystem("physics", { speed: 100 }));
    ss.register(new TestSnapshotSystem("fuel", { level: 85.3 }));
    ss.register(new TestSnapshotSystem("tire", { temps: [90, 92, 88, 91] }));

    const snap = ss.takeSnapshot(0);
    expect(Object.keys(snap?.systems).sort()).toEqual([
      "fuel",
      "physics",
      "tire",
    ]);
    expect(snap?.systems.physics.state).toEqual({ speed: 100 });
    expect(snap?.systems.fuel.state).toEqual({ level: 85.3 });
    expect(snap?.systems.tire.state).toEqual({ temps: [90, 92, 88, 91] });
  });

  it("should capture current state at snapshot time, not registration time", () => {
    const sys = new TestSnapshotSystem("live", { value: 1 });
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(sys);

    // Mutate state after registration
    sys.deserialize({ value: 99 });

    const snap = ss.takeSnapshot(0);
    expect(snap?.systems.live.state).toEqual({ value: 99 });
  });
});

// ---------------------------------------------------------------------------
// AC-4: FullGameSnapshot shape
// ---------------------------------------------------------------------------

describe("AC-4: FullGameSnapshot shape", () => {
  it("should have correct top-level shape with tick, timestamp, systems, snapshotHash", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new TestSnapshotSystem("fuel", { level: 50 }));

    const snap = ss.takeSnapshot(5);
    expect(snap).not.toBeNull();

    // tick matches the input
    expect(snap?.tick).toBe(5);
    // timestamp is a number > 0
    expect(typeof snap?.timestamp).toBe("number");
    expect(snap?.timestamp).toBeGreaterThan(0);
    // systems is a Record
    expect(typeof snap?.systems).toBe("object");
    // snapshotHash is empty string in this story
    expect(snap?.snapshotHash).toBe("");
  });

  it("should have correct per-system shape with state and hash", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new TestSnapshotSystem("fuel", { level: 85.3 }));

    const snap = ss.takeSnapshot(0);
    const sys = snap?.systems.fuel;

    expect(typeof sys.state).toBe("object");
    expect(sys.state).toEqual({ level: 85.3 });
    // hash is a 16-character hex string (FNV-1a)
    expect(typeof sys.hash).toBe("string");
    expect(sys.hash).toMatch(hex16);
  });

  it("should compute correct FNV-1a hash for each system", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new TestSnapshotSystem("test", { x: 1, y: 2 }));

    const expectedHash = fnv1a(JSON.stringify({ x: 1, y: 2 }));
    const snap = ss.takeSnapshot(0);
    expect(snap?.systems.test.hash).toBe(expectedHash);
  });

  it("should handle multiple systems with correct per-system hashes", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new TestSnapshotSystem("a", { v: 1 }));
    ss.register(new TestSnapshotSystem("b", { v: 2 }));

    const snap = ss.takeSnapshot(0);
    expect(snap?.systems.a.hash).toBe(fnv1a(JSON.stringify({ v: 1 })));
    expect(snap?.systems.b.hash).toBe(fnv1a(JSON.stringify({ v: 2 })));
  });

  it("should use Date.now() for timestamp (approximately now)", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new TestSnapshotSystem("x", {}));

    const before = Date.now();
    const snap = ss.takeSnapshot(0);
    const after = Date.now();

    expect(snap?.timestamp).toBeGreaterThanOrEqual(before);
    expect(snap?.timestamp).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// AC-5: JSON round-trip
// ---------------------------------------------------------------------------

describe("AC-5: JSON round-trip serialization", () => {
  it("should survive JSON.parse(JSON.stringify()) without data loss", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new TestSnapshotSystem("fuel", { level: 85.3 }));
    ss.register(
      new TestSnapshotSystem("physics", { pos: { x: 10, y: 0, z: 5 } })
    );
    ss.register(new TestSnapshotSystem("tire", { temps: [90, 92, 88, 91] }));

    const snap = ss.takeSnapshot(10);
    const roundTripped = JSON.parse(JSON.stringify(snap));

    expect(roundTripped).toEqual(snap);
    expect(roundTripped.tick).toBe(10);
    expect(roundTripped.systems.fuel.state.level).toBe(85.3);
    expect(roundTripped.systems.physics.state.pos).toEqual({
      x: 10,
      y: 0,
      z: 5,
    });
    expect(roundTripped.systems.tire.state.temps).toEqual([90, 92, 88, 91]);
  });

  it("should round-trip nested objects, numbers, booleans, null, and arrays", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(
      new TestSnapshotSystem("mixed", {
        int: 42,
        float: 3.14,
        bool: true,
        nullVal: null,
        arr: [1, 2, 3],
        nested: { deep: { value: "ok" } },
        emptyArr: [],
      })
    );

    const snap = ss.takeSnapshot(0);
    const roundTripped: FullGameSnapshot = JSON.parse(JSON.stringify(snap));

    expect(roundTripped.systems.mixed.state.int).toBe(42);
    expect(roundTripped.systems.mixed.state.float).toBe(3.14);
    expect(roundTripped.systems.mixed.state.bool).toBe(true);
    expect(roundTripped.systems.mixed.state.nullVal).toBeNull();
    expect(roundTripped.systems.mixed.state.arr).toEqual([1, 2, 3]);
    expect(roundTripped.systems.mixed.state.nested).toEqual({
      deep: { value: "ok" },
    });
    expect(roundTripped.systems.mixed.state.emptyArr).toEqual([]);
  });

  it("should return a fresh object (not a reference to internal state)", () => {
    const sys = new TestSnapshotSystem("data", { value: 42 });
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(sys);

    const snap = ss.takeSnapshot(0) as FullGameSnapshot;
    // Mutating the snapshot should not affect the system
    snap.systems.data.state.value = 99;
    expect(sys.serialize()).toEqual({ value: 42 });
  });
});

// ---------------------------------------------------------------------------
// AC-6: Zero registered systems → valid empty snapshot
// ---------------------------------------------------------------------------

describe("AC-6: Empty snapshot with zero registered systems", () => {
  it("should return valid snapshot with empty systems: {}", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    const snap = ss.takeSnapshot(0);
    expect(snap).not.toBeNull();
    expect(snap?.systems).toEqual({});
  });

  it("should still populate tick and timestamp correctly", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    const snap = ss.takeSnapshot(42);
    expect(snap?.tick).toBe(42);
    expect(typeof snap?.timestamp).toBe("number");
    expect(snap?.timestamp).toBeGreaterThan(0);
    expect(snap?.snapshotHash).toBe("");
  });

  it("should return empty snapshot with tick 0 when no tick is provided via options", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    const snap = ss.takeSnapshot({});
    expect(snap).not.toBeNull();
    expect(snap?.tick).toBe(0);
    expect(snap?.systems).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// AC-7: Frequency every tick (default takeEveryNthTick = 1)
// ---------------------------------------------------------------------------

describe("AC-7: takeEveryNthTick=1 — snapshot for every tick", () => {
  it("should return snapshot for every tick from 0 to 10 (default 1)", () => {
    const ss = new SimulationSnapshot(); // default takeEveryNthTick = 1
    ss.init();
    ss.register(new TestSnapshotSystem("x", { v: 1 }));

    for (let tick = 0; tick <= 10; tick++) {
      const snap = ss.takeSnapshot(tick);
      expect(snap).not.toBeNull();
      expect(snap?.tick).toBe(tick);
    }
  });

  it("should return snapshot at tick 0 (0 % 1 === 0)", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    const snap = ss.takeSnapshot(0);
    expect(snap).not.toBeNull();
    expect(snap?.tick).toBe(0);
  });

  it("should never return null at any tick when takeEveryNthTick=1", () => {
    const ss = new SimulationSnapshot(1);
    ss.init();
    for (let tick = 0; tick < 50; tick++) {
      expect(ss.takeSnapshot(tick)).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// AC-8: Frequency every Nth tick (takeEveryNthTick = 60)
// ---------------------------------------------------------------------------

describe("AC-8: takeEveryNthTick=60 — snapshot only when tick % 60 === 0", () => {
  it("should return snapshot at tick 0, null at tick 59, snapshot at tick 60", () => {
    const ss = new SimulationSnapshot(60);
    ss.init();
    ss.register(new TestSnapshotSystem("x", { v: 1 }));

    expect(ss.takeSnapshot(0)).not.toBeNull();
    expect(ss.takeSnapshot(59)).toBeNull();
    expect(ss.takeSnapshot(60)).not.toBeNull();
  });

  it("should return null for non-multiple ticks and snapshots for multiples", () => {
    const ss = new SimulationSnapshot(60);
    ss.init();

    expect(ss.takeSnapshot(0)).not.toBeNull(); // 0 % 60 === 0
    expect(ss.takeSnapshot(59)).toBeNull(); // 59 % 60 !== 0
    expect(ss.takeSnapshot(60)).not.toBeNull(); // 60 % 60 === 0
    expect(ss.takeSnapshot(119)).toBeNull(); // 119 % 60 !== 0
    expect(ss.takeSnapshot(120)).not.toBeNull(); // 120 % 60 === 0
  });

  it("should return correct tick value in the snapshot when frequency is met", () => {
    const ss = new SimulationSnapshot(60);
    ss.init();

    const snap = ss.takeSnapshot(60);
    expect(snap?.tick).toBe(60);
  });

  it("should pass typecheck with options object at tick 60", () => {
    const ss = new SimulationSnapshot(60);
    ss.init();
    const snap = ss.takeSnapshot({ tick: 60 });
    expect(snap).not.toBeNull();
    expect(snap?.tick).toBe(60);
  });

  it("should return null when options object has non-matching tick", () => {
    const ss = new SimulationSnapshot(60);
    ss.init();
    const snap = ss.takeSnapshot({ tick: 59 });
    expect(snap).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-9: On-demand bypasses frequency
// ---------------------------------------------------------------------------

describe("AC-9: force=true bypasses frequency check", () => {
  it("should return snapshot at tick 1 with takeEveryNthTick=60 when force=true", () => {
    const ss = new SimulationSnapshot(60);
    ss.init();
    ss.register(new TestSnapshotSystem("x", { v: 1 }));

    const snap = ss.takeSnapshot({ force: true, tick: 1 });
    expect(snap).not.toBeNull();
    // Should have the tick we passed, despite not being a multiple of 60
    expect(snap?.tick).toBe(1);
    expect(snap?.systems.x.state).toEqual({ v: 1 });
  });

  it("should return snapshot at any tick when force=true", () => {
    const ss = new SimulationSnapshot(100); // very restrictive
    ss.init();

    const nonMultipleTicks = [1, 37, 99, 150, 201];
    for (const tick of nonMultipleTicks) {
      const snap = ss.takeSnapshot({ force: true, tick });
      expect(snap).not.toBeNull();
      expect(snap?.tick).toBe(tick);
    }
  });

  it("should default tick to 0 when force=true and no tick provided", () => {
    const ss = new SimulationSnapshot(60);
    ss.init();

    const snap = ss.takeSnapshot({ force: true });
    expect(snap).not.toBeNull();
    expect(snap?.tick).toBe(0);
  });

  it("should work with force=true and negative tick", () => {
    const ss = new SimulationSnapshot(60);
    ss.init();

    const snap = ss.takeSnapshot({ force: true, tick: -5 });
    expect(snap).not.toBeNull();
    expect(snap?.tick).toBe(-5);
  });

  it("should work with force=true at tick 0 before any frequency match", () => {
    const ss = new SimulationSnapshot(60);
    ss.init();

    const snap = ss.takeSnapshot({ force: true, tick: 0 });
    expect(snap).not.toBeNull();
    expect(snap?.tick).toBe(0);
  });

  it("should still work with non-force options object (force defaults to false)", () => {
    const ss = new SimulationSnapshot(60);
    ss.init();

    // With tick 60 it should match frequency
    expect(ss.takeSnapshot({ tick: 60 })).not.toBeNull();
    // With tick 59 it should return null (no force)
    expect(ss.takeSnapshot({ tick: 59 })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-10: dispose() calls serialize() one final time
// ---------------------------------------------------------------------------

describe("AC-10: dispose() calls final serialize() on registered systems", () => {
  it("should call serialize() on each registered system during dispose", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    const sysA = new TestSnapshotSystem("a", { v: 1 });
    const sysB = new TestSnapshotSystem("b", { v: 2 });

    ss.register(sysA);
    ss.register(sysB);

    // Reset call counts (register may not call serialize, but init calls don't apply)
    sysA.serializeCallCount = 0;
    sysB.serializeCallCount = 0;

    ss.dispose();

    // Each system's serialize() should have been called at least once during dispose
    expect(sysA.serializeCallCount).toBeGreaterThanOrEqual(1);
    expect(sysB.serializeCallCount).toBeGreaterThanOrEqual(1);
  });

  it("should call serialize() on systems after takeSnapshot calls", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    const sys = new TestSnapshotSystem("x", { v: 1 });

    ss.register(sys);
    sys.serializeCallCount = 0;

    // Call takeSnapshot — this calls serialize() (via serialize() + hash())
    ss.takeSnapshot(0);
    expect(sys.serializeCallCount).toBe(2); // once from serialize(), once from hash()

    ss.dispose();
    // dispose() called serialize() once more
    expect(sys.serializeCallCount).toBe(3);
  });

  it("should not throw when disposing with zero registered systems", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    expect(() => ss.dispose()).not.toThrow();
  });

  it("should still clear registry (verify after dispose with final serialize)", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new TestSnapshotSystem("a", { v: 1 }));
    ss.dispose();

    // Registry cleared — takeSnapshot throws
    expect(() => ss.takeSnapshot(0)).toThrow(SnapshotError);
  });
});

// ---------------------------------------------------------------------------
// Edge cases and integration guards
// ---------------------------------------------------------------------------

describe("SimulationSnapshot edge cases", () => {
  it("should accept empty string as systemId", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new TestSnapshotSystem("", { v: 1 }));

    const snap = ss.takeSnapshot(0);
    expect(snap?.systems[""]).toBeDefined();
    expect(snap?.systems[""].state).toEqual({ v: 1 });
  });

  it("should compute snapshotHash always as empty string in this story", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new TestSnapshotSystem("a", { v: 1 }));

    const snap1 = ss.takeSnapshot(0);
    const snap2 = ss.takeSnapshot(1);
    expect(snap1?.snapshotHash).toBe("");
    expect(snap2?.snapshotHash).toBe("");
  });

  it("should not modify registered system state during snapshot", () => {
    const sys = new TestSnapshotSystem("stable", { value: "original" });
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(sys);

    ss.takeSnapshot(0);
    // System state should be unchanged
    expect(sys.serialize()).toEqual({ value: "original" });
  });
});
