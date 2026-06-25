import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Persistence,
  PersistenceError,
  PersistenceState,
} from "../../src/foundation/persistence";

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

/** In-memory store backing the localStorage mock. */
const mockStore = new Map<string, string>();

/** Factory for a working localStorage mock. */
function createWorkingStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => store.clear()),
    get length(): number {
      return store.size;
    },
    key: vi.fn((_index: number) => null),
  };
}

/** Factory for a localStorage mock that throws on setItem. */
function createFailingStorage(errorName: string): Storage {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn(() => {
      const error = new Error("Storage unavailable");
      error.name = errorName;
      throw error;
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => store.clear()),
    get length(): number {
      return store.size;
    },
    key: vi.fn((_index: number) => null),
  };
}

// Suppress console output during tests (matching project convention)
let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  mockStore.clear();
});

afterEach(() => {
  warnSpy.mockRestore();
  errorSpy.mockRestore();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// PersistenceState enum
// ---------------------------------------------------------------------------

describe("PersistenceState", () => {
  it("should have Uninitialized = 0", () => {
    expect(PersistenceState.Uninitialized).toBe(0);
  });

  it("should have Ready = 1", () => {
    expect(PersistenceState.Ready).toBe(1);
  });

  it("should have Degraded = 2", () => {
    expect(PersistenceState.Degraded).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// AC-1: init() probes and enters Ready or Degraded
// ---------------------------------------------------------------------------

describe("AC-1: init() probes storage availability", () => {
  it("should start in Uninitialized state", () => {
    const persistence = new Persistence();
    expect(persistence.state).toBe(PersistenceState.Uninitialized);
  });

  it("should enter Ready when localStorage is available", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Ready);
  });

  it("should call setItem and removeItem during probe", async () => {
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);
    const persistence = new Persistence();
    await persistence.init();
    expect(storage.setItem).toHaveBeenCalledWith("__overdrive_probe__", "1");
    expect(storage.removeItem).toHaveBeenCalledWith("__overdrive_probe__");
  });

  it("should enter Degraded when setItem throws SecurityError", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("SecurityError"));
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Degraded);
  });

  it("should enter Degraded when setItem throws QuotaExceededError", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Degraded);
  });

  it("should enter Degraded when setItem throws generic Error", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("Error"));
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Degraded);
  });

  it("should record error name when probe fails (SecurityError)", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("SecurityError"));
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.lastError).toBe("SecurityError");
  });

  it("should record error name when probe fails (QuotaExceededError)", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.lastError).toBe("QuotaExceededError");
  });

  it("should have lastError undefined when probe succeeds", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.lastError).toBeUndefined();
  });

  it("should have lastError undefined before init()", () => {
    const persistence = new Persistence();
    expect(persistence.lastError).toBeUndefined();
  });

  it("should survive when localStorage is not available (undefined)", async () => {
    vi.stubGlobal("localStorage", undefined);
    const persistence = new Persistence();
    // Should not crash — enters Degraded mode
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Degraded);
  });

  it("should record UnknownError when thrown value is not an Error", async () => {
    const badStorage = createWorkingStorage();
    // Override setItem to throw a non-Error value
    (badStorage as { setItem: (...args: unknown[]) => unknown }).setItem =
      vi.fn(() => {
        throw "string error"; // not an Error instance
      });
    vi.stubGlobal("localStorage", badStorage);
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Degraded);
    expect(persistence.lastError).toBe("UnknownError");
  });
});

// ---------------------------------------------------------------------------
// AC-9: init() returns Promise<void>
// ---------------------------------------------------------------------------

