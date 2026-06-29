import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigError, ConfigManager } from "../../../../src/foundation/config";
import {
  getConfigManager,
  setConfigManager,
} from "../../../../src/foundation/config/config-manager";

describe("ConfigManager", () => {
  // Shared env var tracking — used by env override and invalidateNamespace suites
  const _envKeys: string[] = [];

  afterEach(() => {
    for (const key of _envKeys) {
      delete process.env[key];
    }
    _envKeys.length = 0;
  });

  function _setEnv(key: string, value: string): void {
    process.env[key] = value;
    _envKeys.push(key);
  }

  describe("init()", () => {
    it("should be idempotent when called twice", () => {
      const cm = new ConfigManager();
      cm.init();
      expect(() => cm.init()).not.toThrow();
    });
  });

  describe("register()", () => {
    it("should accept a valid namespace and config object", () => {
      const cm = new ConfigManager();
      cm.init();
      expect(() =>
        cm.register("teams", {
          macklen: { motor: 250, color: "#FF0000" },
        })
      ).not.toThrow();
    });

    it("should throw ConfigError when called before init()", () => {
      const cm = new ConfigManager();
      expect(() => cm.register("teams", { macklen: { motor: 250 } })).toThrow(
        ConfigError
      );
      expect(() => cm.register("teams", { macklen: { motor: 250 } })).toThrow(
        "ConfigManager not initialized"
      );
    });

    it("should throw ConfigError when namespace is already registered", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      expect(() => cm.register("teams", { williams: { motor: 300 } })).toThrow(
        ConfigError
      );
      expect(() => cm.register("teams", { williams: { motor: 300 } })).toThrow(
        "Namespace already registered: teams"
      );
    });

    it("should treat differently cased namespaces as distinct", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", {});
      expect(() => cm.register("Teams", {})).not.toThrow();
    });

    it("should throw ConfigError for non-serializable config (CRITICAL-1 fix)", () => {
      // Circular reference causes JSON.stringify to throw TypeError
      const circular: Record<string, unknown> = { a: 1 };
      circular.self = circular;

      const cm = new ConfigManager();
      cm.init();
      expect(() => cm.register("broken", circular)).toThrow(ConfigError);
      expect(() => cm.register("broken", circular)).toThrow("non-serializable");
    });
  });

  describe("get()", () => {
    it("should return a leaf value from a registered namespace", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", {
        macklen: { motor: 250, color: "#FF0000" },
      });

      const motor = cm.get<number>("teams.macklen.motor");
      expect(motor).toBe(250);
    });

    it("should return a value from a deeply nested key path (4+ levels)", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("physics", {
        car: {
          suspension: {
            stiffness: 12000,
            damping: 4000,
          },
        },
      });

      const value = cm.get<number>("physics.car.suspension.stiffness");
      expect(value).toBe(12000);
    });

    it("should return an object when key points to a non-leaf node", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      const obj = cm.get<object>("teams.macklen");
      expect(obj).toEqual({ motor: 250 });
    });

    it("should throw ConfigError for a nonexistent key", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      expect(() => cm.get("teams.macklen.motor.invalid")).toThrow(ConfigError);
      expect(() => cm.get("teams.macklen.motor.invalid")).toThrow(
        "Key not found: teams.macklen.motor.invalid"
      );
    });

    it("should throw ConfigError for a nonexistent top-level key", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      expect(() => cm.get("nonexistent.key")).toThrow(ConfigError);
      expect(() => cm.get("nonexistent.key")).toThrow(
        "Key not found: nonexistent.key"
      );
    });

    it("should throw ConfigError for an empty string key", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", {});

      expect(() => cm.get("")).toThrow(ConfigError);
      expect(() => cm.get("")).toThrow("Key not found:");
    });

    it("should throw ConfigError for a dot-only key", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", {});

      expect(() => cm.get("...")).toThrow(ConfigError);
      expect(() => cm.get("...")).toThrow("Key not found:");
    });

    it("should throw ConfigError when leaf value is explicitly undefined", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: undefined } });

      // Reduce traverses successfully but returns undefined → line 83 guard
      expect(() => cm.get("teams.macklen.motor")).toThrow(ConfigError);
      expect(() => cm.get("teams.macklen.motor")).toThrow(
        "Key not found: teams.macklen.motor"
      );
    });
  });

  describe("get() before init()", () => {
    it("should throw ConfigError when called before init", () => {
      const cm = new ConfigManager();
      expect(() => cm.get("anything")).toThrow(ConfigError);
      expect(() => cm.get("anything")).toThrow("ConfigManager not initialized");
    });
  });

  describe("get() after init but before register", () => {
    it("should throw ConfigError with init ordering hint", () => {
      const cm = new ConfigManager();
      cm.init();

      expect(() => cm.get("teams.macklen.motor")).toThrow(ConfigError);
      expect(() => cm.get("teams.macklen.motor")).toThrow(
        "Possible init ordering issue"
      );
    });
  });

  describe("env override", () => {
    // ── AC-1: Env var overrides default ──

    it("AC-1: should override default with env var value", () => {
      _setEnv("OVERDRIVE__TEAMS__MACKLEN__MOTOR", "3");
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      expect(cm.get<number>("teams.macklen.motor")).toBe(3);
    });

    it("AC-1: should override with '0' (falsy but valid)", () => {
      _setEnv("OVERDRIVE__TEAMS__MACKLEN__MOTOR", "0");
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      expect(cm.get<number>("teams.macklen.motor")).toBe(0);
    });

    it("AC-1: should override with negative number", () => {
      _setEnv("OVERDRIVE__TEAMS__MACKLEN__MOTOR", "-5");
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      expect(cm.get<number>("teams.macklen.motor")).toBe(-5);
    });

    // ── AC-2: Env var for non-existent namespace ──

    it("AC-2: should ignore env var for non-existent namespace", () => {
      _setEnv("OVERDRIVE__UNKNOWN__KEY", "999");
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);
    });

    it("AC-2: partial namespace match must not override", () => {
      _setEnv("OVERDRIVE__TEAM", "5");
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);
    });

    // ── AC-3: Type coercion ──

    it("AC-3: should coerce numeric env var to number type", () => {
      _setEnv("OVERDRIVE__TEAMS__MACKLEN__MOTOR", "3");
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      const val = cm.get("teams.macklen.motor");
      expect(typeof val).toBe("number");
      expect(val).toBe(3);
    });

    it("AC-3: non-numeric env var stays as string", () => {
      _setEnv("OVERDRIVE__TEAMS__NAME", "Macklen");
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { name: "Default", macklen: { motor: 250 } });
      expect(typeof cm.get("teams.name")).toBe("string");
      expect(cm.get("teams.name")).toBe("Macklen");
    });

    // ── AC-4: Empty key segment ──

    it("AC-4: empty key segment should warn and be skipped", () => {
      // OVERDRIVE__TEAMS____MOTOR splits as ["OVERDRIVE", "TEAMS", "", "MOTOR"]
      _setEnv("OVERDRIVE__TEAMS____MOTOR", "5");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls[0][0]).toContain("empty key segment");

      // Verify override was NOT applied
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);

      warnSpy.mockRestore();
    });

    it("AC-4: multiple empty segments should warn and be skipped", () => {
      // OVERDRIVE_______TEAMS__MOTOR splits as ["OVERDRIVE", "", "", "TEAMS", "MOTOR"]
      _setEnv("OVERDRIVE_______TEAMS__MOTOR", "5");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      expect(warnSpy).toHaveBeenCalled();
      expect(warnSpy.mock.calls[0][0]).toContain("empty key segment");

      // Verify override was NOT applied
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);

      warnSpy.mockRestore();
    });

    // ── AC-5: Env var cleanup ──

    it("AC-5: env vars from previous tests are cleaned up", () => {
      // No env vars set in this test — if AC-1's env var leaked, this would
      // return 3 instead of 250
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);
    });

    // ── Additional coverage ──

    it("should skip override when env var targets an object leaf", () => {
      _setEnv("OVERDRIVE__TEAMS__MACKLEN", '{"motor":999}');
      // Note: existing value is an object { motor: 250 }, so override is skipped
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      // macklen is an object — skip override, keep original
      expect(cm.get<object>("teams.macklen")).toEqual({ motor: 250 });
    });

    it("should skip override when intermediate path does not exist", () => {
      _setEnv("OVERDRIVE__TEAMS__MACKLEN__NONEXISTENT", "99");
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      // nonexistent key doesn't exist in config — skip silently
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);
    });

    it("should skip override when deep intermediate path does not exist", () => {
      // 3+ levels deep where level 2 doesn't exist — hits pathExists=false
      _setEnv("OVERDRIVE__TEAMS__MACKLEN__DEEPER__X", "1");
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      expect(cm.get<number>("teams.macklen.motor")).toBe(250);
    });

    it("should handle Infinity as non-numeric string", () => {
      _setEnv("OVERDRIVE__TEAMS__MACKLEN__MOTOR", "Infinity");
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      const val = cm.get("teams.macklen.motor");
      expect(typeof val).toBe("string");
      expect(val).toBe("Infinity");
    });

    it("should skip env var with matching namespace but no key path", () => {
      // OVERDRIVE__TEAMS has no trailing __KEY — pathSegments will be empty
      _setEnv("OVERDRIVE__TEAMS", "5");
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      // No override applied because there's no key path
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);
    });
  });

  describe("getDebugState", () => {
    // ── AC-1: Ring buffer FIFO eviction ──

    it("AC-1: should keep exactly 500 entries after 600 get() calls", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      for (let i = 0; i < 600; i++) {
        cm.get("teams.macklen.motor");
      }

      const state = cm.getDebugState();
      expect(state.accessLog.length).toBe(500);
    });

    it("AC-1: 0 calls → empty log", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      expect(cm.getDebugState().accessLog.length).toBe(0);
    });

    it("AC-1: 500 calls exactly → buffer full", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      for (let i = 0; i < 500; i++) {
        cm.get("teams.macklen.motor");
      }

      expect(cm.getDebugState().accessLog.length).toBe(500);
    });

    it("AC-1: 501 calls → first entry evicted (length stays 500)", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      for (let i = 0; i < 501; i++) {
        cm.get("teams.macklen.motor");
      }

      expect(cm.getDebugState().accessLog.length).toBe(500);
    });

    // ── AC-2: getDebugState returns full structure ──

    it("AC-2: should return full structure with namespaces, accessLog, envOverrides", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", {
        macklen: { motor: 250, color: "#FF0000" },
      });

      cm.get("teams.macklen.motor");
      const state = cm.getDebugState();

      expect(state).toHaveProperty("namespaces");
      expect(state).toHaveProperty("accessLog");
      expect(state).toHaveProperty("envOverrides");
      expect(state.namespaces.teams).toEqual({
        macklen: { motor: 250, color: "#FF0000" },
      });
      expect(state.accessLog.length).toBeGreaterThanOrEqual(1);
      expect(state.accessLog[0].key).toBe("teams.macklen.motor");
      expect(state.accessLog[0]).toHaveProperty("caller");
      expect(state.accessLog[0].caller.length).toBeGreaterThan(0);
      expect(state.accessLog[0]).toHaveProperty("timestamp");
      expect(typeof state.accessLog[0].timestamp).toBe("number");
    });

    // ── AC-3: getDebugState before any register ──

    it("AC-3: should return empty state before any register()", () => {
      const cm = new ConfigManager();
      cm.init();

      const state = cm.getDebugState();
      expect(state).toEqual({
        namespaces: {},
        accessLog: [],
        envOverrides: [],
      });
    });

    it("AC-3: should never throw when no namespaces are registered", () => {
      const cm = new ConfigManager();
      cm.init();

      expect(() => cm.getDebugState()).not.toThrow();
    });

    // ── Edge cases ──

    it("should return a snapshot that does not leak mutations to internal state", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      cm.get("teams.macklen.motor");

      const state = cm.getDebugState();
      // Mutate the returned snapshot
      state.namespaces.teams = { hacked: true } as object;

      // Verify the internal state is unchanged
      const state2 = cm.getDebugState();
      expect(state2.namespaces.teams).toEqual({
        macklen: { motor: 250 },
      });
    });

    it("should still work after invalidateNamespace with rebuilt values", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      cm.get("teams.macklen.motor");
      cm.invalidateNamespace("teams");

      const state = cm.getDebugState();
      expect(state.namespaces.teams).toEqual({ macklen: { motor: 250 } });
      expect(state.accessLog.length).toBe(1);
    });

    it("should list OVERDRIVE__ env vars in envOverrides", () => {
      _setEnv("OVERDRIVE__TEAMS__MACKLEN__MOTOR", "999");
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      const state = cm.getDebugState();
      expect(state.envOverrides).toContain("OVERDRIVE__TEAMS__MACKLEN__MOTOR");
    });

    it("should show env-overridden values in namespaces (GAP-1)", () => {
      _setEnv("OVERDRIVE__TEAMS__MACKLEN__MOTOR", "999");
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      const state = cm.getDebugState();
      // Namespace values must reflect env overrides, not raw defaults
      expect(state.namespaces.teams).toEqual({ macklen: { motor: 999 } });
    });

    it("should exclude non-OVERDRIVE__ env vars from envOverrides (GAP-4)", () => {
      _setEnv("OTHER__TEAMS__MOTOR", "123");
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      const state = cm.getDebugState();
      expect(state.envOverrides).not.toContain("OTHER__TEAMS__MOTOR");
    });

    it("should return empty state before init() (GAP-2)", () => {
      const cm = new ConfigManager();

      // getDebugState() before init() — never throws, returns empty
      expect(() => cm.getDebugState()).not.toThrow();
      const state = cm.getDebugState();
      expect(state).toEqual({
        namespaces: {},
        accessLog: [],
        envOverrides: [],
      });
    });

    it("should log both successful and error get() calls", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      cm.get("teams.macklen.motor"); // success
      expect(() => cm.get("teams.macklen.motor.invalid")).toThrow(ConfigError); // error

      const state = cm.getDebugState();
      expect(state.accessLog.length).toBe(2);
      expect(state.accessLog[0].key).toBe("teams.macklen.motor");
      expect(state.accessLog[1].key).toBe("teams.macklen.motor.invalid");
    });

    it("should not log successful access when logAllAccess is disabled", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      cm.setLogAllAccess(false);
      cm.get("teams.macklen.motor"); // success — not logged
      expect(() => cm.get("nonexistent.key")).toThrow(ConfigError); // error — logged

      const state = cm.getDebugState();
      expect(state.accessLog.length).toBe(1);
      expect(state.accessLog[0].key).toBe("nonexistent.key");
    });

    it("should return placeholder for non-serializable namespace (WARNING-9 fix)", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      // Inject circular reference into internal store — causes JSON.stringify to throw
      const circular: Record<string, unknown> = { a: 1 };
      circular.self = circular;
      (cm as any)._store.set("broken", circular);

      const state = cm.getDebugState();
      expect(state.namespaces.broken).toEqual({
        error: "non-serializable config",
      });
    });
  });

  describe("invalidateNamespace", () => {
    // ── AC-1: Cache cleared after invalidation ──

    it("AC-1: should return updated value after invalidation and raw store change", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      // Populate resolved cache
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);

      // Invalidate cache
      cm.invalidateNamespace("teams");

      // Simulate HMR updating the raw config
      (cm as any)._store.set("teams", { macklen: { motor: 300 } });

      // Next get should read the updated value
      expect(cm.get<number>("teams.macklen.motor")).toBe(300);
    });

    it("AC-1: invalidation before any get() on a fresh registration", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      // Invalidate before any get (no resolved cache yet — should be no-op)
      cm.invalidateNamespace("teams");

      // Simulate HMR updating the raw config
      (cm as any)._store.set("teams", { macklen: { motor: 300 } });

      // Read should pick up the updated raw value
      expect(cm.get<number>("teams.macklen.motor")).toBe(300);
    });

    // ── AC-2: Env vars survive invalidation ──

    it("AC-2: env vars still apply after invalidation", () => {
      _setEnv("OVERDRIVE__TEAMS__MACKLEN__MOTOR", "999");
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      // Verify env override works initially
      expect(cm.get<number>("teams.macklen.motor")).toBe(999);

      // Invalidate cache
      cm.invalidateNamespace("teams");

      // Env override should still apply after rebuild
      expect(cm.get<number>("teams.macklen.motor")).toBe(999);
    });

    it("AC-2: env vars re-read from process.env on rebuild", () => {
      _setEnv("OVERDRIVE__TEAMS__MACKLEN__MOTOR", "999");
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      // Populate cache
      expect(cm.get<number>("teams.macklen.motor")).toBe(999);

      // Change env var before re-read
      process.env.OVERDRIVE__TEAMS__MACKLEN__MOTOR = "777";

      // Invalidate and re-read
      cm.invalidateNamespace("teams");
      expect(cm.get<number>("teams.macklen.motor")).toBe(777);
    });

    // ── AC-3: Unregistered namespace no-op ──

    it("AC-3: invalidateNamespace on nonexistent namespace does not throw", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      expect(() => cm.invalidateNamespace("nonexistent")).not.toThrow();
    });

    it("AC-3: invalidateNamespace with empty string does not throw", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      // Empty string isn't a registered namespace — should be no-op
      expect(() => cm.invalidateNamespace("")).not.toThrow();
    });

    // ── AC-4: Invalid payload preserves stale cache ──

    it("AC-4: invalid payload (null) preserves stale cache and logs error", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      // Populate resolved cache
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);

      // Corrupt the raw store with invalid payload
      (cm as any)._store.set("teams", null);

      // Invalidate — should log error and preserve stale cache
      cm.invalidateNamespace("teams");

      expect(errorSpy).toHaveBeenCalled();
      expect(errorSpy.mock.calls[0][0]).toContain("invalid payload");

      // Stale cache should still be accessible
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);

      errorSpy.mockRestore();
    });

    it("AC-4: invalid payload (array) preserves stale cache and logs error", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      // Populate resolved cache
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);

      // Replace raw store with array (invalid)
      (cm as any)._store.set("teams", [1, 2, 3]);

      cm.invalidateNamespace("teams");

      expect(errorSpy).toHaveBeenCalled();
      expect(errorSpy.mock.calls[0][0]).toContain("invalid payload");

      // Stale cache preserved
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);

      errorSpy.mockRestore();
    });

    it("AC-4: other namespaces unaffected when one has invalid payload", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      cm.register("settings", { volume: 80 });

      // Populate both caches
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);
      expect(cm.get<number>("settings.volume")).toBe(80);

      // Corrupt teams raw store
      (cm as any)._store.set("teams", null);

      cm.invalidateNamespace("teams");

      expect(errorSpy).toHaveBeenCalled();

      // Teams stale cache preserved
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);

      // Settings unaffected
      expect(cm.get<number>("settings.volume")).toBe(80);

      errorSpy.mockRestore();
    });

    // ── Edge cases ──

    it("should handle multiple invalidations of the same namespace", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      // Populate cache
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);

      // Double invalidation — should not throw
      cm.invalidateNamespace("teams");
      cm.invalidateNamespace("teams");

      // Simulate HMR update
      (cm as any)._store.set("teams", { macklen: { motor: 400 } });
      expect(cm.get<number>("teams.macklen.motor")).toBe(400);
    });

    it("should handle invalidation of a namespace that was never read", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      // Invalidate before any get — no resolved cache to clear, should be safe no-op
      expect(() => cm.invalidateNamespace("teams")).not.toThrow();

      // Subsequent get should still work
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);
    });

    it("should throw ConfigError when raw config becomes invalid after manual store manipulation", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      cm.get("teams.macklen.motor"); // populate resolved

      // Wipe resolved + corrupt raw to trigger _buildResolved failure
      (cm as any)._resolved.delete("teams");
      (cm as any)._store.set("teams", null);

      // _buildResolved now throws ConfigError instead of logging to console.error
      expect(() => cm.get("teams.macklen.motor")).toThrow(ConfigError);
    });

    it("should not break other namespaces when one is invalidated", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      cm.register("physics", { gravity: 9.81 });

      // Populate both caches
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);
      expect(cm.get<number>("physics.gravity")).toBe(9.81);

      // Invalidate only teams
      cm.invalidateNamespace("teams");

      // Physics cache should still be intact
      expect(cm.get<number>("physics.gravity")).toBe(9.81);

      // Teams gets rebuilt
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);
    });
  });

  describe("setConfigManager / getConfigManager", () => {
    afterEach(() => {
      // Reset the singleton to null so tests don't leak state
      setConfigManager(null as unknown as ConfigManager);
    });

    it("should set and get the singleton instance", () => {
      const cm = new ConfigManager();
      setConfigManager(cm);
      expect(getConfigManager()).toBe(cm);
    });

    it("should throw when getConfigManager is called before setConfigManager", () => {
      expect(() => getConfigManager()).toThrow("ConfigManager not initialized");
    });
  });

  describe("reload()", () => {
    it("should return empty array when no changes detected", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      cm.get("teams.macklen.motor"); // populate resolved cache

      const changes = cm.reload();
      expect(changes).toEqual([]);
    });

    it("should detect changed env-var values and return ConfigChange array", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      cm.get("teams.macklen.motor"); // populate resolved cache

      // Set env override AFTER populating resolved — forces a diff on reload
      _setEnv("OVERDRIVE__TEAMS__MACKLEN__MOTOR", "300");

      const changes = cm.reload();
      expect(changes).toEqual([
        { key: "teams.macklen.motor", old: 250, new: 300 },
      ]);
    });

    it("should return empty array when not initialized", () => {
      const cm = new ConfigManager();
      const changes = cm.reload();
      expect(changes).toEqual([]);
    });

    it("should handle reload when resolved cache was not pre-populated", () => {
      // First call to _flattenResolved encounters namespaces with no
      // resolved cache entry — exercises the `if (resolved)` falsy branch
      const cm = new ConfigManager();
      cm.init();
      // Use register to add namespace (which also populates resolved),
      // then invalidate to clear the resolved cache
      cm.register("teams", { macklen: { motor: 250 } });
      cm.invalidateNamespace("teams");
      // Now _store has "teams" but _resolved does not

      const changes = cm.reload();
      expect(changes).toEqual([]);
    });
  });

  describe("setRuntime", () => {
    // ── AC-1: set leaf value and return old value ──

    it("AC-1: should set a leaf value and return the old value", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      // Warm up the resolved cache
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);

      const old = cm.setRuntime("teams.macklen.motor", 300);
      expect(old).toBe(250);
      expect(cm.get<number>("teams.macklen.motor")).toBe(300);
    });

    it("AC-1: should return the correct old value when setting a string", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { name: "Macklen" });

      const old = cm.setRuntime("teams.name", "Vasari");
      expect(old).toBe("Macklen");
      expect(cm.get<string>("teams.name")).toBe("Vasari");
    });

    it("AC-1: should set a deeply nested value (4+ levels)", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("physics", {
        car: { suspension: { stiffness: 12000, damping: 4000 } },
      });

      const old = cm.setRuntime("physics.car.suspension.stiffness", 15000);
      expect(old).toBe(12000);
      expect(cm.get<number>("physics.car.suspension.stiffness")).toBe(15000);
    });

    // ── AC-2: throw ConfigError for non-existent key ──

    it("AC-2: should throw ConfigError for a non-existent key", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      expect(() => cm.setRuntime("teams.macklen.motor.invalid", 99)).toThrow(
        ConfigError
      );
      expect(() => cm.setRuntime("teams.macklen.motor.invalid", 99)).toThrow(
        "Key not found: teams.macklen.motor.invalid"
      );
    });

    it("AC-2: should throw ConfigError for a non-existent namespace", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", {});

      expect(() => cm.setRuntime("nonexistent.key", 99)).toThrow(ConfigError);
      expect(() => cm.setRuntime("nonexistent.key", 99)).toThrow(
        "Key not found: nonexistent.key"
      );
    });

    it("AC-2: should throw ConfigError for an empty string key", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", {});

      expect(() => cm.setRuntime("", 99)).toThrow(ConfigError);
      expect(() => cm.setRuntime("", 99)).toThrow("Key not found:");
    });

    it("should throw ConfigError for intermediate segment not found in dot-path", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 3 } });
      expect(() => cm.setRuntime("teams.nonexistent.motor", 99)).toThrow(
        ConfigError
      );
      expect(() => cm.setRuntime("teams.nonexistent.motor", 99)).toThrow(
        "Key not found: teams.nonexistent.motor"
      );
    });

    // ── AC-3: write to _resolved, not _store ──

    it("AC-3: should write to _resolved, not to _store", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      // Warm up resolved cache
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);

      cm.setRuntime("teams.macklen.motor", 999);

      // _resolved has the new value
      expect(cm.get<number>("teams.macklen.motor")).toBe(999);

      // Invalidate and re-read — _store value is restored
      cm.invalidateNamespace("teams");
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);
    });

    it("AC-3: _store values unchanged after setRuntime", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      // Access the private _store via cast to verify raw config is untouched
      cm.setRuntime("teams.macklen.motor", 999);

      const rawStore = (cm as any)._store.get("teams");
      expect(rawStore.macklen.motor).toBe(250);
    });

    // ── AC-4: guarded by import.meta.env.DEV ──

    it("AC-4: should be a no-op when DEV is false", () => {
      vi.stubEnv("DEV", false);
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      cm.get("teams.macklen.motor"); // warm up resolved

      const result = cm.setRuntime("teams.macklen.motor", 999);
      expect(result).toBeUndefined();

      // Value should remain unchanged
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);
      vi.unstubAllEnvs();
    });

    // ── AC-5: rebuild resolved cache if it was invalidated ──

    it("AC-5: should rebuild resolved cache when namespace was invalidated", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      // Populate resolved, then invalidate
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);
      cm.invalidateNamespace("teams");

      // setRuntime should rebuild and then set
      const old = cm.setRuntime("teams.macklen.motor", 400);
      expect(old).toBe(250);
      expect(cm.get<number>("teams.macklen.motor")).toBe(400);
    });

    // ── Edge: set to undefined ──

    it("should allow setting a value to undefined", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      cm.get("teams.macklen.motor"); // warm up

      const old = cm.setRuntime("teams.macklen.motor", undefined);
      expect(old).toBe(250);

      // After setRuntime to undefined, get() should throw (undefined check)
      expect(() => cm.get("teams.macklen.motor")).toThrow(ConfigError);
    });
  });

  describe("_flattenObject (private)", () => {
    it("should recursively flatten nested objects into dot-path entries", () => {
      const cm = new ConfigManager();
      const result = new Map<string, unknown>();
      (cm as any)._flattenObject("test", { a: { b: { c: 1, d: 2 } } }, result);
      expect(result.get("test.a.b.c")).toBe(1);
      expect(result.get("test.a.b.d")).toBe(2);
      expect(result.size).toBe(2);
    });

    it("should not recursively flatten arrays", () => {
      const cm = new ConfigManager();
      const result = new Map<string, unknown>();
      (cm as any)._flattenObject(
        "test",
        { items: [1, 2, 3], nested: { arr: [4, 5] } },
        result
      );
      expect(result.get("test.items")).toEqual([1, 2, 3]);
      expect(result.get("test.nested.arr")).toEqual([4, 5]);
      expect(result.size).toBe(2);
    });
  });
});

