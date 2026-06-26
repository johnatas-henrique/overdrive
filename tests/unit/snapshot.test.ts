import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeSnapshotHash,
  type FullGameSnapshot,
  fnv1a,
  type ISnapshotable,
  SimulationSnapshot,
  SnapshotError,
  sha256,
} from "../../src/foundation/simulation-snapshot";

// ---------------------------------------------------------------------------
// Crypto polyfill — ensure crypto.subtle is available in Node.js test env
// ---------------------------------------------------------------------------

import { webcrypto } from "node:crypto";

// ---------------------------------------------------------------------------
// SHA-256 known test vectors (for AC-7)
// ---------------------------------------------------------------------------

const SHA256_EMPTY =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const SHA256_HELLO =
  "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

if (typeof crypto?.subtle === "undefined") {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    writable: false,
    configurable: true,
  });
}

// Suppress console.warn output during tests
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Test system — concrete ISnapshotable implementation
// ---------------------------------------------------------------------------

class TestSnapshotSystem implements ISnapshotable {
  readonly systemId: string;
  private state: Record<string, unknown>;
  /** Tracks calls to `serialize()` — used by AC-10 to verify dispose calls it. */
  serializeCallCount = 0;
  /** Tracks calls to `deserialize()` — used by Story 003 AC-4. */
  deserializeCallCount = 0;
  /** Last state passed to `deserialize()` — used by Story 003 AC-4. */
  lastDeserializedState: Record<string, unknown> | null = null;

  constructor(systemId: string, initialState?: Record<string, unknown>) {
    this.systemId = systemId;
    this.state = initialState ? { ...initialState } : {};
  }

  serialize(): Record<string, unknown> {
    this.serializeCallCount++;
    return { ...this.state };
  }

  deserialize(state: Record<string, unknown>): void {
    this.deserializeCallCount++;
    this.lastDeserializedState = JSON.parse(JSON.stringify(state));
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
    expect(sys.hash).toMatch(HEX16_RE);
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

// ===========================================================================
// SHA-256 — sha256() utility (Story 003)
// ===========================================================================

const HEX64_RE = /^[0-9a-f]{64}$/;

// ---------------------------------------------------------------------------
// AC-1: sha256 returns 64-char hex string
// ---------------------------------------------------------------------------

describe("AC-1: sha256 returns 64-char hex string", () => {
  it('should return 64-char hex for "test data"', async () => {
    const result = await sha256("test data");
    expect(result).toMatch(HEX64_RE);
  });

  it('should return 64-char hex for "" (empty string)', async () => {
    const result = await sha256("");
    expect(result).toMatch(HEX64_RE);
  });

  it("should return 64-char hex for a single character", async () => {
    const result = await sha256("a");
    expect(result).toMatch(HEX64_RE);
  });

  it("should return 64-char hex for unicode characters", async () => {
    const result = await sha256("🏎️ 💨 overdrive 🏁");
    expect(result).toMatch(HEX64_RE);
  });

  it("should return 64-char hex for a large string (~10KB)", async () => {
    const large = JSON.stringify({
      key: "x".repeat(10000),
      arr: Array.from({ length: 100 }, (_, i) => i),
    });
    const result = await sha256(large);
    expect(result).toMatch(HEX64_RE);
  });
});

// ---------------------------------------------------------------------------
// AC-2: sha256 is deterministic — same input → same output
// ---------------------------------------------------------------------------

describe("AC-2: sha256 determinism — same input, same output", () => {
  it('should return identical hash for "hello" over 100 calls', async () => {
    const expected = await sha256("hello");
    for (let i = 0; i < 100; i++) {
      expect(await sha256("hello")).toBe(expected);
    }
  });

  it('should return identical hash for "" (empty string) every time', async () => {
    const expected = await sha256("");
    for (let i = 0; i < 100; i++) {
      expect(await sha256("")).toBe(expected);
    }
  });

  it("should produce different hashes for strings differing only by trailing newline", async () => {
    const withNewline = await sha256("hello\n");
    const withoutNewline = await sha256("hello");
    expect(withNewline).not.toBe(withoutNewline);
  });
});

// ---------------------------------------------------------------------------
// AC-7: SHA-256 known test vectors
// ---------------------------------------------------------------------------

describe("AC-7: SHA-256 known vectors", () => {
  it("should produce correct hash for empty string", async () => {
    expect(await sha256("")).toBe(SHA256_EMPTY);
  });

  it('should produce correct hash for "hello"', async () => {
    expect(await sha256("hello")).toBe(SHA256_HELLO);
  });

  it("should produce correct hash for a complex JSON string", async () => {
    const jsonBlob = JSON.stringify({
      players: [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ],
      race: { lap: 3, position: 1 },
    });
    const result = await sha256(jsonBlob);
    expect(result).toMatch(HEX64_RE);
  });
});

// ===========================================================================
// computeSnapshotHash — SHA-256 across all systems (Story 003)
// ===========================================================================

// ---------------------------------------------------------------------------
// AC-3: computeSnapshotHash sorts by systemId
// ---------------------------------------------------------------------------

describe("AC-3: computeSnapshotHash sorts by systemId", () => {
  it("should process systems in alphabetical order", async () => {
    const snapshot: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {
        z: { state: { v: 3 }, hash: "hash-z" },
        a: { state: { v: 1 }, hash: "hash-a" },
        m: { state: { v: 2 }, hash: "hash-m" },
      },
      snapshotHash: "",
    };

    // Manually compute expected hash from alphabetically sorted state
    const expectedConcat =
      JSON.stringify({ v: 1 }) +
      JSON.stringify({ v: 2 }) +
      JSON.stringify({ v: 3 });
    const expectedHash = await sha256(expectedConcat);

    const result = await computeSnapshotHash(snapshot);
    expect(result).toBe(expectedHash);
  });

  it("should handle a single system", async () => {
    const snapshot: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {
        solo: { state: { data: 42 }, hash: "hash-solo" },
      },
      snapshotHash: "",
    };

    const expectedHash = await sha256(JSON.stringify({ data: 42 }));
    expect(await computeSnapshotHash(snapshot)).toBe(expectedHash);
  });

  it("should handle empty systems map (hash of empty string)", async () => {
    const snapshot: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {},
      snapshotHash: "",
    };

    // Empty systems → empty concatenated string → sha256("")
    expect(await computeSnapshotHash(snapshot)).toBe(SHA256_EMPTY);
  });
});