describe("AC-9: init() returns Promise<void>", () => {
  it("should return a Promise", () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    const result = persistence.init();
    expect(result).toBeInstanceOf(Promise);
  });

  it("should resolve to undefined", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await expect(persistence.init()).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Duplicate init() guard
// ---------------------------------------------------------------------------

describe("Duplicate init() guard", () => {
  it("should be a no-op when called twice", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();
    // Second call should not throw
    await expect(persistence.init()).resolves.toBeUndefined();
    // State should remain Ready
    expect(persistence.state).toBe(PersistenceState.Ready);
  });

  it("should not re-probe on second call", async () => {
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);
    const persistence = new Persistence();
    await persistence.init();
    // Clear the call history
    vi.clearAllMocks();
    // Second init — should NOT call setItem again
    await persistence.init();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("should not change state when called twice while Degraded", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("SecurityError"));
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Degraded);

    // Second init should be a no-op — stays Degraded
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Degraded);
  });

  it("should probe exactly once on concurrent init calls", async () => {
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);
    const persistence = new Persistence();

    // Call init twice without awaiting — both schedule microtasks
    const p1 = persistence.init();
    const p2 = persistence.init();

    await Promise.all([p1, p2]);

    // Probe should run exactly once (memoized promise)
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(persistence.state).toBe(PersistenceState.Ready);
  });
});

// ---------------------------------------------------------------------------
// Uninitialized guards: save(), load(), delete()
// ---------------------------------------------------------------------------

