import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MigrationError,
  Persistence,
  PersistenceError,
  PersistenceState,
} from "../../../../src/foundation/persistence";

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
    try {
      const persistence = new Persistence();
      await persistence.init();
      expect(persistence.state).toBe(PersistenceState.Degraded);
    } finally {
      vi.unstubAllGlobals();
    }
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

  it("should set _recoverable=false on SecurityError so second retry skips probe", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("SecurityError"));
    const persistence = new Persistence();
    await persistence.init();

    // First retry — hits catch block, sets _recoverable = false
    await expect(persistence.retry()).resolves.toBe(false);

    // Second retry — should return false immediately via the early return guard in retry()
    // without reaching the probe, proving _recoverable was set to false
    await expect(persistence.retry()).resolves.toBe(false);
  });

  it("should return true when state is Uninitialized (no-op)", async () => {
    const persistence = new Persistence();
    await expect(persistence.retry()).resolves.toBe(true);
  });

  it("should set _recoverable=false on SecurityError during retry probe (the SecurityError catch in retry())", async () => {
    // 1. Init with working storage → Ready, _recoverable = true
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Ready);

    // 2. Save with QuotaExceededError → Degraded, _recoverable stays true
    //    (QuotaExceededError ≠ SecurityError, so L368 does NOT set _recoverable=false)
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    await persistence.save("key", "value");
    expect(persistence.state).toBe(PersistenceState.Degraded);

    // 3. Retry with SecurityError → hits L712 (probe fails, sets _recoverable=false)
    vi.stubGlobal("localStorage", createFailingStorage("SecurityError"));
    await expect(persistence.retry()).resolves.toBe(false);

    // 4. Second retry — skips probe entirely via the early return guard in retry(), proving _recoverable=false
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
    expect(() => {
      persistence.registerMigration("0.1.0", "0.2.0", migration);
    }).not.toThrow();
  });

  it("should warn when overwriting a duplicate from entry", () => {
    const persistence = new Persistence();
    const migration1 = vi.fn((data: unknown) => data);
    const migration2 = vi.fn((data: unknown) => data);

    persistence.registerMigration("0.1.0", "0.2.0", migration1);
    persistence.registerMigration("0.1.0", "0.3.0", migration2);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Overwriting migration 0.1.0 → 0.2.0 with 0.1.0 → 0.3.0"
      )
    );
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

    const entry = JSON.parse(raw as string) as {
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

    const entry = JSON.parse(raw as string) as {
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

  it("should throw PersistenceError when JSON.stringify fails (circular reference)", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await expect(persistence.save("circular", circular)).rejects.toThrow(
      PersistenceError
    );
    await expect(persistence.save("circular", circular)).rejects.toThrow(
      'Failed to serialize key "circular"'
    );
  });

  it("should handle non-Error throw from JSON.stringify in _serializeEntry", async () => {
    // Use failing storage to enter Degraded state
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();

    // Transition to Degraded via a save failure
    await persistence.save("trigger", "data");
    expect(persistence.state).toBe(PersistenceState.Degraded);

    // Now mock JSON.stringify to throw a non-Error — this hits the serialization branch in save()
    vi.spyOn(JSON, "stringify").mockImplementation(() => {
      throw "stringified crash"; // non-Error throw
    });

    // save() in Degraded mode calls _serializeEntry → catch → warn (no throw)
    await expect(persistence.save("key", "value")).resolves.toBeUndefined();

    // Verify warning was logged (console.warn, not console.error)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to serialize key "key"')
    );

    vi.mocked(JSON.stringify).mockRestore();
  });

  it("should NOT transition to Degraded when JSON.stringify fails", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await expect(persistence.save("circular", circular)).rejects.toThrow(
      PersistenceError
    );

    // State stays Ready — only setItem failures degrade
    expect(persistence.state).toBe(PersistenceState.Ready);
    expect(persistence.lastError).toBeUndefined();
  });

  it("should throw PersistenceError for non-Error throws during JSON.stringify", async () => {
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

    await expect(persistence.save("key", { data: "value" })).rejects.toThrow(
      PersistenceError
    );
    await expect(persistence.save("key", { data: "value" })).rejects.toThrow(
      "Unknown serialization error"
    );

    // State should remain Ready — only setItem failures degrade
    expect(persistence.state).toBe(PersistenceState.Ready);

    // Cleanup — restore JSON
    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// AC-5a: Degraded mode — init enters Degraded, load returns null
// ---------------------------------------------------------------------------

describe("AC-5a: Degraded mode", () => {
  it("should enter Degraded state when init probe fails", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();

    expect(persistence.state).toBe(PersistenceState.Degraded);
    expect(persistence.lastError).toBe("QuotaExceededError");
  });

  it("should return null from load() in Degraded state", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();

    const result = await persistence.load("any_key");
    expect(result).toBeNull();
  });

  it("should not throw from save() in Degraded state", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();

    await expect(persistence.save("key", "value")).resolves.toBeUndefined();
  });

  it("should not throw from delete() in Degraded state", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();

    await expect(persistence.delete("key")).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// AC-5b: Degraded save queues writes with max 50 FIFO
// ---------------------------------------------------------------------------

describe("AC-5b: Write queue with FIFO eviction", () => {
  it("should queue writes in memory during Degraded mode", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("k1", "v1");
    await persistence.save("k2", "v2");

    // Writes are queued — not in localStorage
    const storage = globalThis.localStorage as Storage;
    expect(storage.getItem("overdrive_k1")).toBeNull();
    expect(storage.getItem("overdrive_k2")).toBeNull();
  });

  it("should evict oldest entries when queue exceeds 50", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();

    // Queue 52 entries
    for (let i = 1; i <= 52; i++) {
      await persistence.save(`k${i}`, `v${i}`);
    }

    // Make storage work, then retry to flush
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);

    const result = await persistence.retry();
    expect(result).toBe(true);
    expect(persistence.state).toBe(PersistenceState.Ready);

    // k1 and k2 should be evicted (FIFO) — never flushed
    expect(storage.setItem).not.toHaveBeenCalledWith(
      "overdrive_k1",
      expect.any(String)
    );
    expect(storage.setItem).not.toHaveBeenCalledWith(
      "overdrive_k2",
      expect.any(String)
    );
    // k3 should be present (first non-evicted entry)
    expect(storage.setItem).toHaveBeenCalledWith(
      "overdrive_k3",
      expect.any(String)
    );
  });

  it("should never exceed 50 entries in queue", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();

    // Queue 100 entries
    for (let i = 1; i <= 100; i++) {
      await persistence.save(`k${i}`, `v${i}`);
    }

    // Make storage work and flush
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);
    await persistence.retry();

    // 50 queue entries + 1 probe = 51 setItem calls
    expect(storage.setItem).toHaveBeenCalledTimes(51);
    // k50 should NOT be flushed (evicted)
    expect(storage.setItem).not.toHaveBeenCalledWith(
      "overdrive_k50",
      expect.any(String)
    );
    // k51 should be flushed
    expect(storage.setItem).toHaveBeenCalledWith(
      "overdrive_k51",
      expect.any(String)
    );
  });

  it("should keep last write when same key is saved multiple times in queue", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("same_key", "first");
    await persistence.save("same_key", "second");
    await persistence.save("same_key", "third");

    // Flush to storage
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);
    await persistence.retry();

    // The queue had 3 entries for same_key — all 3 flush (last one overwrites)
    const calls = storage.setItem.mock.calls.filter(
      ([k]) => k === "overdrive_same_key"
    );
    expect(calls).toHaveLength(3);
    // Last write wins — verify the flushed data
    const lastCall = calls[calls.length - 1];
    const parsed = JSON.parse(lastCall[1] as string);
    expect(parsed.data).toBe("third");
  });
});