// ─── Tech debt cleanup: register() throws ConfigError on invalid config ───

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

// ─── Tech debt cleanup: stack trace extraction handles non-V8 gracefully ───

describe("W-1: stack trace extraction handles non-V8 gracefully", () => {
  it("should not throw when Error.stack is undefined", () => {
    const cm = new ConfigManager();
    cm.init();
    cm.register("test", { value: 1 });

    // Some environments may not have a getter — guard accordingly
    if (Error.prototype.stack === undefined) {
      return;
    }

    // Temporarily break stack trace
    const origStack = Object.getOwnPropertyDescriptor(Error.prototype, "stack");
    Object.defineProperty(Error.prototype, "stack", {
      get: () => undefined as unknown as string,
      configurable: true,
    });

    // get() should not throw; the caller will be recorded as empty string
    expect(() => cm.get<number>("test.value")).not.toThrow();
    expect(cm.get<number>("test.value")).toBe(1);
    const state = cm.getDebugState();
    expect(state.accessLog[0].caller).toBe("");

    // Restore
    if (origStack) {
      Object.defineProperty(Error.prototype, "stack", origStack);
    }
  });

  it("should not throw when Error.stack getter throws", () => {
    const cm = new ConfigManager();
    cm.init();
    cm.register("x", { a: 1 });

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

// ─── Tech debt cleanup: process.env guard in browser-like environment ───

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

// ─── Coverage gap: get() with missing namespace ───

describe("Coverage gap — configManager get() with missing namespace", () => {
  it("throws ConfigError when namespace was never registered", () => {
    const mgr = new ConfigManager();
    mgr.init();
    expect(() => mgr.get("nonexistent.key")).toThrow(ConfigError);
  });
});
