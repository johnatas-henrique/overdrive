import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigError, ConfigManager } from "../../src/foundation/config";

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
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      cm.get("teams.macklen.motor"); // populate resolved

      // Wipe resolved + corrupt raw to trigger _buildResolved failure
      (cm as any)._resolved.delete("teams");
      (cm as any)._store.set("teams", null);

      // _buildResolved logs error, resolved stays empty → ConfigError thrown
      expect(() => cm.get("teams.macklen.motor")).toThrow(ConfigError);

      // Verify _buildResolved logged the error
      expect(errorSpy).toHaveBeenCalled();
      expect(errorSpy.mock.calls[0][0]).toContain(
        "cannot build resolved config"
      );

      errorSpy.mockRestore();
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
});
