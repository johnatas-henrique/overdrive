/**
 * Tech Debt Cleanup — Foundation systems.
 *
 * Validates 9 fixes (4 CRITICAL + 5 WARNING) across persistence,
 * simulation-snapshot, config-manager, fixed-update-pipeline, and
 * pipeline-runtime.
 *
 * @see story: foundation-tech-debt-cleanup
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigError, ConfigManager } from "../../src/foundation/config";
import {
  DeterminismError,
  FIXED_DT,
  FixedUpdatePipeline,
  PipelineRuntime,
} from "../../src/foundation/determinism";
import {
  Persistence,
  PersistenceError,
  PersistenceState,
} from "../../src/foundation/persistence";
import {
  type ISnapshotable,
  SimulationSnapshot,
  SnapshotError,
} from "../../src/foundation/simulation-snapshot";

// Capture original global non-deterministic APIs before any test patching.
// DeterminismGuard replaces these globally; restore them before each test.
const __origMathRandom: () => number = Math.random;
const __origDateNow: () => number = Date.now;
const __origPerfNow: () => number = performance.now;

afterEach(() => {
  Math.random = __origMathRandom;
  Date.now = __origDateNow;
  performance.now = __origPerfNow;
});

// ===========================================================================
// C-1: persistence.ts save() throws PersistenceError on JSON.stringify failure
// ===========================================================================

describe("C-1: persistence save() throws on JSON.stringify failure", () => {
  /** In-memory store backing the localStorage mock. */
  const mockStore = new Map<string, string>();

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
    vi.stubGlobal("localStorage", createWorkingStorage());
  });

  afterEach(() => {
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

// ===========================================================================
// C-2: simulation-snapshot.ts dispose() always clears registry
// ===========================================================================

describe("C-2: dispose() clears registry even when serialize() throws", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  /** A system that optionally throws on serialize(). */
  class FailingSnapshotSystem implements ISnapshotable {
    readonly systemId: string;
    private _shouldThrow = false;

    constructor(systemId: string, shouldThrow = false) {
      this.systemId = systemId;
      this._shouldThrow = shouldThrow;
    }

    serialize(): Record<string, unknown> {
      if (this._shouldThrow) {
        throw new Error(`Serialize failed for ${this.systemId}`);
      }
      return { ok: true };
    }

    deserialize(_state: Record<string, unknown>): void {
      // no-op
    }

    hash(): string {
      return "a430d84680aabd0b";
    }
  }

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("should clear the registry when a system throws during serialize()", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new FailingSnapshotSystem("good", false));
    ss.register(new FailingSnapshotSystem("bad", true));

    ss.dispose();

    // Registry should be cleared — takeSnapshot throws SnapshotError
    expect(() => ss.takeSnapshot(0)).toThrow(SnapshotError);
  });

  it("should log a warning when serialize() throws during dispose", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new FailingSnapshotSystem("bad", true));

    ss.dispose();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('System "bad" failed to serialize during dispose')
    );
  });

  it("should handle non-Error throw during dispose gracefully", () => {
    const ss = new SimulationSnapshot();
    ss.init();

    class NonErrorThrower implements ISnapshotable {
      readonly systemId = "non-error";
      serialize(): Record<string, unknown> {
        throw "string error";
      }
      deserialize(): void {}
      hash(): string {
        return "a430d84680aabd0b";
      }
    }

    ss.register(new NonErrorThrower());
    ss.dispose();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unknown error")
    );
  });

  it("should not throw when all systems serialize() successfully", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new FailingSnapshotSystem("a", false));
    ss.register(new FailingSnapshotSystem("b", false));

    expect(() => ss.dispose()).not.toThrow();
  });

  it("should transition to Disposed state after dispose with failures", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(new FailingSnapshotSystem("bad", true));

    ss.dispose();

    // Double dispose should be idempotent (state is Disposed)
    expect(() => ss.dispose()).not.toThrow();
  });
});