// ---------------------------------------------------------------------------
// AC-8: computeSnapshotHash registration order independence
// ---------------------------------------------------------------------------

describe("AC-8: computeSnapshotHash order independence", () => {
  it("should return same hash with systems in opposite order", async () => {
    const snapshotAB: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {
        a: { state: { x: 1 }, hash: "hash-a" },
        b: { state: { y: 2 }, hash: "hash-b" },
      },
      snapshotHash: "",
    };

    const snapshotBA: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {
        b: { state: { y: 2 }, hash: "hash-b" },
        a: { state: { x: 1 }, hash: "hash-a" },
      },
      snapshotHash: "",
    };

    const hashAB = await computeSnapshotHash(snapshotAB);
    const hashBA = await computeSnapshotHash(snapshotBA);
    expect(hashAB).toBe(hashBA);
  });

  it("should return same hash with three systems in varied order permutations", async () => {
    const states: Record<
      string,
      { state: Record<string, unknown>; hash: string }
    > = {
      sys1: { state: { a: 1 }, hash: "h1" },
      sys2: { state: { b: 2 }, hash: "h2" },
      sys3: { state: { c: 3 }, hash: "h3" },
    };

    const orders: string[][] = [
      ["sys1", "sys2", "sys3"],
      ["sys3", "sys2", "sys1"],
      ["sys2", "sys1", "sys3"],
      ["sys3", "sys1", "sys2"],
    ];

    const hashes = await Promise.all(
      orders.map(async (order) => {
        const systems: Record<
          string,
          { state: Record<string, unknown>; hash: string }
        > = {};
        for (const id of order) {
          systems[id] = states[id];
        }
        return computeSnapshotHash({
          tick: 0,
          timestamp: 1000,
          systems,
          snapshotHash: "",
        });
      })
    );

    for (let i = 1; i < hashes.length; i++) {
      expect(hashes[i]).toBe(hashes[0]);
    }
  });
});

// ===========================================================================
// restoreSnapshot — state restoration (Story 003)
// ===========================================================================

