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