describe("Uninitialized guards", () => {
  describe("save()", () => {
    it("should throw PersistenceError when called before init()", async () => {
      const persistence = new Persistence();
      await expect(persistence.save("key", "data")).rejects.toThrow(
        PersistenceError
      );
    });

    it("should include the correct error message", async () => {
      const persistence = new Persistence();
      await expect(persistence.save("key", "data")).rejects.toThrow(
        "Not initialized. Call init() first."
      );
    });

    it("should have error name set to PersistenceError", async () => {
      const persistence = new Persistence();
      try {
        await persistence.save("key", "data");
        expect.fail("Should have thrown");
      } catch (e) {
        expect((e as Error).name).toBe("PersistenceError");
      }
    });

    it("should not throw after init() with Ready state", async () => {
      vi.stubGlobal("localStorage", createWorkingStorage());
      const persistence = new Persistence();
      await persistence.init();
      await expect(persistence.save("key", "data")).resolves.toBeUndefined();
    });

    it("should not throw after init() with Degraded state", async () => {
      vi.stubGlobal("localStorage", createFailingStorage("SecurityError"));
      const persistence = new Persistence();
      await persistence.init();
      // Degraded mode should not throw — enters write queue (Story 004)
      await expect(persistence.save("key", "data")).resolves.toBeUndefined();
    });
  });

  describe("load()", () => {
    it("should throw PersistenceError when called before init()", async () => {
      const persistence = new Persistence();
      await expect(persistence.load("key")).rejects.toThrow(PersistenceError);
    });

    it("should throw with correct message before init()", async () => {
      const persistence = new Persistence();
      await expect(persistence.load("key")).rejects.toThrow(
        "Not initialized. Call init() first."
      );
    });

    it("should return null after init() with Ready state (stub)", async () => {
      vi.stubGlobal("localStorage", createWorkingStorage());
      const persistence = new Persistence();
      await persistence.init();
      const result = await persistence.load("key");
      expect(result).toBeNull();
    });

    it("should return null after init() with Degraded state (stub)", async () => {
      vi.stubGlobal("localStorage", createFailingStorage("SecurityError"));
      const persistence = new Persistence();
      await persistence.init();
      const result = await persistence.load("key");
      expect(result).toBeNull();
    });
  });

  describe("delete()", () => {
    it("should throw PersistenceError when called before init()", async () => {
      const persistence = new Persistence();
      await expect(persistence.delete("key")).rejects.toThrow(PersistenceError);
    });

    it("should throw with correct message before init()", async () => {
      const persistence = new Persistence();
      await expect(persistence.delete("key")).rejects.toThrow(
        "Not initialized. Call init() first."
      );
    });

    it("should not throw after init() with Ready state", async () => {
      vi.stubGlobal("localStorage", createWorkingStorage());
      const persistence = new Persistence();
      await persistence.init();
      await expect(persistence.delete("key")).resolves.toBeUndefined();
    });

    it("should not throw after init() with Degraded state", async () => {
      vi.stubGlobal("localStorage", createFailingStorage("SecurityError"));
      const persistence = new Persistence();
      await persistence.init();
      await expect(persistence.delete("key")).resolves.toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// retry() guard
// ---------------------------------------------------------------------------

describe("retry() guard", () => {
  it("should return true when state is Ready (no-op)", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();
    await expect(persistence.retry()).resolves.toBe(true);
  });

  it("should return false when state is Degraded", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("SecurityError"));
    const persistence = new Persistence();
    await persistence.init();
    await expect(persistence.retry()).resolves.toBe(false);
  });

  it("should return false when state is Uninitialized", async () => {
    const persistence = new Persistence();
    await expect(persistence.retry()).resolves.toBe(false);
  });
});

// ---------------------------------------------------------------------------
// registerMigration()
// ---------------------------------------------------------------------------

describe("registerMigration()", () => {
  it("should be callable before init()", () => {
    const persistence = new Persistence();
    expect(() => {
      persistence.registerMigration("0.1.0", "0.2.0", (data) => data);
    }).not.toThrow();
  });

  it("should be callable after init()", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();
    expect(() => {
      persistence.registerMigration("0.2.0", "0.3.0", (data) => data);
    }).not.toThrow();
  });

  it("should accept a migration function", () => {
    const persistence = new Persistence();
    const migration = vi.fn((data: unknown) => data);
    persistence.registerMigration("0.1.0", "0.2.0", migration);
    // No error — function stored for later execution (Story 003)
  });
});

// ---------------------------------------------------------------------------
// state getter
// ---------------------------------------------------------------------------

describe("state getter", () => {
  it("should return Uninitialized before init()", () => {
    const persistence = new Persistence();
    expect(persistence.state).toBe(PersistenceState.Uninitialized);
  });

  it("should return Ready after successful init()", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Ready);
  });

  it("should return Degraded after failed init()", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("Error"));
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Degraded);
  });

  it("should be immutable (no setter)", () => {
    const persistence = new Persistence();
    expect(() => {
      // @ts-expect-error — testing runtime immutability
      persistence.state = PersistenceState.Ready;
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

describe("PersistenceError", () => {
  it("should be an instance of Error", () => {
    const err = new PersistenceError("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("should be an instance of PersistenceError", () => {
    const err = new PersistenceError("test");
    expect(err).toBeInstanceOf(PersistenceError);
  });

  it("should have name set to PersistenceError", () => {
    const err = new PersistenceError("test");
    expect(err.name).toBe("PersistenceError");
  });

  it("should capture the message", () => {
    const err = new PersistenceError("Something went wrong");
    expect(err.message).toBe("Something went wrong");
  });

  it("should capture stack trace", () => {
    const err = new PersistenceError("test");
    expect(err.stack).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Microtask timing: init() probe runs asynchronously
// ---------------------------------------------------------------------------

describe("init() microtask timing", () => {
  it("should not synchronously probe localStorage", () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    // State should still be Uninitialized before microtask runs
    persistence.init();
    expect(persistence.state).toBe(PersistenceState.Uninitialized);
  });

  it("should update state after microtask completes", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    const initPromise = persistence.init();
    // After first microtask flush, state should still be Uninitialized
    // (because Promise.resolve().then() schedules a microtask)
    // Actually, we can't guarantee interleaving here, so just await
    await initPromise;
    expect(persistence.state).toBe(PersistenceState.Ready);
  });
});

// ---------------------------------------------------------------------------
// AC-2: save/load round-trip — data integrity
// ---------------------------------------------------------------------------

describe("AC-2: save/load round-trip", () => {
  it("should save and load a simple object", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("settings", { audio: 0.8 });
    const result = await persistence.load<{ audio: number }>("settings");

    expect(result).toEqual({ audio: 0.8 });
  });

  it("should preserve nested objects", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const data = { audio: { volume: 0.8, muted: false }, video: "1080p" };
    await persistence.save("prefs", data);
    const result = await persistence.load<typeof data>("prefs");

    expect(result).toEqual(data);
  });

  it("should preserve arrays", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const data = [1, 2, 3, "four", true];
    await persistence.save("arr", data);
    const result = await persistence.load<typeof data>("arr");

    expect(result).toEqual(data);
  });

  it("should save and load a primitive string", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("name", "Player1");
    const result = await persistence.load<string>("name");

    expect(result).toBe("Player1");
  });

  it("should save and load a number", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("count", 42);
    const result = await persistence.load<number>("count");

    expect(result).toBe(42);
  });

  it("should save and load a boolean", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("flag", true);
    const result = await persistence.load<boolean>("flag");

    expect(result).toBe(true);
  });

  it("should save and load an empty object", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("empty", {});
    const result = await persistence.load<Record<string, never>>("empty");

    expect(result).toEqual({});
  });

  it("should preserve data with null fields", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const data = { name: "test", value: null, count: 0 };
    await persistence.save("nullable", data);
    const result = await persistence.load<typeof data>("nullable");

    expect(result).toEqual(data);
  });

  it("should save and load multiple keys independently", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("a", "value_a");
    await persistence.save("b", "value_b");

    const a = await persistence.load<string>("a");
    const b = await persistence.load<string>("b");

    expect(a).toBe("value_a");
    expect(b).toBe("value_b");
  });

  it("should timestamp each saved entry", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const before = Date.now();
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("ts", "data");

    // Read the raw localStorage to inspect the PersistedEntry
    const storage = globalThis.localStorage as Storage;
    const raw = storage.getItem("overdrive_ts");
    expect(raw).not.toBeNull();

    const entry = JSON.parse(raw!) as {
      version: string;
      data: unknown;
      timestamp: number;
    };
    expect(entry.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry.timestamp).toBeLessThanOrEqual(Date.now());
  });

  it("should stamp the configured version on saved entries", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence({ version: "2.0.0" });
    await persistence.init();

    await persistence.save("settings", { foo: "bar" });

    const storage = globalThis.localStorage as Storage;
    const raw = storage.getItem("overdrive_settings");
    expect(raw).not.toBeNull();

    const entry = JSON.parse(raw!) as {
      version: string;
      data: unknown;
      timestamp: number;
    };
    expect(entry.version).toBe("2.0.0");
  });
});