// ---------------------------------------------------------------------------
// AC-4: restoreSnapshot calls deserialize on each registered system
// ---------------------------------------------------------------------------

describe("AC-4: restoreSnapshot calls deserialize", () => {
  it("should call deserialize on each registered system with the stored state", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    const sysA = new TestSnapshotSystem("a", { initial: true });
    ss.register(sysA);

    const snapshot: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {
        a: { state: { value: 42 }, hash: "hash-a" },
      },
      snapshotHash: "",
    };

    ss.restoreSnapshot(snapshot);

    expect(sysA.deserializeCallCount).toBe(1);
    expect(sysA.lastDeserializedState).toEqual({ value: 42 });
    expect(sysA.serialize()).toEqual({ value: 42 });
  });

  it("should call deserialize on multiple systems", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    const sysA = new TestSnapshotSystem("a");
    const sysB = new TestSnapshotSystem("b");
    ss.register(sysA);
    ss.register(sysB);

    const snapshot: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {
        a: { state: { data: "from-a" }, hash: "h1" },
        b: { state: { data: "from-b" }, hash: "h2" },
      },
      snapshotHash: "",
    };

    ss.restoreSnapshot(snapshot);

    expect(sysA.deserializeCallCount).toBe(1);
    expect(sysB.deserializeCallCount).toBe(1);
    expect(sysA.lastDeserializedState).toEqual({ data: "from-a" });
    expect(sysB.lastDeserializedState).toEqual({ data: "from-b" });
  });

  it("should skip systems in snapshot but not in registry", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    const sysA = new TestSnapshotSystem("a", { v: 1 });
    ss.register(sysA);

    const snapshot: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {
        a: { state: { v: 99 }, hash: "h1" },
        unknownSys: { state: { v: 42 }, hash: "h2" },
      },
      snapshotHash: "",
    };

    // Should not throw despite unknownSys not being in registry
    expect(() => ss.restoreSnapshot(snapshot)).not.toThrow();

    // Known system should have been deserialized
    expect(sysA.deserializeCallCount).toBe(1);
    expect(sysA.serialize()).toEqual({ v: 99 });
  });

  it("should leave systems registered but not in snapshot unchanged", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    const sysA = new TestSnapshotSystem("a", { v: 1 });
    const sysB = new TestSnapshotSystem("b", { v: 2 });
    ss.register(sysA);
    ss.register(sysB);

    const snapshot: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {
        a: { state: { v: 99 }, hash: "h1" },
      },
      snapshotHash: "",
    };

    ss.restoreSnapshot(snapshot);

    // System 'a' was in the snapshot — deserialized
    expect(sysA.deserializeCallCount).toBe(1);
    expect(sysA.serialize()).toEqual({ v: 99 });
    // System 'b' was NOT in the snapshot — should be unchanged
    expect(sysB.deserializeCallCount).toBe(0);
    expect(sysB.serialize()).toEqual({ v: 2 });
  });

  it("should throw SnapshotError if called before init", () => {
    const ss = new SimulationSnapshot();
    const snapshot: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {},
      snapshotHash: "",
    };
    expect(() => ss.restoreSnapshot(snapshot)).toThrow(SnapshotError);
  });

  it("should throw SnapshotError if called after dispose", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.dispose();
    const snapshot: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {},
      snapshotHash: "",
    };
    expect(() => ss.restoreSnapshot(snapshot)).toThrow(SnapshotError);
  });
});

// ---------------------------------------------------------------------------
// AC-5: Restore fidelity — hash matches after restoreSnapshot
// ---------------------------------------------------------------------------

