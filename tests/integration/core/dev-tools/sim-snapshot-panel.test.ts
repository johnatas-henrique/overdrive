// @vitest-environment happy-dom

/**
 * Integration tests: Simulation Snapshot Panel.
 *
 * Verifies that SimSnapshotPanel renders the registered ISnapshotable system
 * list, displays per-system FNV-1a hashes, shows diff indicators (green ✓ /
 * red ✗ / em dash —), provides Take/Restore controls guarded by
 * import.meta.env.DEV, and isolates system failures during restore.
 *
 * @see TR-DVT-004 — Simulation snapshot / deterministic state restore
 * @see ADR-0009 — Dev Tools Architecture
 * @see ADR-0017 — Simulation Snapshot System
 * @see Control Manifest D6 — Read-only on all systems (with DEV-guarded exception)
 * @see Story 007 — Sim Snapshot Panel
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fnv1a } from "@/foundation/simulation-snapshot/fnv1a";
import { SimulationSnapshot } from "@/foundation/simulation-snapshot/simulation-snapshot";
import type { ISnapshotable } from "@/foundation/simulation-snapshot/types";

// Import after mocks
let SimSnapshotPanel: typeof import("../../../../src/core/dev-tools/sim-snapshot-panel").SimSnapshotPanel;

// ---------------------------------------------------------------------------
// Helper: create a test ISnapshotable system
// ---------------------------------------------------------------------------

class TestSys implements ISnapshotable {
  readonly systemId: string;
  private _state: Record<string, unknown>;

  constructor(systemId: string, state?: Record<string, unknown>) {
    this.systemId = systemId;
    this._state = state ? JSON.parse(JSON.stringify(state)) : {};
  }

  serialize(): Record<string, unknown> {
    return JSON.parse(JSON.stringify(this._state));
  }

  deserialize(state: Record<string, unknown>): void {
    this._state = JSON.parse(JSON.stringify(state));
  }

  hash(): string {
    return fnv1a(JSON.stringify(this._state));
  }
}

// Add an error-throwing test system
class FailingTestSys implements ISnapshotable {
  readonly systemId: string;
  private _state: Record<string, unknown>;

  constructor(systemId: string, state?: Record<string, unknown>) {
    this.systemId = systemId;
    this._state = state ? JSON.parse(JSON.stringify(state)) : {};
  }

  serialize(): Record<string, unknown> {
    return JSON.parse(JSON.stringify(this._state));
  }

  deserialize(): void {
    throw new Error("Deserialize failure");
  }

  hash(): string {
    return fnv1a(JSON.stringify(this._state));
  }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let container: HTMLDivElement;

beforeEach(async () => {
  vi.stubEnv("DEV", true);
  const mod = await import("../../../../src/core/dev-tools/sim-snapshot-panel");
  SimSnapshotPanel = mod.SimSnapshotPanel;
});

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  container?.remove();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helper: create and return a SimSnapshotPanel with test snapshot + systems
// ---------------------------------------------------------------------------

function createPanel(
  snapshot: SimulationSnapshot,
  parent: HTMLElement = container,
  showNotification?: (message: string) => void
): InstanceType<typeof SimSnapshotPanel> {
  return new SimSnapshotPanel(parent, snapshot, showNotification);
}

function createSnapshot(
  initialSystems: Array<{ id: string; state?: Record<string, unknown> }>
): SimulationSnapshot {
  const ss = new SimulationSnapshot();
  ss.init();
  for (const s of initialSystems) {
    ss.register(new TestSys(s.id, s.state));
  }
  return ss;
}

// ===========================================================================
// AC-7a: Registered systems list displayed
// ===========================================================================

describe("AC-7a: Registered systems list displayed", () => {
  it("should render system IDs for each registered system", () => {
    const ss = createSnapshot([
      { id: "physics", state: { speed: 100 } },
      { id: "fuel", state: { level: 50 } },
    ]);
    const panel = createPanel(ss);

    const systemRows = container.querySelectorAll(".ssn-system-row");
    expect(systemRows.length).toBe(2);

    const ids = Array.from(systemRows).map((row) =>
      (row.querySelector(".ssn-system-id") as HTMLElement)?.textContent?.trim()
    );
    expect(ids).toContain("physics");
    expect(ids).toContain("fuel");

    panel.dispose();
  });

  it("should show empty message when no systems registered", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    const panel = createPanel(ss);

    const emptyEl = container.querySelector(".ssn-empty");
    expect(emptyEl).not.toBeNull();
    expect(emptyEl?.textContent).toBeTruthy();

    panel.dispose();
  });

  it("should update system list when systems are registered after panel creation", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    const panel = createPanel(ss);

    // Initially empty
    const emptyEl = container.querySelector(".ssn-empty");
    expect(emptyEl).not.toBeNull();

    // Register a system
    ss.register(new TestSys("new-sys", { v: 1 }));
    panel.refresh();

    const rows = container.querySelectorAll(".ssn-system-row");
    expect(rows.length).toBe(1);
    expect(
      (
        rows[0].querySelector(".ssn-system-id") as HTMLElement
      )?.textContent?.trim()
    ).toBe("new-sys");

    panel.dispose();
  });
});

// ===========================================================================
// AC-7b: Per-system FNV-1a hash displayed
// ===========================================================================

describe("AC-7b: Per-system hash displayed", () => {
  it("should display hash hex string for each system", () => {
    const sys = new TestSys("test", { data: "hello" });
    const ss = new SimulationSnapshot();
    ss.init();
    ss.register(sys);
    const panel = createPanel(ss);

    const hashEl = container.querySelector(".ssn-system-hash") as HTMLElement;
    expect(hashEl).not.toBeNull();
    expect(hashEl?.textContent?.trim()).toMatch(/^[0-9a-f]{16}$/);
    // Verify it matches the actual hash
    expect(hashEl?.textContent?.trim()).toBe(sys.hash());

    panel.dispose();
  });

  it("should display the same hash for identical states (determinism)", () => {
    const ss = createSnapshot([{ id: "sys", state: { x: 42 } }]);
    const panel = createPanel(ss);

    const hashEl = container.querySelector(".ssn-system-hash") as HTMLElement;
    const hash1 = hashEl?.textContent?.trim();

    // Refresh — same state should produce identical hash
    panel.refresh();
    const hashEl2 = container.querySelector(".ssn-system-hash") as HTMLElement;
    const hash2 = hashEl2?.textContent?.trim();

    expect(hash1).toBe(hash2);

    panel.dispose();
  });

  it("should display different hashes for different states", () => {
    const ss = createSnapshot([
      { id: "a", state: { v: 1 } },
      { id: "b", state: { v: 2 } },
    ]);
    const panel = createPanel(ss);

    const hashEls = container.querySelectorAll(".ssn-system-hash");
    expect(hashEls.length).toBe(2);
    expect(hashEls[0]?.textContent?.trim()).not.toBe(
      hashEls[1]?.textContent?.trim()
    );

    panel.dispose();
  });

  it("should persist hashes to a snapshot taken with takeSnapshot", () => {
    const ss = createSnapshot([{ id: "sys", state: { value: 123 } }]);
    const panel = createPanel(ss);

    // Displayed hash before any operation
    const hashEl = container.querySelector(".ssn-system-hash") as HTMLElement;
    const displayedHash = hashEl?.textContent?.trim();

    // Take a snapshot
    panel.debugTakeSnapshot();

    // Hash should remain the same (state hasn't changed)
    const hashElAfter = container.querySelector(
      ".ssn-system-hash"
    ) as HTMLElement;
    expect(hashElAfter?.textContent?.trim()).toBe(displayedHash);

    panel.dispose();
  });
});

// ===========================================================================
// AC-7c: Hash diff indicators
// ===========================================================================

describe("AC-7c: Hash diff indicators", () => {
  it("should show em dash when no snapshot has been taken yet", () => {
    const ss = createSnapshot([{ id: "physics", state: { speed: 100 } }]);
    const panel = createPanel(ss);

    const diffEl = container.querySelector(".ssn-system-diff") as HTMLElement;
    expect(diffEl?.textContent).toBe("\u2014");
    expect(diffEl?.classList.contains("ssn-diff-none")).toBe(true);

    panel.dispose();
  });

  it("should show green checkmark when hash matches last taken snapshot", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const panel = createPanel(ss);

    // Take snapshot — current state becomes baseline
    panel.debugTakeSnapshot();
    panel.refresh();

    const diffEl = container.querySelector(".ssn-system-diff") as HTMLElement;
    expect(diffEl?.textContent).toBe("\u2713");
    expect(diffEl?.classList.contains("ssn-diff-match")).toBe(true);

    panel.dispose();
  });

  it("should show red cross when hash differs from last taken snapshot", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const panel = createPanel(ss);

    // Take snapshot — captures current state
    panel.debugTakeSnapshot();

    // Change state
    const sys = ss.getRegisteredSystems()[0];
    sys.deserialize({ v: 99 });
    panel.refresh();

    const diffEl = container.querySelector(".ssn-system-diff") as HTMLElement;
    expect(diffEl?.textContent).toBe("\u2717");
    expect(diffEl?.classList.contains("ssn-diff-change")).toBe(true);

    panel.dispose();
  });

  it("should re-show green checkmark after restoring snapshot", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const panel = createPanel(ss);

    // Take snapshot
    panel.debugTakeSnapshot();
    panel.refresh();

    // Verify checkmark initially
    let diffEl = container.querySelector(".ssn-system-diff") as HTMLElement;
    expect(diffEl?.textContent).toBe("\u2713");

    // Mutate state
    const sys = ss.getRegisteredSystems()[0];
    sys.deserialize({ v: 99 });
    panel.refresh();

    // Verify cross
    diffEl = container.querySelector(".ssn-system-diff") as HTMLElement;
    expect(diffEl?.textContent).toBe("\u2717");

    // Restore snapshot
    panel.debugRestoreSnapshot();
    panel.refresh();

    // Verify checkmark again
    diffEl = container.querySelector(".ssn-system-diff") as HTMLElement;
    expect(diffEl?.textContent).toBe("\u2713");

    panel.dispose();
  });

  it("should handle systems with different diff states in same panel", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    const sysA = new TestSys("a", { v: 1 });
    const sysB = new TestSys("b", { v: 2 });
    ss.register(sysA);
    ss.register(sysB);
    const panel = createPanel(ss);

    // Take snapshot — both green
    panel.debugTakeSnapshot();
    panel.refresh();

    // Mutate only sysA
    sysA.deserialize({ v: 99 });
    panel.refresh();

    const diffs = container.querySelectorAll(".ssn-system-diff");
    expect(diffs.length).toBe(2);

    // sysA changed → red cross
    expect((diffs[0] as HTMLElement).textContent).toBe("\u2717");
    expect(
      (diffs[0] as HTMLElement).classList.contains("ssn-diff-change")
    ).toBe(true);

    // sysB unchanged → green check
    expect((diffs[1] as HTMLElement).textContent).toBe("\u2713");
    expect((diffs[1] as HTMLElement).classList.contains("ssn-diff-match")).toBe(
      true
    );

    panel.dispose();
  });
});

// ===========================================================================
// AC-7d: Take / Restore snapshot controls
// ===========================================================================

describe("AC-7d: Take/Restore snapshot controls", () => {
  it("should take a snapshot and display results", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const panel = createPanel(ss);

    // Use the Take button
    const takeBtn = container.querySelector(
      ".ssn-take-btn"
    ) as HTMLButtonElement;
    expect(takeBtn).not.toBeNull();
    takeBtn.click();

    // After taking a snapshot, the Restore button should become enabled
    const restoreBtn = container.querySelector(
      ".ssn-restore-btn"
    ) as HTMLButtonElement;
    expect(restoreBtn).not.toBeNull();
    expect(restoreBtn.disabled).toBe(false);

    panel.dispose();
  });

  it("should restore snapshot and display result", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const panel = createPanel(ss);

    // Take snapshot
    const takeBtn = container.querySelector(
      ".ssn-take-btn"
    ) as HTMLButtonElement;
    takeBtn.click();

    // Mutate state
    const sys = ss.getRegisteredSystems()[0];
    sys.deserialize({ v: 99 });

    // Restore
    const restoreBtn = container.querySelector(
      ".ssn-restore-btn"
    ) as HTMLButtonElement;
    restoreBtn.click();

    // Verify state is restored
    expect(sys.serialize()).toEqual({ v: 1 });

    panel.dispose();
  });

  it("should display restore result with succeeded system IDs", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const panel = createPanel(ss);

    // Take snapshot
    const takeBtn = container.querySelector(
      ".ssn-take-btn"
    ) as HTMLButtonElement;
    takeBtn.click();

    // Restore
    const restoreBtn = container.querySelector(
      ".ssn-restore-btn"
    ) as HTMLButtonElement;
    restoreBtn.click();

    // Result should be shown
    const resultEl = container.querySelector(
      ".ssn-restore-result"
    ) as HTMLElement;
    expect(resultEl).not.toBeNull();
    expect(resultEl?.textContent).toContain("sys");

    panel.dispose();
  });

  it("should show failures in restore result", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    const sysA = new TestSys("good", { v: 1 });
    ss.register(sysA);
    // Register a system that will fail on deserialize
    ss.register(new FailingTestSys("bad", { v: 2 }));

    const panel = createPanel(ss);

    // Take snapshot
    const takeBtn = container.querySelector(
      ".ssn-take-btn"
    ) as HTMLButtonElement;
    takeBtn.click();

    // Restore
    const restoreBtn = container.querySelector(
      ".ssn-restore-btn"
    ) as HTMLButtonElement;
    restoreBtn.click();

    // Result should mention both succeeded and failed
    const resultEl = container.querySelector(
      ".ssn-restore-result"
    ) as HTMLElement;
    expect(resultEl).not.toBeNull();
    expect(resultEl?.textContent).toContain("good");
    expect(resultEl?.textContent).toContain("bad");

    panel.dispose();
  });
});

// ===========================================================================
// AC-7e: Notification callbacks
// ===========================================================================

describe("AC-7e: Notification callbacks", () => {
  it("should call showNotification after taking a snapshot with tick info", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const onNotify = vi.fn();
    const panel = createPanel(ss, container, onNotify);

    panel.debugTakeSnapshot();

    expect(onNotify).toHaveBeenCalledTimes(1);
    expect(onNotify).toHaveBeenCalledWith(
      expect.stringContaining("Snapshot taken at tick")
    );

    panel.dispose();
  });

  it("should call showNotification after restoring a snapshot with result", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const onNotify = vi.fn();
    const panel = createPanel(ss, container, onNotify);

    // Take first (creates the snapshot)
    panel.debugTakeSnapshot();
    onNotify.mockClear();

    // Restore
    panel.debugRestoreSnapshot();

    expect(onNotify).toHaveBeenCalledTimes(1);
    expect(onNotify).toHaveBeenCalledWith(expect.stringContaining("Restored"));

    panel.dispose();
  });

  it("should not throw when showNotification is not provided", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const panel = createPanel(ss);

    expect(() => {
      panel.debugTakeSnapshot();
      panel.debugRestoreSnapshot();
    }).not.toThrow();

    panel.dispose();
  });
});

// ===========================================================================
// DEV guard — controls only visible in DEV mode
// ===========================================================================

describe("DEV guard", () => {
  it("should show controls section when import.meta.env.DEV is true", () => {
    vi.stubEnv("DEV", true);
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const panel = createPanel(ss);

    const controls = container.querySelector(".ssn-controls") as HTMLElement;
    expect(controls).not.toBeNull();

    const takeBtn = container.querySelector(
      ".ssn-take-btn"
    ) as HTMLButtonElement;
    expect(takeBtn).not.toBeNull();

    panel.dispose();
    vi.unstubAllEnvs();
  });

  it("should hide controls when import.meta.env.DEV is false", () => {
    vi.stubEnv("DEV", false);
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const panel = createPanel(ss);

    const controls = container.querySelector(".ssn-controls");
    expect(controls).toBeNull();

    const takeBtn = container.querySelector(".ssn-take-btn");
    expect(takeBtn).toBeNull();

    panel.dispose();
    vi.unstubAllEnvs();
  });
});

// ===========================================================================
// Error isolation — system deserialize failure doesn't break panel
// ===========================================================================

describe("Error isolation", () => {
  it("should handle system deserialize failure without crashing", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    const sysA = new TestSys("good", { v: 1 });
    ss.register(sysA);
    ss.register(new FailingTestSys("bad", { v: 2 }));

    const panel = createPanel(ss);

    // Take snapshot
    const takeBtn = container.querySelector(
      ".ssn-take-btn"
    ) as HTMLButtonElement;
    takeBtn.click();

    // Restore — should not throw or crash
    const restoreBtn = container.querySelector(
      ".ssn-restore-btn"
    ) as HTMLButtonElement;

    expect(() => restoreBtn.click()).not.toThrow();

    // good system should remain unchanged (it was in original state)
    // Note: after take + restore in DEV env, the good system might be restored
    // Check that panel renders without error after restore
    const rows = container.querySelectorAll(".ssn-system-row");
    expect(rows.length).toBe(2);

    panel.dispose();
  });
});

// ===========================================================================
// Render stability
// ===========================================================================

describe("Render stability", () => {
  it("should render correctly with many registered systems", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    for (let i = 0; i < 50; i++) {
      ss.register(new TestSys(`sys-${i}`, { idx: i }));
    }
    const panel = createPanel(ss);

    const rows = container.querySelectorAll(".ssn-system-row");
    expect(rows.length).toBe(50);

    panel.dispose();
  });

  it("should survive multiple take/refresh cycles", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const panel = createPanel(ss);

    for (let i = 0; i < 10; i++) {
      panel.debugTakeSnapshot();
      panel.refresh();
    }

    const rows = container.querySelectorAll(".ssn-system-row");
    expect(rows.length).toBe(1);

    panel.dispose();
  });

  it("should survive refresh before any snapshot is taken", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const panel = createPanel(ss);

    // Multiple refreshes without any snapshot
    for (let i = 0; i < 5; i++) {
      panel.refresh();
    }

    const rows = container.querySelectorAll(".ssn-system-row");
    expect(rows.length).toBe(1);

    panel.dispose();
  });
});

// ===========================================================================
// Disposal
// ===========================================================================

describe("Disposal", () => {
  it("should remove DOM elements on dispose", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const panel = createPanel(ss);

    expect(container.children.length).toBeGreaterThan(0);
    panel.dispose();
    expect(container.children.length).toBe(0);
  });

  it("should be safe to call dispose multiple times", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const panel = createPanel(ss);

    expect(() => {
      panel.dispose();
      panel.dispose();
    }).not.toThrow();
  });
});

// ===========================================================================
// Gap 1: _handleTake error path
// ===========================================================================

describe("Gap 1: _handleTake error path", () => {
  it("should not crash when takeSnapshot throws and restore button stays disabled", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const panel = createPanel(ss);

    // Restore button initially disabled
    const restoreBtn = container.querySelector(
      ".ssn-restore-btn"
    ) as HTMLButtonElement;
    expect(restoreBtn.disabled).toBe(true);

    // Mock takeSnapshot to throw
    vi.spyOn(ss, "takeSnapshot").mockImplementation(() => {
      throw new Error("take failed");
    });

    // Should not throw
    expect(() => panel.debugTakeSnapshot()).not.toThrow();

    // Restore button should still be disabled
    expect(restoreBtn.disabled).toBe(true);

    panel.dispose();
  });
});

// ===========================================================================
// Gap 2: _handleRestore early return (no snapshot)
// ===========================================================================

describe("Gap 2: _handleRestore early return (no snapshot)", () => {
  it("should be a no-op when debugRestoreSnapshot is called before any take", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const panel = createPanel(ss);

    // No snapshot taken yet
    expect(panel.getLastSnapshot()).toBeNull();

    // Should not throw
    expect(() => panel.debugRestoreSnapshot()).not.toThrow();

    // Panel should still show em dash (no snapshot baseline)
    const diffEl = container.querySelector(".ssn-system-diff") as HTMLElement;
    expect(diffEl?.textContent).toBe("\u2014");
    expect(diffEl?.classList.contains("ssn-diff-none")).toBe(true);

    panel.dispose();
  });
});

// ===========================================================================
// Gap 3: _handleRestore error path
// ===========================================================================

describe("Gap 3: _handleRestore error path", () => {
  it("should show error message with ssn-restore-fail class when restoreSnapshot throws", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const panel = createPanel(ss);

    // Take a snapshot first (so _lastSnapshot is set)
    panel.debugTakeSnapshot();

    // Mock restoreSnapshot to throw
    vi.spyOn(ss, "restoreSnapshot").mockImplementation(() => {
      throw new Error("restore failed");
    });

    // Should not crash
    expect(() => panel.debugRestoreSnapshot()).not.toThrow();

    // Error message should appear in result element
    const resultEl = container.querySelector(
      ".ssn-restore-result"
    ) as HTMLElement;
    expect(resultEl).not.toBeNull();
    expect(resultEl.textContent).toContain("Restore failed");
    expect(resultEl.textContent).toContain("restore failed");

    // CSS class should indicate failure (Gap 8 coverage)
    expect(resultEl.classList.contains("ssn-restore-fail")).toBe(true);

    panel.dispose();
  });
});

// ===========================================================================
// Gap 4: _renderSystems exception path
// ===========================================================================

describe("Gap 4: _renderSystems exception path", () => {
  it("should show SimulationSnapshot not initialized error when getRegisteredSystems throws", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);

    // Mock getRegisteredSystems to throw
    vi.spyOn(ss, "getRegisteredSystems").mockImplementation(() => {
      throw new Error("fail");
    });

    const panel = createPanel(ss);

    // Error div should appear
    const errEl = container.querySelector(".ssn-empty") as HTMLElement;
    expect(errEl).not.toBeNull();
    expect(errEl.textContent).toBe("SimulationSnapshot not initialized");

    panel.dispose();
  });
});

// ===========================================================================
// Gap 5: refresh after dispose
// ===========================================================================

describe("Gap 5: refresh after dispose", () => {
  it("should not throw when refresh is called after dispose", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const panel = createPanel(ss);

    panel.dispose();

    expect(() => panel.refresh()).not.toThrow();
  });
});

// ===========================================================================
// Gap 6: New system after snapshot
// ===========================================================================

describe("Gap 6: New system after snapshot", () => {
  it("should show em dash for a system registered after the snapshot was taken", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    const sysA = new TestSys("sysA", { v: 1 });
    ss.register(sysA);
    const panel = createPanel(ss);

    // Take snapshot with only sysA
    panel.debugTakeSnapshot();
    panel.refresh();

    // Register sysB after snapshot
    const sysB = new TestSys("sysB", { v: 2 });
    ss.register(sysB);
    panel.refresh();

    const rows = container.querySelectorAll(".ssn-system-row");
    expect(rows.length).toBe(2);

    // Verify order: sysA first (registered first), sysB second
    const idEls = container.querySelectorAll(".ssn-system-id");
    expect((idEls[0] as HTMLElement).textContent?.trim()).toBe("sysA");
    expect((idEls[1] as HTMLElement).textContent?.trim()).toBe("sysB");

    // sysA unchanged → green checkmark
    const diffs = container.querySelectorAll(".ssn-system-diff");
    expect((diffs[0] as HTMLElement).textContent).toBe("\u2713");

    // sysB not in snapshot → em dash
    expect((diffs[1] as HTMLElement).textContent).toBe("\u2014");
    expect((diffs[1] as HTMLElement).classList.contains("ssn-diff-none")).toBe(
      true
    );

    panel.dispose();
  });
});

// ===========================================================================
// Gap 7: getLastSnapshot null/return
// ===========================================================================

describe("Gap 7: getLastSnapshot null/return", () => {
  it("should return null initially and return snapshot after take", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const panel = createPanel(ss);

    // Initially null
    expect(panel.getLastSnapshot()).toBeNull();

    // Take a snapshot
    panel.debugTakeSnapshot();

    // Now should return snapshot
    const snap = panel.getLastSnapshot();
    expect(snap).not.toBeNull();
    expect(snap).toHaveProperty("tick");
    expect(snap).toHaveProperty("timestamp");
    expect(snap).toHaveProperty("systems");
    expect(snap?.systems).toHaveProperty("sys");

    panel.dispose();
  });
});

// ===========================================================================
// Gap 8: CSS class verification
// ===========================================================================

describe("Gap 8: CSS class verification", () => {
  it("should have ssn-restore-success class on successful restore", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const panel = createPanel(ss);

    // Take and restore successfully
    panel.debugTakeSnapshot();
    panel.debugRestoreSnapshot();

    const resultEl = container.querySelector(
      ".ssn-restore-result"
    ) as HTMLElement;
    expect(resultEl).not.toBeNull();
    expect(resultEl.classList.contains("ssn-restore-success")).toBe(true);
    expect(resultEl.classList.contains("ssn-restore-fail")).toBe(false);

    panel.dispose();
  });
});

// ===========================================================================
// Gap 9: DEV=false + debugTakeSnapshot — null guards on _restoreBtn,
//         _restoreResultEl (lines 239, 244)
// ===========================================================================

describe("Gap 9: DEV=false null guards", () => {
  it("should not crash when debugTakeSnapshot is called in DEV=false mode", () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();

    return import("../../../../src/core/dev-tools/sim-snapshot-panel").then(
      (mod) => {
        const Panel = mod.SimSnapshotPanel;
        const ss = new SimulationSnapshot();
        ss.init();
        ss.register(new TestSys("sys", { v: 1 }));
        const c = document.createElement("div");
        const panel = new Panel(c, ss);
        // Constructor skips _initDOM — _restoreBtn / _restoreResultEl are null
        expect(() => panel.debugTakeSnapshot()).not.toThrow();
        panel.dispose();
        vi.unstubAllEnvs();
      }
    );
  });
});

// ===========================================================================
// Gap 10: Non-Error throw in _handleTake (line 253)
// ===========================================================================

describe("Gap 10: Non-Error throw in _handleTake", () => {
  it("should handle non-Error throw from takeSnapshot gracefully", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const panel = createPanel(ss);

    // Mock takeSnapshot to throw a string primitive
    vi.spyOn(ss, "takeSnapshot").mockImplementation(() => {
      throw "string error";
    });

    // Should not crash — catch block uses String(err)
    expect(() => panel.debugTakeSnapshot()).not.toThrow();

    // Restore button should remain disabled (snapshot was not stored)
    const restoreBtn = container.querySelector(
      ".ssn-restore-btn"
    ) as HTMLButtonElement;
    expect(restoreBtn.disabled).toBe(true);

    panel.dispose();
  });
});

// ===========================================================================
// Gap 11: Restore with all systems failing — "No systems restored" (line 267)
// ===========================================================================

describe("Gap 11: All systems fail on restore", () => {
  it("should show 'No systems restored' when all restorations fail", () => {
    const ss = new SimulationSnapshot();
    ss.init();
    // Register a system that fails during deserialize
    ss.register(new FailingTestSys("fails", { v: 1 }));
    const panel = createPanel(ss);

    // Take snapshot
    panel.debugTakeSnapshot();
    panel.refresh();

    // Restore — all systems fail, succeeded.length === 0
    panel.debugRestoreSnapshot();
    panel.refresh();

    const resultEl = container.querySelector(
      ".ssn-restore-result"
    ) as HTMLElement;
    expect(resultEl).not.toBeNull();
    expect(resultEl.textContent).toContain("No systems restored");
    expect(resultEl.textContent).toContain("fails");

    panel.dispose();
  });
});

// ===========================================================================
// Gap 12: Non-Error throw in _handleRestore (line 286)
// ===========================================================================

describe("Gap 12: Non-Error throw in _handleRestore", () => {
  it("should show 'Unknown error' when restoreSnapshot throws a primitive", () => {
    const ss = createSnapshot([{ id: "sys", state: { v: 1 } }]);
    const panel = createPanel(ss);

    // Take a snapshot first so _lastSnapshot is set
    panel.debugTakeSnapshot();

    // Mock restoreSnapshot to throw a non-Error primitive
    vi.spyOn(ss, "restoreSnapshot").mockImplementation(() => {
      throw "something broke";
    });

    // Should not crash
    expect(() => panel.debugRestoreSnapshot()).not.toThrow();

    const resultEl = container.querySelector(
      ".ssn-restore-result"
    ) as HTMLElement;
    expect(resultEl).not.toBeNull();
    expect(resultEl.textContent).toContain("Unknown error");
    expect(resultEl.classList.contains("ssn-restore-fail")).toBe(true);

    panel.dispose();
  });
});

// ─── Coverage gap: missing hash fallback ───

describe("Coverage gap — missing hash fallback", () => {
  it("should display 'error' when hash is undefined", () => {
    const snapshot = new SimulationSnapshot();
    snapshot.init();

    // Register a system whose hash() returns undefined
    snapshot.register({
      systemId: "broken-system",
      serialize: () => ({ v: 1 }),
      deserialize: () => {},
      hash: () => undefined as unknown as string,
    });

    const panel = createPanel(snapshot);
    panel.refresh();

    // Should display "error" instead of crashing
    const hashEl = container.querySelector(".ssn-system-hash");
    expect(hashEl?.textContent).toBe("error");

    panel.dispose();
  });
});