// ---------------------------------------------------------------------------
// AC-3: load nonexistent returns null
// ---------------------------------------------------------------------------

describe("AC-3: load nonexistent returns null", () => {
  it("should return null for key that was never saved", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const result = await persistence.load("nonexistent");

    expect(result).toBeNull();
  });

  it("should return null for empty string key", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const result = await persistence.load("");

    expect(result).toBeNull();
  });

  it("should not throw when loading a nonexistent key", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    await expect(persistence.load("does_not_exist")).resolves.toBeNull();
  });

  it("should return null in Degraded state (without throwing)", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("SecurityError"));
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Degraded);

    const result = await persistence.load("anykey");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-4: Error isolation — corrupted data returns null, other keys unaffected
// ---------------------------------------------------------------------------

describe("AC-4: Error isolation — corrupted data", () => {
  it("should return null and warn for corrupted (non-JSON) data", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const storage = globalThis.localStorage as Storage;
    storage.setItem("overdrive_corrupted", "this-is-not-json{{{");

    const result = await persistence.load("corrupted");

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      '[Persistence] Corrupted entry for key "corrupted" (19 bytes)'
    );
  });

  it("should return null and warn for valid JSON that is not a PersistedEntry", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const storage = globalThis.localStorage as Storage;
    storage.setItem("overdrive_plain", JSON.stringify("just a string"));

    const result = await persistence.load("plain");

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      '[Persistence] Corrupted entry for key "plain" (15 bytes)'
    );
  });

  it("should return null and warn for a plain number (not PersistedEntry)", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const storage = globalThis.localStorage as Storage;
    storage.setItem("overdrive_num", JSON.stringify(42));

    const result = await persistence.load("num");

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      '[Persistence] Corrupted entry for key "num" (2 bytes)'
    );
  });

  it("should return null and warn for a null JSON value", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const storage = globalThis.localStorage as Storage;
    storage.setItem("overdrive_nil", JSON.stringify(null));

    const result = await persistence.load("nil");

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      '[Persistence] Corrupted entry for key "nil" (4 bytes)'
    );
  });

  it("should load valid keys unaffected after corrupted load", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    // Seed both corrupted and valid entries
    const storage = globalThis.localStorage as Storage;
    storage.setItem("overdrive_corrupt", "not-json!!!");
    storage.setItem(
      "overdrive_valid",
      JSON.stringify({
        version: "0.1.0",
        data: { x: 1 },
        timestamp: 100,
      })
    );

    // Load corrupted key first — should return null
    const corruptResult = await persistence.load("corrupt");
    expect(corruptResult).toBeNull();

    // Load valid key — should return correct data
    const validResult = await persistence.load<{ x: number }>("valid");
    expect(validResult).toEqual({ x: 1 });
  });

  it("should handle truncated JSON gracefully with warning", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const storage = globalThis.localStorage as Storage;
    storage.setItem("overdrive_truncated", '{"ver');

    const result = await persistence.load("truncated");

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      '[Persistence] Corrupted entry for key "truncated" (5 bytes)'
    );
  });

  it("should handle empty string in localStorage with warning", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const storage = globalThis.localStorage as Storage;
    storage.setItem("overdrive_empty", "");

    const result = await persistence.load("empty");

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      '[Persistence] Corrupted entry for key "empty" (0 bytes)'
    );
  });

  it("should warn for PersistedEntry missing 'data' field", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const storage = globalThis.localStorage as Storage;
    storage.setItem(
      "overdrive_nodata",
      JSON.stringify({ version: "0.1.0", timestamp: 1000 })
    );

    const result = await persistence.load("nodata");

    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      '[Persistence] Corrupted entry for key "nodata" (36 bytes)'
    );
  });

  it("should load data with extra fields beyond PersistedEntry normally", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const storage = globalThis.localStorage as Storage;
    storage.setItem(
      "overdrive_extra",
      JSON.stringify({
        version: "0.1.0",
        data: { value: 42 },
        timestamp: 100,
        extraField: "should be ignored",
      })
    );

    const result = await persistence.load<{ value: number }>("extra");

    expect(result).toEqual({ value: 42 });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should not call warn for nonexistent key (no corruption)", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const result = await persistence.load("nonexistent");

    expect(result).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should log once per corrupted key loaded, not corrupt other keys", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const storage = globalThis.localStorage as Storage;
    storage.setItem("overdrive_bad1", "garbage{{{");
    storage.setItem("overdrive_bad2", "not-json");
    storage.setItem(
      "overdrive_good",
      JSON.stringify({ version: "0.1.0", data: "ok", timestamp: 1 })
    );

    await persistence.load("bad1");
    await persistence.load("bad2");
    await persistence.load("good");

    // Should be exactly 2 warnings (one per corrupted key)
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      '[Persistence] Corrupted entry for key "bad1" (10 bytes)'
    );
    expect(warnSpy).toHaveBeenCalledWith(
      '[Persistence] Corrupted entry for key "bad2" (8 bytes)'
    );
  });
});