describe("AC-5: Restore fidelity — hash matches after restoreSnapshot", () => {
  it("should restore state so system hash matches the stored hash", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    const sys = new TestSnapshotSystem("test-sys", { fuel: 85, speed: 120 });
    ss.register(sys);

    // Take snapshot of original state
    const snap = ss.takeSnapshot(0) as FullGameSnapshot;

    // Mutate system state
    sys.deserialize({ fuel: 0, speed: 0 });
    expect(sys.serialize()).toEqual({ fuel: 0, speed: 0 });

    // Restore from original snapshot
    ss.restoreSnapshot(snap);

    // Verify restored state hash matches original stored hash
    expect(sys.hash()).toBe(snap.systems["test-sys"].hash);
    expect(sys.serialize()).toEqual({ fuel: 85, speed: 120 });
  });

  it("should verify multiple systems all match after restore", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    const sysA = new TestSnapshotSystem("a", { pos: { x: 10, y: 0 } });
    const sysB = new TestSnapshotSystem("b", { fuel: 100 });
    ss.register(sysA);
    ss.register(sysB);

    const snap = ss.takeSnapshot(0) as FullGameSnapshot;

    // Mutate both systems
    sysA.deserialize({ pos: { x: 0, y: 0 } });
    sysB.deserialize({ fuel: 0 });

    // Restore
    ss.restoreSnapshot(snap);

    // Both hashes should match their stored values
    expect(sysA.hash()).toBe(snap.systems.a.hash);
    expect(sysB.hash()).toBe(snap.systems.b.hash);
  });

  it("should handle system with zero/empty state", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    const sys = new TestSnapshotSystem("empty-sys");
    ss.register(sys);

    const snap = ss.takeSnapshot(0) as FullGameSnapshot;

    sys.deserialize({ injected: true });

    ss.restoreSnapshot(snap);

    expect(sys.hash()).toBe(snap.systems["empty-sys"].hash);
    expect(sys.serialize()).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// AC-6: Same tick → same snapshot content (determinism)
// ---------------------------------------------------------------------------

describe("AC-6: Same tick → same snapshot content", () => {
  it("should produce deeply equal systems payloads for two calls at same tick", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    const sysA = new TestSnapshotSystem("a", { x: 1 });
    const sysB = new TestSnapshotSystem("b", { y: 2 });
    ss.register(sysA);
    ss.register(sysB);

    const snap1 = ss.takeSnapshot(42) as FullGameSnapshot;
    const snap2 = ss.takeSnapshot(42) as FullGameSnapshot;

    expect(snap1.systems).toEqual(snap2.systems);
  });

  it("should produce identical per-system hashes for two calls at same tick", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    const sys = new TestSnapshotSystem("test", { v: 100 });
    ss.register(sys);

    const snap1 = ss.takeSnapshot(10) as FullGameSnapshot;
    const snap2 = ss.takeSnapshot(10) as FullGameSnapshot;

    expect(snap1.systems.test.hash).toBe(snap2.systems.test.hash);
  });

  it("should have equal systems payloads even if timestamps differ between calls", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    ss.register(new TestSnapshotSystem("x", { v: 1 }));

    const snap1 = ss.takeSnapshot(0) as FullGameSnapshot;
    const snap2 = ss.takeSnapshot(0) as FullGameSnapshot;

    // Timestamps may be equal if Date.now() resolution is coarse.
    // The assertion is that the systems payload (state + hashes) is
    // deterministic regardless of any timestamp differences.
    expect(snap1.systems).toEqual(snap2.systems);
    expect(snap1.tick).toBe(snap2.tick);
  });
});

// ===========================================================================
// Story 004: Error Isolation + Registration Edge Cases
// ===========================================================================

// ---------------------------------------------------------------------------
// AC-1: SnapshotError extends Error with systemId and code properties
// ---------------------------------------------------------------------------

describe("AC-1: SnapshotError structure", () => {
  it("should extend Error with systemId and code properties", () => {
    const error = new SnapshotError(
      "Test error",
      "physics",
      "SNAPSHOT_DUPLICATE_REGISTRATION"
    );
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("SnapshotError");
    expect(error.message).toBe("Test error");
    expect(error.systemId).toBe("physics");
    expect(error.code).toBe("SNAPSHOT_DUPLICATE_REGISTRATION");
  });

  it("should support SNAPSHOT_DESERIALIZE_FAILURE code variant", () => {
    const error = new SnapshotError(
      "Deserialize failed",
      "fuel",
      "SNAPSHOT_DESERIALIZE_FAILURE"
    );
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("SnapshotError");
    expect(error.message).toBe("Deserialize failed");
    expect(error.systemId).toBe("fuel");
    expect(error.code).toBe("SNAPSHOT_DESERIALIZE_FAILURE");
  });

  it("should have default values for systemId and code", () => {
    const error = new SnapshotError("Not initialized");
    expect(error.systemId).toBe("");
    expect(error.code).toBe("SNAPSHOT_DUPLICATE_REGISTRATION");
  });
});