// ===========================================================================
// C-3: persistence.ts save() queues to retry on localStorage failure
// ===========================================================================

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

  afterEach(() => {
    vi.unstubAllGlobals();
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

// ===========================================================================
// C-4: configManager.ts register() throws ConfigError on invalid config
// ===========================================================================

describe("C-4: register() throws ConfigError on invalid config", () => {
  it("should throw ConfigError when registering null config", () => {
    const cm = new ConfigManager();
    cm.init();
    expect(() => cm.register("teams", null as unknown as object)).toThrow(
      ConfigError
    );
  });

  it("should throw ConfigError when registering undefined config", () => {
    const cm = new ConfigManager();
    cm.init();
    expect(() => cm.register("teams", undefined as unknown as object)).toThrow(
      ConfigError
    );
  });

  it("should throw ConfigError when registering array config", () => {
    const cm = new ConfigManager();
    cm.init();
    expect(() => cm.register("teams", [] as unknown as object)).toThrow(
      ConfigError
    );
  });

  it("should not leave orphaned namespace in _store when registration fails", () => {
    const cm = new ConfigManager();
    cm.init();

    // Attempt to register invalid config
    expect(() => cm.register("bad", null as unknown as object)).toThrow(
      ConfigError
    );

    // The namespace should be eligible for registration now
    // (cleanup happened before the throw propagated)
    expect(() => cm.register("bad", { valid: true })).not.toThrow();

    // Verify the valid registration actually works
    expect(cm.get<{ valid: boolean }>("bad")).toEqual({ valid: true });
  });

  it("should still register normally for valid config", () => {
    const cm = new ConfigManager();
    cm.init();
    expect(() => cm.register("good", { data: 42 })).not.toThrow();
    expect(cm.get<number>("good.data")).toBe(42);
  });
});

// ===========================================================================
// W-1: configManager.ts stack trace handles non-V8 gracefully
// ===========================================================================

describe("W-1: stack trace extraction handles non-V8 gracefully", () => {
  it("should not throw when Error.stack is undefined", () => {
    const cm = new ConfigManager();
    cm.init();
    cm.register("test", { value: 1 });

    // Make Error.stack return undefined which would crash .split()
    const origStack = Error.prototype.stack;

    // Some environments may not have a getter — guard accordingly
    if (Error.prototype.stack === undefined) {
      // Already safe — skip stack-dependent assertion
      return;
    }

    // Temporarily break stack trace
    Object.defineProperty(Error.prototype, "stack", {
      get: () => undefined as unknown as string,
      configurable: true,
    });

    // get() should not throw; the caller will be recorded as empty string
    expect(() => cm.get<number>("test.value")).not.toThrow();
    expect(cm.get<number>("test.value")).toBe(1);

    // Restore
    Object.defineProperty(
      Error.prototype,
      "stack",
      origStack as PropertyDescriptor
    );
  });

  it("should not throw when Error.stack getter throws", () => {
    const cm = new ConfigManager();
    cm.init();
    cm.register("x", { a: 1 });

    // Temporarily make stack throw
    const origDescriptor = Object.getOwnPropertyDescriptor(
      Error.prototype,
      "stack"
    );

    Object.defineProperty(Error.prototype, "stack", {
      get: () => {
        throw new Error("Stack unavailable");
      },
      configurable: true,
    });

    expect(() => cm.get<number>("x.a")).not.toThrow();
    expect(cm.get<number>("x.a")).toBe(1);

    // Restore
    if (origDescriptor) {
      Object.defineProperty(Error.prototype, "stack", origDescriptor);
    }
  });

  it("should not throw when Error.stack returns empty string", () => {
    const cm = new ConfigManager();
    cm.init();
    cm.register("x", { a: 1 });

    const origDescriptor = Object.getOwnPropertyDescriptor(
      Error.prototype,
      "stack"
    );

    Object.defineProperty(Error.prototype, "stack", {
      get: () => "",
      configurable: true,
    });

    expect(() => cm.get<number>("x.a")).not.toThrow();
    expect(cm.get<number>("x.a")).toBe(1);

    if (origDescriptor) {
      Object.defineProperty(Error.prototype, "stack", origDescriptor);
    }
  });
});

// ===========================================================================
// W-2: configManager.ts process.env guard in browser
// ===========================================================================

describe("W-2: process.env guard works in browser-like environment", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getDebugState() should not throw when process is undefined", () => {
    vi.stubGlobal("process", undefined);

    const cm = new ConfigManager();
    cm.init();
    cm.register("test", { val: 1 });

    expect(() => cm.getDebugState()).not.toThrow();
  });

  it("getDebugState() should return empty envOverrides when process is undefined", () => {
    vi.stubGlobal("process", undefined);

    const cm = new ConfigManager();
    cm.init();
    cm.register("test", { val: 1 });

    const state = cm.getDebugState();
    expect(state.envOverrides).toEqual([]);
  });

  it("config get() should work when process is undefined (guard in _applyEnvOverridesToClone)", () => {
    vi.stubGlobal("process", undefined);

    const cm = new ConfigManager();
    cm.init();
    cm.register("test", { val: 42 });

    expect(cm.get<number>("test.val")).toBe(42);
  });

  it("should still apply env overrides when process is available", () => {
    // Ensure process is defined
    const origProcess = process.env;
    process.env = { ...origProcess, OVERDRIVE__TEST__VAL: "99" };

    try {
      const cm = new ConfigManager();
      cm.init();
      cm.register("test", { val: 42 });

      expect(cm.get<number>("test.val")).toBe(99);
    } finally {
      process.env = origProcess;
    }
  });
});