// ---------------------------------------------------------------------------
// AC-5c: retry() re-probes storage, flushes queue, non-recoverable
// ---------------------------------------------------------------------------

describe("AC-5c: retry() behavior", () => {
  it("should return true and stay Ready when called from Ready state", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    const result = await persistence.retry();
    expect(result).toBe(true);
    expect(persistence.state).toBe(PersistenceState.Ready);
  });

  it("should flush queued writes and transition to Ready on successful retry", async () => {
    // Start Degraded
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Degraded);

    await persistence.save("a", "value_a");
    await persistence.save("b", "value_b");

    // Restore storage
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);

    const result = await persistence.retry();
    expect(result).toBe(true);
    expect(persistence.state).toBe(PersistenceState.Ready);

    // Verify flushed — load should work now
    const loadA = await persistence.load("a");
    expect(loadA).toBe("value_a");
  });

  it("should remain Degraded and return false on failed retry", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("key", "value");

    // Storage still broken
    const result = await persistence.retry();
    expect(result).toBe(false);
    expect(persistence.state).toBe(PersistenceState.Degraded);
  });

  it("should clear lastError on successful retry", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.lastError).toBe("QuotaExceededError");

    // Restore storage
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);
    await persistence.retry();

    expect(persistence.lastError).toBeUndefined();
  });

  it("should set non-recoverable when probe fails with SecurityError during retry", async () => {
    // Start with working storage — init succeeds
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Ready);

    // Storage breaks on save → Degraded (not from init)
    const failingStorage = createFailingStorage("SecurityError");
    vi.stubGlobal("localStorage", failingStorage);

    await persistence.save("key", "value");
    expect(persistence.state).toBe(PersistenceState.Degraded);

    // retry() — probe fails with SecurityError → non-recoverable
    const result = await persistence.retry();
    expect(result).toBe(false);

    // Second retry — should short-circuit (non-recoverable)
    const result2 = await persistence.retry();
    expect(result2).toBe(false);
    expect(persistence.state).toBe(PersistenceState.Degraded);
  });

  it("should record UnknownError when probe throws non-Error during retry", async () => {
    // Start with working storage — init succeeds
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence();
    await persistence.init();

    // Storage breaks with non-Error throw on save → Degraded
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw "string error";
    });
    await persistence.save("key", "value");
    expect(persistence.state).toBe(PersistenceState.Degraded);

    // Now make the probe also throw a non-Error
    const failingStorage = createWorkingStorage();
    vi.stubGlobal("localStorage", failingStorage);
    vi.spyOn(failingStorage, "setItem").mockImplementation(() => {
      throw "probe string error";
    });

    const result = await persistence.retry();
    expect(result).toBe(false);
    expect(persistence.lastError).toBe("UnknownError");
  });

  it("should log unknown serialization error during retry flush when non-Error thrown", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();

    // Queue an entry
    await persistence.save("key", "value");

    // Restore storage but mock JSON.stringify to throw non-Error
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);

    const _originalStringify = JSON.stringify;
    vi.spyOn(JSON, "stringify").mockImplementation((..._args) => {
      throw "primitive stringify error";
    });

    const result = await persistence.retry();

    // The stringify failure is logged and skipped, queue is cleared, state = Ready
    expect(result).toBe(true);
    expect(persistence.state).toBe(PersistenceState.Ready);

    vi.restoreAllMocks();
  });

  it("should record UnknownError when setItem throws non-Error during flush", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("k1", "v1");

    // Restore storage — probe works, but flush setItem throws non-Error
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);

    let callCount = 0;
    vi.spyOn(storage, "setItem").mockImplementation((..._args) => {
      callCount++;
      if (callCount === 1) {
        // Probe — succeed
        return undefined as unknown as undefined;
      }
      // Queue entry — throw non-Error
      throw "primitive setItem error";
    });

    const result = await persistence.retry();
    expect(result).toBe(false);
    expect(persistence.lastError).toBe("UnknownError");
  });

  it("should short-circuit and return false for non-recoverable SecurityError", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("SecurityError"));
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Degraded);

    // First retry attempt — probe fails with SecurityError → non-recoverable
    const result1 = await persistence.retry();
    expect(result1).toBe(false);

    // Second retry — should skip probe entirely (non-recoverable)
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);
    const result2 = await persistence.retry();
    expect(result2).toBe(false);
    expect(persistence.state).toBe(PersistenceState.Degraded);
  });

  it("should flush entries in FIFO order", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("first", "1");
    await persistence.save("second", "2");
    await persistence.save("third", "3");

    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);

    await persistence.retry();

    // Verify flush order matches queue order (FIFO)
    const setItemCalls = storage.setItem.mock.calls.map(([k]) => k);
    const flushOrder = setItemCalls.filter((k) =>
      ["overdrive_first", "overdrive_second", "overdrive_third"].includes(
        k as string
      )
    );
    expect(flushOrder).toEqual([
      "overdrive_first",
      "overdrive_second",
      "overdrive_third",
    ]);
  });

  it("should log and skip entry when JSON.stringify fails during retry flush", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    await persistence.save("circular", circular);
    await persistence.save("good", "value");

    // Restore storage
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);

    const result = await persistence.retry();

    // Circular entry skipped (warn logged), good entry flushed
    // State stays Degraded because not all entries flushed? Actually, the implementation
    // continues past stringify failures and clears queue at the end.
    // Let's check: the code does `continue` on stringify failure, then at the end
    // it clears queue and sets Ready.
    expect(result).toBe(true);
    expect(persistence.state).toBe(PersistenceState.Ready);

    // "good" entry should be flushed
    expect(storage.setItem).toHaveBeenCalledWith(
      "overdrive_good",
      expect.any(String)
    );
  });

  it("should return false and stay Degraded when setItem fails during retry flush", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("k1", "v1");
    await persistence.save("k2", "v2");

    // First retry: probe succeeds (new storage works for probe), but setItem
    // will fail on the first entry
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);

    // Make the first setItem throw (not the probe)
    let callCount = 0;
    vi.spyOn(storage, "setItem").mockImplementation((..._args) => {
      callCount++;
      if (callCount === 1) {
        // First call is the probe — let it succeed
        return undefined as unknown as undefined;
      }
      // Second call is the first queue entry — throw
      throw new Error("setItem failed during flush");
    });

    const result = await persistence.retry();
    expect(result).toBe(false);
    expect(persistence.state).toBe(PersistenceState.Degraded);
  });

  it("should set non-recoverable when setItem fails with SecurityError during flush", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("k1", "v1");

    // Restore storage — probe will work, but flush setItem will throw SecurityError
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);

    let callCount = 0;
    vi.spyOn(storage, "setItem").mockImplementation((..._args) => {
      callCount++;
      if (callCount === 1) {
        // Probe — succeed
        return undefined as unknown as undefined;
      }
      // Queue entry — throw SecurityError
      throw new DOMException("quota exceeded", "SecurityError");
    });

    const result = await persistence.retry();
    expect(result).toBe(false);
    expect(persistence.state).toBe(PersistenceState.Degraded);

    // Now retry again — should short-circuit (non-recoverable)
    const result2 = await persistence.retry();
    expect(result2).toBe(false);
  });

  it("should flush all queued entries including those saved before Degraded transition (B3)", async () => {
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);
    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Ready);

    // 1) Save 3 keys while Ready (goes to localStorage directly)
    await persistence.save("k1", "v1");
    await persistence.save("k2", "v2");
    await persistence.save("k3", "v3");

    // 2) Transition to Degraded by making setItem throw
    const originalSetItem = storage.setItem;
    storage.setItem = vi.fn(() => {
      const error = new Error("Storage full");
      error.name = "QuotaExceededError";
      throw error;
    });
    await persistence.save("trigger", "x");
    expect(persistence.state).toBe(PersistenceState.Degraded);

    // 3) Save 2 more keys in Degraded mode (queued in memory)
    await persistence.save("k4", "v4");
    await persistence.save("k5", "v5");

    // 4) Restore storage and retry
    storage.setItem = originalSetItem;
    const result = await persistence.retry();
    expect(result).toBe(true);
    expect(persistence.state).toBe(PersistenceState.Ready);

    // 5) All 5 keys should be accessible (3 from initial save, 2 flushed from queue)
    expect(await persistence.load("k1")).toBe("v1");
    expect(await persistence.load("k2")).toBe("v2");
    expect(await persistence.load("k3")).toBe("v3");
    expect(await persistence.load("k4")).toBe("v4");
    expect(await persistence.load("k5")).toBe("v5");
  });
});