// ---------------------------------------------------------------------------
// AC-2: Duplicate register() throws SnapshotError
// ---------------------------------------------------------------------------

describe("AC-2: Duplicate register throws SnapshotError", () => {
  it("should throw when registering same systemId twice", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new TestSnapshotSystem("physics", { v: 1 }));

    expect(() =>
      ss.register(new TestSnapshotSystem("physics", { v: 2 }))
    ).toThrow(SnapshotError);
    expect(() =>
      ss.register(new TestSnapshotSystem("physics", { v: 2 }))
    ).toThrow("physics");
  });

  it("should throw SnapshotError with correct code and systemId", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new TestSnapshotSystem("fuel", { v: 1 }));

    try {
      ss.register(new TestSnapshotSystem("fuel", { v: 2 }));
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(SnapshotError);
      const err = e as SnapshotError;
      expect(err.systemId).toBe("fuel");
      expect(err.code).toBe("SNAPSHOT_DUPLICATE_REGISTRATION");
      expect(err.message).toContain("fuel");
    }
  });

  it("should allow different systemIds without conflict", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    const sys = new TestSnapshotSystem("physics", { v: 1 });
    ss.register(sys);
    const sys2 = new TestSnapshotSystem("engine", { v: 2 });
    ss.register(sys2);
    const snap = ss.takeSnapshot(0);
    expect(snap?.systems.physics).toBeDefined();
    expect(snap?.systems.engine).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-3: Registry unchanged after duplicate registration exception
// ---------------------------------------------------------------------------

describe("AC-3: Registry unchanged on duplicate exception", () => {
  it("should not modify registry when duplicate registration throws", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new TestSnapshotSystem("physics", { v: 1 }));

    // Attempt duplicate registration
    try {
      ss.register(new TestSnapshotSystem("physics", { v: 99 }));
    } catch {
      // expected
    }

    // Registry should still contain only the original system
    const snap = ss.takeSnapshot(0);
    expect(Object.keys(snap?.systems).length).toBe(1);
    expect(snap?.systems.physics.state).toEqual({ v: 1 });
  });

  it("should not corrupt registry after multiple duplicate attempts", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new TestSnapshotSystem("a", { v: 1 }));
    ss.register(new TestSnapshotSystem("b", { v: 2 }));

    // Attempt duplicate multiple times
    for (let i = 0; i < 3; i++) {
      try {
        ss.register(new TestSnapshotSystem("a", { v: i }));
      } catch {
        // expected
      }
    }

    const snap = ss.takeSnapshot(0);
    expect(Object.keys(snap?.systems).length).toBe(2);
    expect(snap?.systems.a.state).toEqual({ v: 1 });
    expect(snap?.systems.b.state).toEqual({ v: 2 });
  });
});

// ---------------------------------------------------------------------------
// AC-4: Deserialize failure isolation
// ---------------------------------------------------------------------------