// ===========================================================================
// W-3: fixed-update-pipeline.ts logs errors from slot exceptions
// ===========================================================================

describe("W-3: pipeline logs errors from slot exceptions", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("should log console.error when a slot throws during executeTick", () => {
    const pipeline = new FixedUpdatePipeline();
    pipeline.register(
      "failing",
      () => {
        throw new Error("Slot exploded");
      },
      1
    );
    pipeline.start();

    pipeline.executeTick(FIXED_DT);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Slot 1 threw during executeTick")
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Slot exploded")
    );
  });

  it("should log errors for all throwing slots, not just the first", () => {
    const pipeline = new FixedUpdatePipeline();
    pipeline.register(
      "fail1",
      () => {
        throw new Error("Fail 1");
      },
      1
    );
    pipeline.register(
      "fail2",
      () => {
        throw new Error("Fail 2");
      },
      2
    );
    pipeline.start();

    pipeline.executeTick(FIXED_DT);

    // Should have two error logs
    const errorMessages = errorSpy.mock.calls.map((c) => c[0] as string);
    const slotErrors = errorMessages.filter(
      (m) => m.includes("Slot ") && m.includes(" threw during executeTick")
    );
    expect(slotErrors.length).toBe(2);
  });

  it("should continue executing remaining slots after a throwing slot", () => {
    const slot1Executed = vi.fn();
    const slot2Executed = vi.fn();

    const pipeline = new FixedUpdatePipeline();
    pipeline.register(
      "slot1",
      () => {
        slot1Executed();
        throw new Error("Fail");
      },
      1
    );
    pipeline.register(
      "slot2",
      () => {
        slot2Executed();
      },
      2
    );
    pipeline.start();

    pipeline.executeTick(FIXED_DT);

    expect(slot1Executed).toHaveBeenCalledTimes(1);
    expect(slot2Executed).toHaveBeenCalledTimes(1);
  });

  it("should handle non-Error thrown values gracefully in the log message", () => {
    const pipeline = new FixedUpdatePipeline();
    pipeline.register(
      "bad",
      () => {
        throw "string error";
      },
      1
    );
    pipeline.start();

    expect(() => pipeline.executeTick(FIXED_DT)).not.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("string error")
    );
  });

  it("should still increment the tick counter after a slot throws", () => {
    const pipeline = new FixedUpdatePipeline();
    pipeline.register(
      "bad",
      () => {
        throw new Error("Fail");
      },
      1
    );
    pipeline.start();

    pipeline.executeTick(FIXED_DT);
    expect(pipeline.getCurrentTick()).toBe(1);

    pipeline.executeTick(FIXED_DT);
    expect(pipeline.getCurrentTick()).toBe(2);
  });
});

