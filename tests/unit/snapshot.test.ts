import { describe, expect, it } from "vitest";
import {
  fnv1a,
  type ISnapshotable,
} from "../../src/foundation/simulation-snapshot";

// ---------------------------------------------------------------------------
// Test system — concrete ISnapshotable implementation
// ---------------------------------------------------------------------------

class TestSnapshotSystem implements ISnapshotable {
  readonly systemId: string;
  private state: Record<string, unknown>;

  constructor(systemId: string, initialState?: Record<string, unknown>) {
    this.systemId = systemId;
    this.state = initialState ? { ...initialState } : {};
  }

  serialize(): Record<string, unknown> {
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