describe("AC-4: Deserialize failure isolation", () => {
  it("should isolate deserialize failure — other systems restore normally", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    const sysA = new TestSnapshotSystem("a", { v: 1 });
    const sysB = new TestSnapshotSystem("b", { v: 2 });
    const sysC = new TestSnapshotSystem("c", { v: 3 });

    ss.register(sysA);
    ss.register(sysB);
    ss.register(sysC);

    // Make sysB throw on deserialize
    vi.spyOn(sysB, "deserialize").mockImplementation(() => {
      throw new Error("Deserialize failed for B");
    });

    const snapshot: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {
        a: { state: { v: 10 }, hash: "h1" },
        b: { state: { v: 20 }, hash: "h2" },
        c: { state: { v: 30 }, hash: "h3" },
      },
      snapshotHash: "",
    };

    ss.restoreSnapshot(snapshot);

    // sysA and sysC should have been deserialized
    expect(sysA.serialize()).toEqual({ v: 10 });
    expect(sysC.serialize()).toEqual({ v: 30 });
    // sysB should NOT have been deserialized — retains previous state
    expect(sysB.serialize()).toEqual({ v: 2 });

    vi.restoreAllMocks();
  });

  it("should handle all systems failing deserialize", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    const sysA = new TestSnapshotSystem("a", { v: 1 });
    const sysB = new TestSnapshotSystem("b", { v: 2 });

    ss.register(sysA);
    ss.register(sysB);

    vi.spyOn(sysA, "deserialize").mockImplementation(() => {
      throw new Error("A fail");
    });
    vi.spyOn(sysB, "deserialize").mockImplementation(() => {
      throw new Error("B fail");
    });

    const snapshot: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {
        a: { state: { v: 99 }, hash: "h1" },
        b: { state: { v: 88 }, hash: "h2" },
      },
      snapshotHash: "",
    };

    const result = ss.restoreSnapshot(snapshot);

    // Both systems retain previous state
    expect(sysA.serialize()).toEqual({ v: 1 });
    expect(sysB.serialize()).toEqual({ v: 2 });
    // Result reflects total failure
    expect(result.succeeded).toEqual([]);
    expect(result.failed).toHaveLength(2);

    vi.restoreAllMocks();
  });

  it("should handle non-Error thrown values (string, number)", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    const sysA = new TestSnapshotSystem("a", { v: 1 });
    const sysB = new TestSnapshotSystem("b", { v: 2 });

    ss.register(sysA);
    ss.register(sysB);

    // Throw a string (not an Error instance)
    vi.spyOn(sysA, "deserialize").mockImplementation(() => {
      throw "corrupted";
    });
    // Throw a number
    vi.spyOn(sysB, "deserialize").mockImplementation(() => {
      throw 42;
    });

    const snapshot: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {
        a: { state: { v: 99 }, hash: "h1" },
        b: { state: { v: 88 }, hash: "h2" },
      },
      snapshotHash: "",
    };

    const result = ss.restoreSnapshot(snapshot);

    // Both should be caught and wrapped
    expect(result.failed).toHaveLength(2);
    expect(result.failed[0].error).toBeInstanceOf(Error);
    expect(result.failed[0].error.message).toBe("corrupted");
    expect(result.failed[1].error).toBeInstanceOf(Error);
    expect(result.failed[1].error.message).toBe("42");

    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// AC-5: Failed system retains previous state
// ---------------------------------------------------------------------------