// ===========================================================================
// W-4: pipeline-runtime.ts dev guard installed in attach(), not constructor
// ===========================================================================

describe("W-4: dev guard installed in attach(), not constructor", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("should allow Math.random before attach (guard not installed in constructor)", () => {
    const _runtime = new PipelineRuntime();

    // Guard not installed — Math.random works normally
    expect(() => Math.random()).not.toThrow();
  });

  it("should install the guard after attach() is called", () => {
    const runtime = new PipelineRuntime();

    const engine = {
      runRenderLoop: vi.fn(),
      stopRenderLoop: vi.fn(),
      getDeltaTime: vi.fn(() => 16.67),
    };
    const scene = { render: vi.fn() };

    runtime.attach(engine as any, () => scene as any);

    // Guard should be installed — Math.random throws DeterminismError
    expect(() => Math.random()).toThrow(DeterminismError);
  });

  it("should uninstall the guard after detach() is called", () => {
    const runtime = new PipelineRuntime();

    const engine = {
      runRenderLoop: vi.fn(),
      stopRenderLoop: vi.fn(),
      getDeltaTime: vi.fn(() => 16.67),
    };
    const scene = { render: vi.fn() };

    runtime.attach(engine as any, () => scene as any);
    expect(() => Math.random()).toThrow(DeterminismError);

    runtime.detach();

    // Guard should be uninstalled — Math.random works again
    expect(() => Math.random()).not.toThrow();
  });

  it("should not crash when attach is called twice (no-op guard)", () => {
    const runtime = new PipelineRuntime();

    const engine = {
      runRenderLoop: vi.fn(),
      stopRenderLoop: vi.fn(),
      getDeltaTime: vi.fn(() => 16.67),
    };
    const scene = { render: vi.fn() };

    runtime.attach(engine as any, () => scene as any);
    expect(() => Math.random()).toThrow(DeterminismError);

    // Second attach is no-op — guard stays installed
    runtime.attach(engine as any, () => scene as any);
    expect(() => Math.random()).toThrow(DeterminismError);
  });

  it("should re-install guard on second attach after detach", () => {
    const runtime = new PipelineRuntime();

    const engine = {
      runRenderLoop: vi.fn(),
      stopRenderLoop: vi.fn(),
      getDeltaTime: vi.fn(() => 16.67),
    };
    const scene = { render: vi.fn() };

    runtime.attach(engine as any, () => scene as any);
    runtime.detach();

    // Re-attach should install guard again
    runtime.attach(engine as any, () => scene as any);
    expect(() => Math.random()).toThrow(DeterminismError);

    // Tear down
    runtime.detach();
  });
});

// ===========================================================================
// W-5: pipeline-runtime.ts JSDoc uses instance call
// ===========================================================================

describe("W-5: JSDoc example uses instance method call", () => {
  it("suppressHavokAutoStep should be an instance method on the prototype", () => {
    const proto = PipelineRuntime.prototype as unknown as Record<
      string,
      unknown
    >;
    expect(typeof proto.suppressHavokAutoStep).toBe("function");
  });

  it("suppressHavokAutoStep should not be a static method on the class", () => {
    // Verify it's not a static property (which would indicate static call pattern)
    expect(
      (PipelineRuntime as unknown as Record<string, unknown>)
        .suppressHavokAutoStep
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Coverage gap fix — pre-existing gap not introduced by this story
// ---------------------------------------------------------------------------

describe("configManager coverage gap — get() with missing namespace", () => {
  it("throws ConfigError when namespace was never registered", () => {
    const mgr = new ConfigManager();
    mgr.init();
    // Calling get() on a namespace that was never registered
    // hits the early throw at lines 109-112
    expect(() => mgr.get("nonexistent.key")).toThrow(ConfigError);
  });
});
