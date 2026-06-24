import { describe, expect, it } from "vitest";
import { ConfigError, ConfigManager } from "../../src/foundation/config";

describe("ConfigManager", () => {
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
});