describe("AC-5: Failed system retains previous state", () => {
  it("should preserve previous state when deserialize throws", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    const sys = new TestSnapshotSystem("test", { state: "S1" });
    ss.register(sys);

    const preHash = sys.hash();

    vi.spyOn(sys, "deserialize").mockImplementation(() => {
      throw new Error("Corrupt data");
    });

    const snapshot: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {
        test: { state: { state: "S2" }, hash: "h1" },
      },
      snapshotHash: "",
    };

    ss.restoreSnapshot(snapshot);

    // Hash should be unchanged (original state preserved)
    expect(sys.hash()).toBe(preHash);
    expect(sys.serialize()).toEqual({ state: "S1" });

    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// AC-6: console.warn called on failure
// ---------------------------------------------------------------------------

describe("AC-6: console.warn called on failure", () => {
  it("should log warning for failed system during restore", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const ss = new SimulationSnapshot();
    ss.init();

    const sys = new TestSnapshotSystem("failing", { v: 1 });
    ss.register(sys);

    vi.spyOn(sys, "deserialize").mockImplementation(() => {
      throw new Error("Corruption detected");
    });

    const snapshot: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {
        failing: { state: { v: 99 }, hash: "h1" },
      },
      snapshotHash: "",
    };

    ss.restoreSnapshot(snapshot);

    expect(warnSpy).toHaveBeenCalled();
    expect(
      warnSpy.mock.calls.some(
        (call) =>
          typeof call[0] === "string" &&
          call[0].includes("failing") &&
          call[0].includes("Corruption detected")
      )
    ).toBe(true);

    warnSpy.mockRestore();
  });

  it("should log multiple warnings for multiple failures", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const ss = new SimulationSnapshot();
    ss.init();

    const sysA = new TestSnapshotSystem("a", { v: 1 });
    const sysB = new TestSnapshotSystem("b", { v: 2 });
    ss.register(sysA);
    ss.register(sysB);

    vi.spyOn(sysA, "deserialize").mockImplementation(() => {
      throw new Error("err1");
    });
    vi.spyOn(sysB, "deserialize").mockImplementation(() => {
      throw new Error("err2");
    });

    const snapshot: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {
        a: { state: { v: 99 }, hash: "h1" },
        b: { state: { v: 88 }, hash: "h2" },
      },
      snapshotHash: "",
    };

    ss.restoreSnapshot(snapshot);

    expect(warnSpy).toHaveBeenCalledTimes(2);

    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// AC-7: restoreSnapshot returns SnapshotRestoreResult
// ---------------------------------------------------------------------------

describe("AC-7: SnapshotRestoreResult returned by restoreSnapshot", () => {
  it("should return object with succeeded and failed arrays", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    const sysA = new TestSnapshotSystem("a", { v: 1 });
    ss.register(sysA);

    const snapshot: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {
        a: { state: { v: 99 }, hash: "h1" },
      },
      snapshotHash: "",
    };

    const result = ss.restoreSnapshot(snapshot);
    expect(result).toHaveProperty("succeeded");
    expect(result).toHaveProperty("failed");
    expect(Array.isArray(result.succeeded)).toBe(true);
    expect(Array.isArray(result.failed)).toBe(true);
  });

  it("should report succeeded and failed systems correctly", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    const sysA = new TestSnapshotSystem("a", { v: 1 });
    const sysB = new TestSnapshotSystem("b", { v: 2 });
    ss.register(sysA);
    ss.register(sysB);

    vi.spyOn(sysB, "deserialize").mockImplementation(() => {
      throw new Error("fail");
    });

    const snapshot: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {
        a: { state: { v: 99 }, hash: "h1" },
        b: { state: { v: 88 }, hash: "h2" },
      },
      snapshotHash: "",
    };

    const result = ss.restoreSnapshot(snapshot);
    expect(result.succeeded).toEqual(["a"]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].systemId).toBe("b");
    expect(result.failed[0].error).toBeInstanceOf(Error);
    expect(result.failed[0].error.message).toBe("fail");

    vi.restoreAllMocks();
  });

  it("should return empty arrays for empty snapshot", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new TestSnapshotSystem("a", { v: 1 }));

    const snapshot: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {},
      snapshotHash: "",
    };

    const result = ss.restoreSnapshot(snapshot);
    expect(result.succeeded).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it("should return all succeeded when no failures", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new TestSnapshotSystem("a", { v: 1 }));
    ss.register(new TestSnapshotSystem("b", { v: 2 }));

    const snapshot: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {
        a: { state: { v: 99 }, hash: "h1" },
        b: { state: { v: 88 }, hash: "h2" },
      },
      snapshotHash: "",
    };

    const result = ss.restoreSnapshot(snapshot);
    expect(result.succeeded).toEqual(expect.arrayContaining(["a", "b"]));
    expect(result.failed).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC-8: Missing system in registry skipped gracefully
// ---------------------------------------------------------------------------

describe("AC-8: Missing system in registry skipped gracefully", () => {
  it("should skip systems in snapshot but not in registry with warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const ss = new SimulationSnapshot();
    ss.init();
    const sysX = new TestSnapshotSystem("X", { v: 1 });
    ss.register(sysX);

    const snapshot: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {
        X: { state: { v: 99 }, hash: "h1" },
        Y: { state: { v: 42 }, hash: "h2" },
      },
      snapshotHash: "",
    };

    const result = ss.restoreSnapshot(snapshot);

    // System X restored normally
    expect(sysX.serialize()).toEqual({ v: 99 });
    // Warning logged for missing system Y
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Y"));
    // System Y is not in succeeded nor failed — it was skipped
    expect(result.succeeded).toEqual(["X"]);
    expect(result.failed).toEqual([]);

    warnSpy.mockRestore();
  });

  it("should handle snapshot-only system that never existed in registry", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new TestSnapshotSystem("existing", { v: 1 }));

    const snapshot: FullGameSnapshot = {
      tick: 0,
      timestamp: 1000,
      systems: {
        neverRegistered: { state: { v: 999 }, hash: "h1" },
      },
      snapshotHash: "",
    };

    // Should not throw
    expect(() => ss.restoreSnapshot(snapshot)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("neverRegistered")
    );

    warnSpy.mockRestore();
  });
});
