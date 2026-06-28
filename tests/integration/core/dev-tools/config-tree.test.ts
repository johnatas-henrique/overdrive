// @vitest-environment happy-dom

/**
 * Integration tests: Config Tree Inspector.
 *
 * Verifies that the ConfigTreePanel correctly renders namespaces,
 * handles in-place editing via ConfigManager.setRuntime(), and
 * renders undefined values as em dashes.
 *
 * @see TR-DVT-003 — Config namespace inspector
 * @see ADR-0009 — Dev Tools Architecture (sole write exception)
 * @see Story 004 — Config Tree Inspector
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigTreePanel } from "../../../../src/core/dev-tools/config-tree";
import { ConfigManager } from "../../../../src/foundation/config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a container element for the panel to render into. */
function createContainer(): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = "width:320px;height:500px";
  return el;
}

/** Expand the first `<details>` element in a container. */
function expandFirstDetails(container: HTMLElement): void {
  const details = container.querySelector("details");
  if (details) {
    details.open = true;
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe("Config Tree Panel — AC-4", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // =======================================================================
  // AC-4a: Config tree shows all namespaces with current merged values
  // =======================================================================

  describe("AC-4a: Config tree shows all namespaces", () => {
    it("should render multiple namespaces with nested values", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", {
        macklen: { motor: 250, color: "#FF0000" },
        vasari: { bhp: 480 },
      });
      cm.register("physics", { gravity: 9.81 });

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();

      // ── Assert: namespace <details> elements exist ──
      const details = container.querySelectorAll("details");
      expect(details.length).toBe(2);

      // ── Assert: summary text matches namespace names ──
      const summaries = container.querySelectorAll("summary");
      const summaryTexts = Array.from(summaries).map((s) => s.textContent);
      expect(summaryTexts).toContain("teams");
      expect(summaryTexts).toContain("physics");

      // ── Expand both namespaces and verify key-value pairs ──
      details.forEach((d) => {
        (d as HTMLDetailsElement).open = true;
      });

      const listText = container.textContent ?? "";

      // Key names present
      expect(listText).toContain("teams.macklen.motor");
      expect(listText).toContain("teams.macklen.color");
      expect(listText).toContain("teams.vasari.bhp");
      expect(listText).toContain("physics.gravity");

      // Values present
      expect(listText).toContain("250");
      expect(listText).toContain("#FF0000");
      expect(listText).toContain("480");
      expect(listText).toContain("9.81");
    });

    it("should show placeholder when no namespaces are registered", () => {
      const cm = new ConfigManager();
      cm.init();

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();

      expect(container.textContent).toContain("No config namespaces");
      expect(container.querySelector("details")).toBeNull();
    });

    it("should show placeholder when ConfigManager getter throws", () => {
      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => {
        throw new Error("Not initialized");
      });
      panel.refresh();

      expect(container.textContent).toContain("ConfigManager not initialized");
    });

    it("should preserve expanded state across consecutive refreshes", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      cm.register("physics", { gravity: 9.81 });

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);

      // First render: expand 'physics' namespace
      panel.refresh();
      const details = container.querySelectorAll("details");
      // Physics is the second details element (alphabetical order)
      const physicsDetails = details[1] as HTMLDetailsElement;
      physicsDetails.open = true;

      // Second render: 'physics' should remain expanded
      panel.refresh();

      const detailsAfter = container.querySelectorAll("details");
      expect((detailsAfter[1] as HTMLDetailsElement).open).toBe(true);
      expect((detailsAfter[0] as HTMLDetailsElement).open).toBe(false);
    });
  });

  // =======================================================================
  // AC-4b: In-place edit via setRuntime()
  // =======================================================================

  describe("AC-4b: In-place edit via setRuntime()", () => {
    it("should update display and config value on Enter", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      // Warm up the resolved cache so setRuntime() doesn't fail
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      // Find the value span
      const valueSpan = container.querySelector(".config-value");
      expect(valueSpan).not.toBeNull();
      expect(valueSpan?.textContent).toBe("250");

      // Double-click to enter edit mode
      valueSpan?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

      // Verify the input field replaced the span
      const input = container.querySelector("input");
      expect(input).not.toBeNull();
      expect(input?.value).toBe("250");

      // Modify the value and press Enter
      input.value = "300";
      input?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      // After Enter, the display should show the new value
      const updatedSpan = container.querySelector(".config-value");
      expect(updatedSpan).not.toBeNull();
      expect(updatedSpan?.textContent).toBe("300");

      // The config value should actually be updated via setRuntime()
      expect(cm.get<number>("teams.macklen.motor")).toBe(300);
    });

    it("should revert display and NOT update config on Escape", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      // Enter edit mode
      const valueSpan = container.querySelector(".config-value");
      valueSpan?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

      const input = container.querySelector("input");
      expect(input).not.toBeNull();

      // Modify value then press Escape
      input.value = "999";
      input?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );

      // Display should revert to original
      const updatedSpan = container.querySelector(".config-value");
      expect(updatedSpan?.textContent).toBe("250");

      // Config value should be unchanged
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);
    });

    it("should prevent concurrent edits on another span while editing", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", {
        macklen: { motor: 250, color: "#FF0000" },
      });
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);
      expect(cm.get<string>("teams.macklen.color")).toBe("#FF0000");

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      // Start editing the first value
      const valueSpans = container.querySelectorAll(".config-value");
      expect(valueSpans.length).toBeGreaterThanOrEqual(2);

      // Double-click the first value span
      (valueSpans[0] as HTMLSpanElement).dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true })
      );

      // There should be exactly one input
      expect(container.querySelectorAll("input").length).toBe(1);

      // Try to double-click the second value span (should be ignored)
      (valueSpans[1] as HTMLSpanElement).dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true })
      );

      // There should still be exactly one input
      expect(container.querySelectorAll("input").length).toBe(1);

      // Cancel the edit
      const input = container.querySelector("input") as HTMLInputElement;
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });

    it("should handle numeric string values correctly", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { name: "Macklen" });
      expect(cm.get<string>("teams.name")).toBe("Macklen");

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      // Edit the string value
      const valueSpan = container.querySelector(".config-value") as HTMLElement;
      valueSpan.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

      const input = container.querySelector("input") as HTMLInputElement;
      input.value = "Vasari";
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      // Should remain a string (not coerced to NaN)
      expect(cm.get<string>("teams.name")).toBe("Vasari");
    });
  });

  // =======================================================================
  // AC-4c: undefined values render as em dash
  // =======================================================================

  describe("AC-4c: undefined values render as em dash", () => {
    it("should render undefined leaf values as em dash (\u2014)", () => {
      const cm = new ConfigManager();
      cm.init();
      // ConfigManager allows registering objects with undefined values
      // (get() will throw for them, but getDebugState() exposes them)
      cm.register("teams", {
        macklen: { motor: 250, aerokit: undefined },
      });

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      // Find the li that contains "aerokit"
      const items = container.querySelectorAll("li");
      const aerokitItem = Array.from(items).find((li) =>
        li.textContent?.includes("teams.macklen.aerokit")
      );
      expect(aerokitItem).not.toBeNull();

      // The value should be the em dash character, not "undefined"
      expect(aerokitItem?.textContent).toContain("\u2014");
      expect(aerokitItem?.textContent).not.toContain("undefined");
    });

    it("should not show literal 'undefined' text for any undefined value", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("test", {
        key1: undefined,
        key2: "defined",
        key3: undefined,
      });

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      const listText = container.textContent ?? "";

      // Check each undefined key renders as em dash
      expect(listText).toContain("test.key1");
      expect(listText).toContain("test.key2");
      expect(listText).toContain("test.key3");
      expect(listText).toContain("defined");

      // Should NOT contain literal word "undefined" (as value text)
      const allCodeEls = container.querySelectorAll("code");
      const _codeTexts = Array.from(allCodeEls).map((c) => c.textContent);
      // The key names are in <code> elements, values are in <span>
      // Check that no <span> contains "undefined"
      const valueSpans = container.querySelectorAll("span.config-value");
      for (const span of valueSpans) {
        expect(span.textContent).not.toBe("undefined");
      }
    });
  });

  // =======================================================================
  // Additional coverage: notification callback, error handling, re-attach
  // =======================================================================

  describe("Notification and error handling", () => {
    it("should call showNotification on successful edit", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);

      const notifications: string[] = [];
      const container = createContainer();
      const panel = new ConfigTreePanel(
        container,
        () => cm,
        (msg) => notifications.push(msg)
      );
      panel.refresh();
      expandFirstDetails(container);

      // Enter edit mode
      const valueSpan = container.querySelector(".config-value") as HTMLElement;
      valueSpan.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

      const input = container.querySelector("input") as HTMLInputElement;
      input.value = "300";
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      // Notification should have been called with old → new message
      expect(notifications.length).toBe(1);
      expect(notifications[0]).toContain("config updated");
      expect(notifications[0]).toContain("250");
      expect(notifications[0]).toContain("300");
    });

    it("should include the config key path in the notification message", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);

      const notifications: string[] = [];
      const container = createContainer();
      const panel = new ConfigTreePanel(
        container,
        () => cm,
        (msg) => notifications.push(msg)
      );
      panel.refresh();
      expandFirstDetails(container);

      const valueSpan = container.querySelector(".config-value") as HTMLElement;
      valueSpan.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

      const input = container.querySelector("input") as HTMLInputElement;
      input.value = "300";
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      expect(notifications[0]).toContain("teams.macklen.motor");
    });

    it("should revert display when setRuntime throws", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      // Enter edit mode
      const valueSpan = container.querySelector(".config-value") as HTMLElement;
      valueSpan.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

      const input = container.querySelector("input") as HTMLInputElement;
      input.value = "999";

      // Spy on setRuntime to throw
      const spy = vi.spyOn(cm, "setRuntime").mockImplementation(() => {
        throw new Error("setRuntime failed");
      });

      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      // Display should revert to original
      const updatedSpan = container.querySelector(".config-value");
      expect(updatedSpan?.textContent).toBe("250");
      spy.mockRestore();
    });

    it("should re-attach dblclick listener after edit", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });
      expect(cm.get<number>("teams.macklen.motor")).toBe(250);

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      // Enter edit mode
      const valueSpan = container.querySelector(".config-value") as HTMLElement;
      valueSpan.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

      const input = container.querySelector("input") as HTMLInputElement;
      input.value = "300";
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      // The new span should have a dblclick listener — verify by double-clicking again
      const newSpan = container.querySelector(".config-value") as HTMLElement;
      newSpan.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

      // Should have entered edit mode again (input exists)
      const newInput = container.querySelector("input");
      expect(newInput).not.toBeNull();
      expect(newInput?.value).toBe("300");

      // Cancel
      newInput?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });

    it("should revert display when blur fires without confirm", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      // Enter edit mode
      const valueSpan = container.querySelector(".config-value") as HTMLElement;
      valueSpan.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

      const input = container.querySelector("input") as HTMLInputElement;
      input.value = "999";

      // Trigger blur (simulates focus loss without Enter/Escape)
      input.dispatchEvent(new Event("blur"));

      // Display should revert
      const updatedSpan = container.querySelector(".config-value");
      expect(updatedSpan?.textContent).toBe("250");
    });

    it("should clear flash effect after 300ms timeout", () => {
      vi.useFakeTimers();
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      // Enter edit mode and confirm
      const valueSpan = container.querySelector(".config-value") as HTMLElement;
      valueSpan.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

      const input = container.querySelector("input") as HTMLInputElement;
      input.value = "300";
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      // Immediately after edit, the span should have green background
      const newSpan = container.querySelector(".config-value") as HTMLElement;
      expect(newSpan.style.background).toBeTruthy();

      // Advance timers past the 300ms timeout
      vi.advanceTimersByTime(350);

      // Background should be transparent after timeout
      expect(newSpan.style.background).toBe("transparent");
      vi.useRealTimers();
    });

    it("should show overflow message when namespace has more than 200 keys", () => {
      const cm = new ConfigManager();
      cm.init();

      // Create a namespace with 205 keys
      const bigConfig: Record<string, number> = {};
      for (let i = 0; i < 205; i++) {
        bigConfig[`key${i}`] = i;
      }
      cm.register("bigns", bigConfig);

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      // Should show the overflow message
      const listText = container.textContent ?? "";
      expect(listText).toContain("… and 5 more keys");
    });

    it("should clear input value when editing an undefined (em dash) value", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { aerokit: undefined } });

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      // Find the aerokit value span (should show em dash)
      const items = container.querySelectorAll("li");
      const aerokitItem = Array.from(items).find((li) =>
        li.textContent?.includes("teams.macklen.aerokit")
      );
      expect(aerokitItem).not.toBeNull();

      const valueSpan = aerokitItem?.querySelector(
        ".config-value"
      ) as HTMLElement;
      expect(valueSpan.textContent).toBe("\u2014");

      // Double-click to enter edit mode — input should be empty (not "\u2014")
      valueSpan.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

      const input = container.querySelector("input");
      expect(input).not.toBeNull();
      expect(input?.value).toBe("");

      // Cancel
      input?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });
  });

  // =======================================================================
  // W-3: Double-processing guard — blur after Enter must not corrupt DOM
  // =======================================================================

  describe("double-processing guard", () => {
    it("should not double-process when blur fires after Enter", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      const valueSpan = container.querySelector(".config-value") as HTMLElement;
      valueSpan.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

      const input = container.querySelector("input") as HTMLInputElement;
      input.value = "999";

      // Simulate Enter — this clears _editingKey BEFORE replaceWith
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      // Now manually fire blur on the detached input — guard should catch it
      input.dispatchEvent(new Event("blur"));

      // The span should show the updated value, not corrupted
      const newSpan = container.querySelector(".config-value") as HTMLElement;
      expect(newSpan.textContent).toBe("999");
    });
  });

  // =======================================================================
  // W-5: null and array values rendering
  // =======================================================================

  describe("edge case values", () => {
    it("should render null values as the string 'null'", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("test", { value: null });

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      const valueSpan = container.querySelector(".config-value") as HTMLElement;
      expect(valueSpan.textContent).toBe("null");
    });

    it("should render array values as comma-separated string", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("test", { items: [1, 2, 3] });

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      const valueSpan = container.querySelector(".config-value") as HTMLElement;
      expect(valueSpan.textContent).toBe("1,2,3");
    });
  });

  // =======================================================================
  // S-1 qa: Numeric parsing edge cases
  // =======================================================================

  describe("numeric parsing edge cases", () => {
    it("should parse '0' as number 0", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      const valueSpan = container.querySelector(".config-value") as HTMLElement;
      valueSpan.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

      const input = container.querySelector("input") as HTMLInputElement;
      input.value = "0";
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      expect(cm.get<number>("teams.macklen.motor")).toBe(0);
    });

    it("should parse '-5' as number -5", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      const valueSpan = container.querySelector(".config-value") as HTMLElement;
      valueSpan.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

      const input = container.querySelector("input") as HTMLInputElement;
      input.value = "-5";
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      expect(cm.get<number>("teams.macklen.motor")).toBe(-5);
    });

    it("should parse '3.14' as number 3.14", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      const valueSpan = container.querySelector(".config-value") as HTMLElement;
      valueSpan.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

      const input = container.querySelector("input") as HTMLInputElement;
      input.value = "3.14";
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      expect(cm.get<number>("teams.macklen.motor")).toBe(3.14);
    });

    it("should keep '1e5' as string (not parse as number)", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      const valueSpan = container.querySelector(".config-value") as HTMLElement;
      valueSpan.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

      const input = container.querySelector("input") as HTMLInputElement;
      input.value = "1e5";
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      expect(cm.get<string>("teams.macklen.motor")).toBe("1e5");
    });

    it("should keep 'abc123' as string", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      const valueSpan = container.querySelector(".config-value") as HTMLElement;
      valueSpan.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

      const input = container.querySelector("input") as HTMLInputElement;
      input.value = "abc123";
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      expect(cm.get<string>("teams.macklen.motor")).toBe("abc123");
    });
  });

  // =======================================================================
  // Key fallback: pressing a key that is neither Enter nor Escape
  // =======================================================================

  describe("key fallback", () => {
    it("should ignore keys that are neither Enter nor Escape", () => {
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      const valueSpan = container.querySelector(".config-value") as HTMLElement;
      valueSpan.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

      const input = container.querySelector("input") as HTMLInputElement;
      input.value = "999";

      // Press Tab — should be ignored, input stays
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", bubbles: true })
      );

      // Input should still exist (not replaced by span)
      expect(container.querySelector("input")).not.toBeNull();
      expect(container.querySelector("input")?.value).toBe("999");

      // Press Space — should also be ignored
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true })
      );

      expect(container.querySelector("input")).not.toBeNull();

      // Only Enter should finalize
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );

      expect(cm.get<number>("teams.macklen.motor")).toBe(999);
    });
  });

  // =======================================================================
  // DEV guard: _startEdit is no-op when DEV=false
  // =======================================================================

  describe("DEV guard", () => {
    it("should not render DOM when refresh() is called with DEV=false", () => {
      vi.stubEnv("DEV", false);

      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();

      // No DOM should be created — refresh() returned early
      expect(container.innerHTML).toBe("");
      expect(container.querySelector("details")).toBeNull();

      vi.stubEnv("DEV", true);
    });

    it("should not enter edit mode when _startEdit is called with DEV=false", () => {
      // First render with DEV=true to create the DOM
      const cm = new ConfigManager();
      cm.init();
      cm.register("teams", { macklen: { motor: 250 } });

      const container = createContainer();
      const panel = new ConfigTreePanel(container, () => cm);
      panel.refresh();
      expandFirstDetails(container);

      // Verify DOM was created
      const valueSpan = container.querySelector(".config-value");
      expect(valueSpan).not.toBeNull();

      // Now stub DEV to false — _startEdit should be a no-op
      vi.stubEnv("DEV", false);

      // Double-click should not create an input
      valueSpan?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

      // No input should appear — _startEdit returned early
      expect(container.querySelector("input")).toBeNull();

      // Value span should still show original value
      expect(valueSpan?.textContent).toBe("250");

      vi.stubEnv("DEV", true); // restore for other tests
    });
  });
});