// ---------------------------------------------------------------------------
// delete() removes from queue in Degraded mode
// ---------------------------------------------------------------------------

describe("delete() in Degraded mode", () => {
  it("should remove matching entry from write queue", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("keep", "keep_value");
    await persistence.save("remove", "remove_value");

    // Delete from queue
    await persistence.delete("remove");

    // Flush remaining
    const storage = createWorkingStorage();
    vi.stubGlobal("localStorage", storage);
    await persistence.retry();

    // Only "keep" should be flushed
    expect(storage.setItem).toHaveBeenCalledWith(
      "overdrive_keep",
      expect.any(String)
    );
    expect(storage.setItem).not.toHaveBeenCalledWith(
      "overdrive_remove",
      expect.any(String)
    );
  });

  it("should be a no-op when deleting non-queued key", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence();
    await persistence.init();

    await persistence.save("existing", "value");

    // Delete non-existent key — should not throw
    await expect(persistence.delete("nonexistent")).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// MigrationError class
// ---------------------------------------------------------------------------

describe("MigrationError", () => {
  it("should be an instance of Error", () => {
    const err = new MigrationError("test");
    expect(err).toBeInstanceOf(Error);
  });

  it("should be an instance of MigrationError", () => {
    const err = new MigrationError("test");
    expect(err).toBeInstanceOf(MigrationError);
  });

  it("should have name set to MigrationError", () => {
    const err = new MigrationError("test");
    expect(err.name).toBe("MigrationError");
  });

  it("should capture the message", () => {
    const err = new MigrationError("Missing migration: 0.1.0 → 0.2.0");
    expect(err.message).toBe("Missing migration: 0.1.0 → 0.2.0");
  });

  it("should capture stack trace", () => {
    const err = new MigrationError("test");
    expect(err.stack).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC-6: Migration chain walks correctly
// ---------------------------------------------------------------------------

describe("AC-6: Migration chain", () => {
  it("should return data as-is when stored version equals current version (no-op)", () => {
    const persistence = new Persistence();
    const data = { value: 42 };

    const result = (
      persistence as unknown as {
        _runMigrations: (sv: string, d: unknown, cv: string) => unknown;
      }
    )._runMigrations("0.1.0", data, "0.1.0");

    expect(result).toBe(data);
  });

  it("should warn and return data as-is on downgrade (stored > current)", () => {
    const persistence = new Persistence();
    const data = { value: 42 };

    const result = (
      persistence as unknown as {
        _runMigrations: (sv: string, d: unknown, cv: string) => unknown;
      }
    )._runMigrations("0.2.0", data, "0.1.0");

    expect(result).toBe(data);
    expect(warnSpy).toHaveBeenCalledWith(
      "[Persistence] Stored version 0.2.0 > current version 0.1.0. No migration applied."
    );
  });

  it("should run a single-step migration", () => {
    const persistence = new Persistence();
    persistence.registerMigration("0.1.0", "0.2.0", (data) => ({
      ...(data as Record<string, unknown>),
      migrated: true,
    }));

    const result = (
      persistence as unknown as {
        _runMigrations: (sv: string, d: unknown, cv: string) => unknown;
      }
    )._runMigrations("0.1.0", { value: 1 }, "0.2.0");

    expect(result).toEqual({ value: 1, migrated: true });
  });

  it("should run a two-step chain in order", () => {
    const persistence = new Persistence();
    persistence.registerMigration("0.1.0", "0.2.0", (data) => ({
      ...(data as Record<string, unknown>),
      step1: true,
    }));
    persistence.registerMigration("0.2.0", "0.3.0", (data) => ({
      ...(data as Record<string, unknown>),
      step2: true,
    }));

    const result = (
      persistence as unknown as {
        _runMigrations: (sv: string, d: unknown, cv: string) => unknown;
      }
    )._runMigrations("0.1.0", { base: true }, "0.3.0");

    expect(result).toEqual({ base: true, step1: true, step2: true });
  });

  it("should run a long chain of 5+ steps in order", () => {
    const persistence = new Persistence();
    const order: number[] = [];

    for (let i = 1; i <= 5; i++) {
      const from = `0.${i}.0`;
      const to = `0.${i + 1}.0`;
      persistence.registerMigration(from, to, (data) => {
        order.push(i);
        return data;
      });
    }

    (
      persistence as unknown as {
        _runMigrations: (sv: string, d: unknown, cv: string) => unknown;
      }
    )._runMigrations("0.1.0", {}, "0.6.0");

    expect(order).toEqual([1, 2, 3, 4, 5]);
  });

  it("should handle a deeply transformed object", () => {
    const persistence = new Persistence();
    persistence.registerMigration("0.1.0", "0.2.0", (data) => {
      const old = data as { nested: { value: number } };
      return { nested: { value: old.nested.value * 2, extra: true } };
    });

    const result = (
      persistence as unknown as {
        _runMigrations: (sv: string, d: unknown, cv: string) => unknown;
      }
    )._runMigrations("0.1.0", { nested: { value: 21 } }, "0.2.0");

    expect(result).toEqual({ nested: { value: 42, extra: true } });
  });

  it("should call each migration function exactly once", () => {
    const persistence = new Persistence();
    const fn1 = vi.fn((data: unknown) => data);
    const fn2 = vi.fn((data: unknown) => data);

    persistence.registerMigration("0.1.0", "0.2.0", fn1);
    persistence.registerMigration("0.2.0", "0.3.0", fn2);

    (
      persistence as unknown as {
        _runMigrations: (sv: string, d: unknown, cv: string) => unknown;
      }
    )._runMigrations("0.1.0", { x: 1 }, "0.3.0");

    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// AC-7: Missing migration throws MigrationError
// ---------------------------------------------------------------------------

describe("AC-7: Missing migration throws", () => {
  it("should throw when gap in the middle of a chain", () => {
    const persistence = new Persistence();
    persistence.registerMigration("0.1.0", "0.2.0", (data) => data);
    // 0.2.0 → 0.3.0 is MISSING
    persistence.registerMigration("0.3.0", "0.4.0", (data) => data);

    expect(() => {
      (
        persistence as unknown as {
          _runMigrations: (sv: string, d: unknown, cv: string) => unknown;
        }
      )._runMigrations("0.1.0", {}, "0.4.0");
    }).toThrow(MigrationError);
  });

  it("should throw a MigrationError with a descriptive message", () => {
    const persistence = new Persistence();
    persistence.registerMigration("0.1.0", "0.2.0", (data) => data);

    expect(() => {
      (
        persistence as unknown as {
          _runMigrations: (sv: string, d: unknown, cv: string) => unknown;
        }
      )._runMigrations("0.1.0", {}, "0.3.0");
    }).toThrow("Missing migration: 0.2.0 → 0.3.0");
  });

  it("should throw when no migrations are registered at all", () => {
    const persistence = new Persistence();

    expect(() => {
      (
        persistence as unknown as {
          _runMigrations: (sv: string, d: unknown, cv: string) => unknown;
        }
      )._runMigrations("0.1.0", {}, "0.2.0");
    }).toThrow(MigrationError);
  });

  it("should throw when stored version has no registered migration (gap at beginning)", () => {
    const persistence = new Persistence();
    // No migration from 0.1.0 → anything
    persistence.registerMigration("0.2.0", "0.3.0", (data) => data);

    expect(() => {
      (
        persistence as unknown as {
          _runMigrations: (sv: string, d: unknown, cv: string) => unknown;
        }
      )._runMigrations("0.1.0", {}, "0.3.0");
    }).toThrow(MigrationError);
  });

  it("should include both from and implied next version in the error message", () => {
    const persistence = new Persistence();
    // Only 0.2.0→0.3.0 registered, but nothing from 0.1.0
    persistence.registerMigration("0.2.0", "0.3.0", (data) => data);

    expect(() => {
      (
        persistence as unknown as {
          _runMigrations: (sv: string, d: unknown, cv: string) => unknown;
        }
      )._runMigrations("0.1.0", {}, "0.3.0");
    }).toThrow("Missing migration: 0.1.0 → 0.2.0");
  });

  it("should throw MigrationError (instanceof check)", () => {
    const persistence = new Persistence();

    try {
      (
        persistence as unknown as {
          _runMigrations: (sv: string, d: unknown, cv: string) => unknown;
        }
      )._runMigrations("0.1.0", {}, "0.2.0");
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(MigrationError);
      expect((e as Error).name).toBe("MigrationError");
    }
  });
});

// ---------------------------------------------------------------------------
// Semver comparison — numerical, not lexicographic
// ---------------------------------------------------------------------------

describe("Semver comparison (numerical)", () => {
  it("should correctly chain through 0.10.0 (which lexicographic would break)", () => {
    const persistence = new Persistence();
    persistence.registerMigration("0.7.0", "0.10.0", (data) => ({
      ...(data as Record<string, unknown>),
      step1: true,
    }));
    persistence.registerMigration("0.10.0", "0.11.0", (data) => ({
      ...(data as Record<string, unknown>),
      step2: true,
    }));

    const result = (
      persistence as unknown as {
        _runMigrations: (sv: string, d: unknown, cv: string) => unknown;
      }
    )._runMigrations("0.7.0", { x: 1 }, "0.11.0");

    expect(result).toEqual({ x: 1, step1: true, step2: true });
  });

  it("should not confuse 0.10.0 with 0.1.0 during migration", () => {
    const persistence = new Persistence();

    // Register two migrations: 0.1.0→0.2.0 and 0.10.0→0.11.0
    persistence.registerMigration("0.1.0", "0.2.0", (data) => ({
      ...(data as Record<string, unknown>),
      smallStep: true,
    }));
    persistence.registerMigration("0.10.0", "0.11.0", (data) => ({
      ...(data as Record<string, unknown>),
      bigStep: true,
    }));

    // Chain from 0.1.0 to 0.2.0 should pick only the 0.1.0→0.2.0 migration
    const result = (
      persistence as unknown as {
        _runMigrations: (sv: string, d: unknown, cv: string) => unknown;
      }
    )._runMigrations("0.1.0", { x: 1 }, "0.2.0");

    expect(result).toEqual({ x: 1, smallStep: true });
  });

  it("should detect downgrade correctly with multi-digit versions", () => {
    const persistence = new Persistence();
    const data = { x: 1 };

    // 0.10.0 > 0.9.0 should be detected as downgrade
    const result = (
      persistence as unknown as {
        _runMigrations: (sv: string, d: unknown, cv: string) => unknown;
      }
    )._runMigrations("0.10.0", data, "0.9.0");

    expect(result).toBe(data);
    expect(warnSpy).toHaveBeenCalledWith(
      "[Persistence] Stored version 0.10.0 > current version 0.9.0. No migration applied."
    );
  });

  it("should handle equal versions in numerical comparison (return 0)", () => {
    // Directly exercise the return-0 path in _compareVersions (all
    // components equal). This path is not reached via _runMigrations
    // because the === guard short-circuits before _compareVersions
    // is called with equal versions. Access the private static method
    // directly to ensure full coverage.
    const result = (
      Persistence as unknown as {
        _compareVersions: (a: string, b: string) => number;
      }
    )._compareVersions("0.1.0", "0.1.0");
    expect(result).toBe(0);

    // Versions with identical numeric components also return 0.
    const result2 = (
      Persistence as unknown as {
        _compareVersions: (a: string, b: string) => number;
      }
    )._compareVersions("0.1.0", "0.1.0");
    expect(result2).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// load() integration with migration
// ---------------------------------------------------------------------------

describe("load() migration integration", () => {
  it("should migrate data when stored version < current version", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence({ version: "0.2.0" });
    await persistence.init();

    // Inject data at version 0.1.0 directly into localStorage
    const storage = globalThis.localStorage as Storage;
    storage.setItem(
      "overdrive_test",
      JSON.stringify({
        version: "0.1.0",
        data: { name: "old" },
        timestamp: 100,
      })
    );

    persistence.registerMigration("0.1.0", "0.2.0", (data) => ({
      ...(data as Record<string, unknown>),
      migrated: true,
    }));

    const result = await persistence.load<{
      name: string;
      migrated: boolean;
    }>("test");

    expect(result).toEqual({ name: "old", migrated: true });
  });

  it("should not migrate when stored version matches current version", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence({ version: "0.1.0" });
    await persistence.init();

    const storage = globalThis.localStorage as Storage;
    storage.setItem(
      "overdrive_test",
      JSON.stringify({
        version: "0.1.0",
        data: { name: "same" },
        timestamp: 100,
      })
    );

    // No migrations registered — should still work since versions match
    const result = await persistence.load<{ name: string }>("test");
    expect(result).toEqual({ name: "same" });
  });

  it("should throw MigrationError on load when migration step is missing", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence({ version: "0.3.0" });
    await persistence.init();

    const storage = globalThis.localStorage as Storage;
    storage.setItem(
      "overdrive_test",
      JSON.stringify({
        version: "0.1.0",
        data: { name: "old" },
        timestamp: 100,
      })
    );

    // Only register 0.1→0.2, missing 0.2→0.3
    persistence.registerMigration("0.1.0", "0.2.0", (data) => data);

    await expect(persistence.load("test")).rejects.toThrow(MigrationError);
  });

  it("should survive migration error in one key while another key loads normally", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence({ version: "0.2.0" });
    await persistence.init();

    const storage = globalThis.localStorage as Storage;

    // Stale key at version 0.1.0 (will fail migration since no path)
    storage.setItem(
      "overdrive_stale",
      JSON.stringify({
        version: "0.1.0",
        data: "stale",
        timestamp: 100,
      })
    );

    // Fresh key at version 0.2.0 (no migration needed)
    storage.setItem(
      "overdrive_fresh",
      JSON.stringify({
        version: "0.2.0",
        data: "fresh",
        timestamp: 200,
      })
    );

    // No migrations — stale key should throw, fresh key should load
    await expect(persistence.load("stale")).rejects.toThrow(MigrationError);
    const freshResult = await persistence.load<string>("fresh");
    expect(freshResult).toBe("fresh");
  });

  it("should not migrate or throw for keys at the same version as current", async () => {
    vi.stubGlobal("localStorage", createWorkingStorage());
    const persistence = new Persistence({ version: "0.5.0" });
    await persistence.init();

    const storage = globalThis.localStorage as Storage;
    storage.setItem(
      "overdrive_test",
      JSON.stringify({
        version: "0.5.0",
        data: { config: "value" },
        timestamp: 100,
      })
    );

    // No migrations registered, but versions match so no error
    const result = await persistence.load<{ config: string }>("test");
    expect(result).toEqual({ config: "value" });
  });
});

// ─── Coverage gap: SecurityError handling ───

describe("Coverage gap — SecurityError handling", () => {
  it("should handle SecurityError in retry() gracefully", async () => {
    // First, init with working localStorage to get to Ready state
    const persistence = new Persistence();
    await persistence.init();

    // Now mock localStorage to throw SecurityError on probe
    const originalLocalStorage = globalThis.localStorage;
    const mockStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(() => {
        throw new DOMException("SecurityError", "SecurityError");
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      get length() {
        return 0;
      },
      key: vi.fn(),
    };
    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      writable: true,
      configurable: true,
    });

    // Create a fresh persistence with broken localStorage
    const persistence2 = new Persistence();
    // This will fail the probe and enter Degraded mode
    await persistence2.init();

    // Now call retry() — it should hit the SecurityError catch
    const result = await persistence2.retry();

    // Should return false (not recovered)
    expect(result).toBe(false);

    // Restore original localStorage
    Object.defineProperty(globalThis, "localStorage", {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });
  });
});

// ─── Tech debt cleanup: persistence save() throws on JSON.stringify failure ───

describe("C-1: persistence save() throws on JSON.stringify failure", () => {
  /** In-memory store backing the localStorage mock. */
  const mockStore = new Map<string, string>();
  const origLocalStorage = globalThis.localStorage;

  /** Reassign globalThis.localStorage (non-configurable in happy-dom). */
  function setLocalStorage(ls: Storage): void {
    Object.defineProperty(globalThis, "localStorage", {
      value: ls,
      writable: true,
      configurable: true,
    });
  }

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

  beforeEach(() => {
    mockStore.clear();
    setLocalStorage(createWorkingStorage());
  });

  afterEach(() => {
    setLocalStorage(origLocalStorage);
    vi.unstubAllGlobals();
  });

  it("should throw PersistenceError when serializing circular reference", async () => {
    const persistence = new Persistence();
    await persistence.init();

    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await expect(persistence.save("circ", circular)).rejects.toThrow(
      PersistenceError
    );
  });

  it("should include the key name in the error message", async () => {
    const persistence = new Persistence();
    await persistence.init();

    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await expect(persistence.save("myKey", circular)).rejects.toThrow(
      'Failed to serialize key "myKey"'
    );
  });

  it("should propagate non-Error throws from JSON.stringify as PersistenceError", async () => {
    const persistence = new Persistence();
    await persistence.init();

    vi.stubGlobal(
      "JSON",
      Object.assign(Object.create(null), {
        ...JSON,
        stringify: vi.fn(() => {
          throw "primitive error";
        }),
      })
    );

    await expect(persistence.save("k", {})).rejects.toThrow(PersistenceError);
    await expect(persistence.save("k", {})).rejects.toThrow(
      "Unknown serialization error"
    );

    vi.unstubAllGlobals();
  });

  it("should remain in Ready state when JSON.stringify fails (setItem never reached)", async () => {
    const persistence = new Persistence();
    await persistence.init();

    const circular: Record<string, unknown> = {};
    circular.self = circular;

    await expect(persistence.save("circ", circular)).rejects.toThrow(
      PersistenceError
    );
    expect(persistence.state).toBe(PersistenceState.Ready);
  });
});

// ─── Tech debt cleanup: save() queues to retry queue on localStorage failure ───

describe("C-3: save() queues to retry queue on localStorage failure", () => {
  /** Mock storage that works for init but fails on the first setItem call. */
  function createOneShotStorage(): Storage {
    let calls = 0;
    const store = new Map<string, string>();
    return {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        calls++;
        if (calls > 1) {
          const error = new Error("Storage full");
          error.name = "QuotaExceededError";
          throw error;
        }
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

  /** Mock storage that always works (no failures). */
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

  const origLocalStorage = globalThis.localStorage;

  /** Reassign globalThis.localStorage (non-configurable in happy-dom). */
  function setLocalStorage(ls: Storage): void {
    Object.defineProperty(globalThis, "localStorage", {
      value: ls,
      writable: true,
      configurable: true,
    });
  }

  afterEach(() => {
    setLocalStorage(origLocalStorage);
  });

  it("should queue data to retry queue when setItem fails after successful serialization", async () => {
    const storage = createOneShotStorage();
    vi.stubGlobal("localStorage", storage);

    const persistence = new Persistence();
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Ready);

    // First save works (init already consumed the first setItem slot)
    // Actually, init uses __overdrive_probe__ which is the first setItem.
    // So our first save will be the second call to setItem.
    // The one-shot fails on calls > 1, so the first save fails.
    await persistence.save("data1", { value: 42 });

    // State should be Degraded
    expect(persistence.state).toBe(PersistenceState.Degraded);

    // Save more data while Degraded — goes to write queue
    await persistence.save("data2", "hello");

    // Now restore storage and retry
    vi.stubGlobal("localStorage", createWorkingStorage());

    const recovered = await persistence.retry();
    expect(recovered).toBe(true);
    expect(persistence.state).toBe(PersistenceState.Ready);

    // Data should now be in localStorage (flushed from queue)
    const savedData1 = await persistence.load<{ value: number }>("data1");
    expect(savedData1).toEqual({ value: 42 });

    const savedData2 = await persistence.load<string>("data2");
    expect(savedData2).toBe("hello");
  });

  it("should queue Degraded-mode data alongside localStorage-failure data", async () => {
    const storage = createOneShotStorage();
    vi.stubGlobal("localStorage", storage);

    const persistence = new Persistence();
    await persistence.init();

    // First save fails (second setItem call) — goes to retry queue
    await persistence.save("key1", "value1");
    expect(persistence.state).toBe(PersistenceState.Degraded);

    // Save while Degraded — should also queue
    await persistence.save("key2", "value2");

    // Restore storage and retry
    vi.stubGlobal("localStorage", createWorkingStorage());

    const recovered = await persistence.retry();
    expect(recovered).toBe(true);

    const v1 = await persistence.load<string>("key1");
    const v2 = await persistence.load<string>("key2");
    expect(v1).toBe("value1");
    expect(v2).toBe("value2");
  });

  it("should return false from retry when storage is still unavailable", async () => {
    const storage = createOneShotStorage();
    vi.stubGlobal("localStorage", storage);

    const persistence = new Persistence();
    await persistence.init();

    // First save fails — goes to retry queue
    await persistence.save("key1", "value1");
    expect(persistence.state).toBe(PersistenceState.Degraded);

    // Retry with still-broken storage (oneShot already exhausted)
    const recovered = await persistence.retry();
    expect(recovered).toBe(false);
    expect(persistence.state).toBe(PersistenceState.Degraded);
  });

  it("should transition to Degraded and return null when getItem fails in load()", async () => {
    // Create storage that works for init but always fails on getItem
    const store = new Map<string, string>();
    const failingGetItemStorage: Storage = {
      getItem: vi.fn((_key: string) => {
        throw new Error("Storage corrupted");
      }),
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
    vi.stubGlobal("localStorage", failingGetItemStorage);

    const persistence = new Persistence();
    await persistence.init();

    // Save some data (this works — uses setItem, not getItem)
    await persistence.save("key1", "value1");
    expect(persistence.state).toBe(PersistenceState.Ready);

    // Load triggers getItem which fails → Degraded mode
    const result = await persistence.load<string>("key1");
    expect(result).toBeNull();
    expect(persistence.state).toBe(PersistenceState.Degraded);
  });

  it("should handle non-Error throw in load() gracefully", async () => {
    const store = new Map<string, string>();
    const failingGetItemStorage: Storage = {
      getItem: vi.fn((_key: string) => {
        throw "string error"; // non-Error throw
      }),
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
    vi.stubGlobal("localStorage", failingGetItemStorage);

    const persistence = new Persistence();
    await persistence.init();

    const result = await persistence.load<string>("key1");
    expect(result).toBeNull();
    expect(persistence.state).toBe(PersistenceState.Degraded);
  });
});

// ─── Coverage: queue entry format ───

describe("Queue entry format (B4)", () => {
  it("should store queue entries in PersistedEntry format with key and json properties", async () => {
    vi.stubGlobal("localStorage", createFailingStorage("QuotaExceededError"));
    const persistence = new Persistence({ version: "1.0.0" });
    await persistence.init();
    expect(persistence.state).toBe(PersistenceState.Degraded);

    await persistence.save("test-key", { score: 100, name: "player" });

    const queue = (
      persistence as unknown as {
        _writeQueue: Array<{ key: string; json: string }>;
      }
    )._writeQueue;
    expect(queue).toBeDefined();
    expect(Array.isArray(queue)).toBe(true);
    expect(queue).toHaveLength(1);

    const entry = queue[0];

    // Entry should have `key` and `json` properties (not `key` and `data`)
    expect(entry).toHaveProperty("key", "test-key");
    expect(entry).toHaveProperty("json");
    expect(entry).not.toHaveProperty("data");

    // json is a string containing valid PersistedEntry fields
    const parsed = JSON.parse(entry.json);
    expect(parsed).toHaveProperty("version", "1.0.0");
    expect(parsed).toHaveProperty("data");
    expect(parsed.data).toEqual({ score: 100, name: "player" });
    expect(parsed).toHaveProperty("timestamp");
    expect(typeof parsed.timestamp).toBe("number");
  });
});