// ---------------------------------------------------------------------------
// AC-8: key prefix isolation
// ---------------------------------------------------------------------------

describe("AC-8: key prefix isolation", () => {
  it("should prefix keys with 'overdrive_' by default on save", async () => {
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("settings", { foo: "bar" });

    // Prefixed key should be set
    expect(storage.setItem).toHaveBeenCalledWith(
      "overdrive_settings",
      expect.any(String)
    );
    // Raw key should NOT be set
    expect(storage.getItem("settings")).toBeNull();
  });

  it("should use prefixed key on load", async () => {
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("test", "value");
    vi.clearAllMocks();

    await persistence.load("test");

    expect(storage.getItem).toHaveBeenCalledWith("overdrive_test");
  });

  it("should use prefixed key on delete", async () => {
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("test", "value");
    vi.clearAllMocks();

    await persistence.delete("test");

    expect(storage.removeItem).toHaveBeenCalledWith("overdrive_test");
  });

  it("should use custom prefix when configured via constructor", async () => {
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);
    const persistence = new Persistence({ prefix: "myapp_" });
    await persistence.init();

    await persistence.save("settings", {});

    expect(storage.setItem).toHaveBeenCalledWith(
      "myapp_settings",
      expect.any(String)
    );
    // Default prefix should not be used
    expect(storage.getItem("overdrive_settings")).toBeNull();
  });

  it("should isolate game keys from non-game localStorage entries", async () => {
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);

    // Simulate a non-game entry in localStorage
    storage.setItem("other_app_key", "other_data");

    const persistence = new Persistence();
    await persistence.init();
    await persistence.save("gamekey", "game_data");

    // The non-game key should not be touched
    expect(storage.getItem("other_app_key")).toBe("other_data");
    // The game key should be stored under prefix
    expect(storage.getItem("overdrive_gamekey")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-9: save/load/delete return Promise
// ---------------------------------------------------------------------------

describe("AC-9: save/load/delete return Promise", () => {
  it("save() should return a Promise in Ready state", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();
    const result = persistence.save("k", "v");
    expect(result).toBeInstanceOf(Promise);
  });

  it("load() should return a Promise in Ready state", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const result = persistence.load("k");

    expect(result).toBeInstanceOf(Promise);
  });

  it("delete() should return a Promise in Ready state", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const result = persistence.delete("k");

    expect(result).toBeInstanceOf(Promise);
  });

  it("save() should return a Promise in Degraded state", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("SecurityError"));
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Degraded);

    const result = persistence.save("k", "v");

    expect(result).toBeInstanceOf(Promise);
  });

  it("load() should return a Promise in Degraded state", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("SecurityError"));
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Degraded);

    const result = persistence.load("k");

    expect(result).toBeInstanceOf(Promise);
  });

  it("delete() should return a Promise in Degraded state", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("SecurityError"));
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Degraded);

    const result = persistence.delete("k");

    expect(result).toBeInstanceOf(Promise);
  });

  it("registerMigration() should NOT return a Promise", () => {
    const persistence = new Persistence();
    const result = persistence.registerMigration("0.1.0", "0.2.0", (d) => d);
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC-10: delete removes key
// ---------------------------------------------------------------------------

describe("AC-10: delete removes key", () => {
  it("should remove saved data so subsequent load returns null", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("test", "hello");
    await persistence.delete("test");

    const result = await persistence.load("test");
    expect(result).toBeNull();
  });

  it("should not throw when deleting a nonexistent key", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    await expect(persistence.delete("never_saved")).resolves.toBeUndefined();
  });

  it("should be safe to call delete twice (no-op on second call)", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("test", "value");
    await persistence.delete("test");
    // Second delete should not throw
    await expect(persistence.delete("test")).resolves.toBeUndefined();
    // Still returns null
    const result = await persistence.load("test");
    expect(result).toBeNull();
  });

  it("should not affect other keys when deleting one key", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("a", "value_a");
    await persistence.save("b", "value_b");

    await persistence.delete("a");

    const a = await persistence.load("a");
    const b = await persistence.load("b");

    expect(a).toBeNull();
    expect(b).toBe("value_b");
  });

  it("should resolve without error in Degraded state", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("SecurityError"));
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Degraded);

    await expect(persistence.delete("test")).resolves.toBeUndefined();
  });

  it("should transition to Degraded when removeItem throws during delete", async () => {
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Ready);

    // Make removeItem throw with an Error instance
    vi.spyOn(storage, "removeItem").mockImplementation(() => {
      throw new Error("removeItem failed");
    });

    await persistence.delete("test");

    expect(persistence.state).toBe(PersistenceState.Degraded);
    expect(persistence.lastError).toBe("Error");
  });

  it("should record UnknownError when removeItem throws non-Error during delete", async () => {
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Ready);

    // Make removeItem throw a non-Error value
    vi.spyOn(storage, "removeItem").mockImplementation(() => {
      throw "string error";
    });

    await persistence.delete("test");

    expect(persistence.state).toBe(PersistenceState.Degraded);
    expect(persistence.lastError).toBe("UnknownError");
  });
});