// ─── Coverage gap: boolean/null parsing ───

describe("Config Tree — boolean/null parsing", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("should parse 'true' as boolean true", () => {
    const cm = new ConfigManager();
    cm.init();
    cm.register("test", { flag: true });

    const container = createContainer();
    const panel = new ConfigTreePanel(container, () => cm);
    panel.refresh();

    const details = container.querySelector("details");
    if (details) details.open = true;

    const valueSpan = container.querySelector(".config-value");
    expect(valueSpan?.textContent).toBe("true");

    valueSpan?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const input = container.querySelector("input");
    expect(input).not.toBeNull();

    // biome-ignore lint/style/noNonNullAssertion: tested via toBeNull guard above
    const inp = input!;
    inp.value = "true";
    inp.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );

    expect(cm.get("test.flag")).toBe(true);
  });

  it("should parse 'false' as boolean false", () => {
    const cm = new ConfigManager();
    cm.init();
    cm.register("test", { flag: false });

    const container = createContainer();
    const panel = new ConfigTreePanel(container, () => cm);
    panel.refresh();

    const details = container.querySelector("details");
    if (details) details.open = true;

    const valueSpan = container.querySelector(".config-value");
    valueSpan?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const input = container.querySelector("input") as HTMLInputElement | null;
    expect(input).not.toBeNull();

    input.value = "false";
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );

    expect(cm.get("test.flag")).toBe(false);
  });

  it("should parse 'null' as null", () => {
    const cm = new ConfigManager();
    cm.init();
    cm.register("test", { value: "something" });

    const container = createContainer();
    const panel = new ConfigTreePanel(container, () => cm);
    panel.refresh();

    const details = container.querySelector("details");
    if (details) details.open = true;

    const valueSpan = container.querySelector(".config-value");
    valueSpan?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    const input = container.querySelector("input") as HTMLInputElement | null;
    expect(input).not.toBeNull();

    input.value = "null";
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );

    expect(cm.get("test.value")).toBeNull();
  });
});
