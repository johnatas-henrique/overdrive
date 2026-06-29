import { describe, expect, it, vi } from "vitest";
import { ConfigManager } from "@/foundation/config/config-manager";
import { wireConfigHmr } from "@/foundation/config/hmr";

describe("wireConfigHmr", () => {
  it("should call ctx.accept when hot context is provided", () => {
    const accept = vi.fn();
    const hot = { accept };

    const cm = new ConfigManager();
    cm.init();
    const spy = vi.spyOn(cm, "invalidateNamespace");

    wireConfigHmr(cm, "teams", hot);

    // Accept callback was registered
    expect(accept).toHaveBeenCalledTimes(1);

    // Extract callback and invoke it to verify namespace invalidation
    const callback = accept.mock.calls[0][0];
    callback();
    expect(spy).toHaveBeenCalledWith("teams");
  });

  it("should be a no-op when hot context is undefined", () => {
    const cm = new ConfigManager();
    cm.init();

    expect(() => wireConfigHmr(cm, "teams", undefined)).not.toThrow();
  });

  it("should call invalidateNamespace with the correct namespace", () => {
    const accept = vi.fn();
    const hot = { accept };

    const cm = new ConfigManager();
    cm.init();
    const spy = vi.spyOn(cm, "invalidateNamespace");

    wireConfigHmr(cm, "physics", hot);

    const callback = accept.mock.calls[0][0];
    callback();
    expect(spy).toHaveBeenCalledWith("physics");
  });

  it("should handle multiple independent wirings", () => {
    const accept = vi.fn();
    const hot = { accept };

    const cm = new ConfigManager();
    cm.init();
    const spy = vi.spyOn(cm, "invalidateNamespace");

    wireConfigHmr(cm, "teams", hot);
    wireConfigHmr(cm, "physics", hot);

    expect(accept).toHaveBeenCalledTimes(2);

    // First callback invalidates "teams"
    accept.mock.calls[0][0]();
    expect(spy).toHaveBeenCalledWith("teams");

    // Second callback invalidates "physics"
    accept.mock.calls[1][0]();
    expect(spy).toHaveBeenCalledWith("physics");
  });

  it("should not throw when wired before ConfigManager init", () => {
    const accept = vi.fn();
    const hot = { accept };

    const cm = new ConfigManager();
    // cm.init() intentionally NOT called

    expect(() => wireConfigHmr(cm, "teams", hot)).not.toThrow();
    expect(accept).toHaveBeenCalledTimes(1);

    // Callback should still invoke invalidateNamespace
    const callback = accept.mock.calls[0][0];
    expect(() => callback()).not.toThrow();
  });
});