// ---------------------------------------------------------------------------
// Load edge cases: structural guard and parse failure
// ---------------------------------------------------------------------------

describe("load() edge cases", () => {
  it("should return null when localStorage holds valid JSON that is not a PersistedEntry", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    // Manually store a plain JSON string (not a PersistedEntry wrapper)
    const storage = globalThis.localStorage as Storage;
    storage.setItem("overdrive_notentry", JSON.stringify("just a string"));

    const result = await persistence.load("notentry");

    expect(result).toBeNull();
  });

  it("should return null when localStorage holds a plain number (not PersistedEntry)", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const storage = globalThis.localStorage as Storage;
    storage.setItem("overdrive_number", JSON.stringify(42));

    const result = await persistence.load("number");

    expect(result).toBeNull();
  });

  it("should return null when localStorage holds a null JSON value", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const storage = globalThis.localStorage as Storage;
    storage.setItem("overdrive_nullentry", JSON.stringify(null));

    const result = await persistence.load("nullentry");

    expect(result).toBeNull();
  });

  it("should return null when localStorage holds corrupted (non-JSON) data", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    // Manually inject non-JSON string
    const storage = globalThis.localStorage as Storage;
    storage.setItem("overdrive_corrupted", "this-is-not-json{{{");

    const result = await persistence.load("corrupted");

    expect(result).toBeNull();
  });

  it("should return null when localStorage holds a PersistedEntry without a 'data' property", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const storage = globalThis.localStorage as Storage;
    // Entry has version and timestamp but no data
    storage.setItem(
      "overdrive_nodata",
      JSON.stringify({ version: "0.1.0", timestamp: 1000 })
    );

    const result = await persistence.load("nodata");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Error transitions: save failure → Degraded
// ---------------------------------------------------------------------------

describe("Error transition: save failure → Degraded", () => {
  it("should transition to Degraded when setItem throws in Ready state", async () => {
    const storage = createWorkingStorage();
    // First save will succeed (probe already passed)
    // Override setItem to throw on the second call
    vi.stubGlobal("localStorage", storage);
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Ready);

    // Now make setItem throw
    (storage as { setItem: (...args: unknown[]) => unknown }).setItem = vi.fn(
      () => {
        throw new Error("Quota exceeded");
      }
    );

    await persistence.save("settings", { audio: 0.8 });

    expect(persistence.state).toBe(PersistenceState.Degraded);
  });

  it("should record lastError when save transitions to Degraded", async () => {
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);
    const persistence = new Persistence();
    await persistence.init();

    (storage as { setItem: (...args: unknown[]) => unknown }).setItem = vi.fn(
      () => {
        const error = new Error("Quota exceeded");
        error.name = "QuotaExceededError";
        throw error;
      }
    );

    await persistence.save("settings", {});

    expect(persistence.lastError).toBe("QuotaExceededError");
  });

  it("should record UnknownError when thrown value is not an Error", async () => {
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);
    const persistence = new Persistence();
    await persistence.init();

    (storage as { setItem: (...args: unknown[]) => unknown }).setItem = vi.fn(
      () => {
        throw "string error";
      }
    );

    await persistence.save("settings", {});

    expect(persistence.lastError).toBe("UnknownError");
  });

  it("should return null on load after Degraded transition from save", async () => {
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);
    const persistence = new Persistence();
    await persistence.init();

    (storage as { setItem: (...args: unknown[]) => unknown }).setItem = vi.fn(
      () => {
        throw new Error("fail");
      }
    );

    await persistence.save("settings", {});

    // Degraded load should return null
    const result = await persistence.load("settings");
    expect(result).toBeNull();
  });

  it("should log warning when JSON.stringify fails (circular reference)", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const circular: Record<string, unknown> = {};
    circular.self = circular;

    // Should not throw
    await expect(
      persistence.save("circular", circular)
    ).resolves.toBeUndefined();

    // Should log the serialization error
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[Persistence] Failed to serialize key "circular"'
      )
    );
  });

  it("should NOT transition to Degraded when JSON.stringify fails", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await persistence.save("circular", circular);

    // State stays Ready — only setItem failures degrade
    expect(persistence.state).toBe(PersistenceState.Ready);
    expect(persistence.lastError).toBeUndefined();
  });

  it("should handle non-Error throws during JSON.stringify gracefully", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    // Temporarily replace JSON.stringify to throw a non-Error value
    vi.stubGlobal(
      "JSON",
      Object.assign(Object.create(null), {
        ...JSON,
        stringify: vi.fn(() => {
          throw "primitive error";
        }),
      })
    );

    const warnBefore = warnSpy.mock.calls.length;

    await persistence.save("key", { data: "value" });

    // Should have logged one more warning
    expect(warnSpy.mock.calls.length).toBe(warnBefore + 1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to serialize key "key"')
    );
    // Should indicate unknown serialization error (not error.message)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unknown serialization error")
    );

    // State should remain Ready — only setItem failures degrade
    expect(persistence.state).toBe(PersistenceState.Ready);

    // Cleanup — restore JSON
    vi.unstubAllGlobals();
  });
});
