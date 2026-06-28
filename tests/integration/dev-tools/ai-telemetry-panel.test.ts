// @vitest-environment happy-dom

/**
 * Integration tests: AI Telemetry Panel.
 *
 * Verifies that AiTelemetryPanel renders per-car speed, position, and
 * behavior data in an HTML table, handles the empty state gracefully,
 * respects the sample rate, highlights the player car, and disposes
 * cleanly.
 *
 * @see TR-DVT-008 — AI Telemetry Tab
 * @see ADR-0009 — Dev Tools Architecture
 * @see Control Manifest D6 — Read-only on all systems
 * @see Story 008 — AI Telemetry Tab
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiTelemetryCarData } from "../../../src/core/dev-tools/types";

// Import after mocks
let AiTelemetryPanel: typeof import("../../../src/core/dev-tools/ai-telemetry-panel").AiTelemetryPanel;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return a standard 3-car telemetry dataset. */
function threeCars(): AiTelemetryCarData[] {
  return [
    {
      carId: "player-1",
      speed: 120,
      position: { lap: 3, trackProgress: 0.45, overall: 1 },
      behavior: "Normal",
    },
    {
      carId: "ai-1",
      speed: 115,
      position: { lap: 3, trackProgress: 0.42, overall: 2 },
      behavior: "Following",
    },
    {
      carId: "ai-2",
      speed: 108,
      position: { lap: 2, trackProgress: 0.88, overall: 3 },
      behavior: "Passing",
    },
  ];
}

/** Return an empty telemetry dataset. */
function noCars(): AiTelemetryCarData[] {
  return [];
}

/** Create a new panel with the given telemetry reader and sample rate. */
function createPanel(
  reader: () => AiTelemetryCarData[],
  parent: HTMLElement = container,
  sampleRate?: number
): InstanceType<typeof AiTelemetryPanel> {
  return new AiTelemetryPanel(parent, reader, sampleRate);
}

/** Get the table body rows from the panel. */
function getRows(parent: HTMLElement): NodeListOf<HTMLTableRowElement> {
  return parent.querySelectorAll("tbody tr");
}

/** Get a text cell from a row by column index. */
function cellText(row: HTMLTableRowElement, colIndex: number): string {
  const cells = row.querySelectorAll("td");
  return (cells[colIndex] as HTMLElement)?.textContent?.trim() ?? "";
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let container: HTMLDivElement;

beforeEach(async () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  vi.stubEnv("DEV", true);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.resetModules();
  const mod = await import("../../../src/core/dev-tools/ai-telemetry-panel");
  AiTelemetryPanel = mod.AiTelemetryPanel;
});

afterEach(() => {
  container?.remove();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

// ===========================================================================
// AC-8a: Per-car telemetry display (3 cars with correct values)
// ===========================================================================

describe("AC-8a: per-car telemetry display", () => {
  it("should render a table with one row per car", () => {
    const panel = createPanel(threeCars);

    const rows = getRows(container);
    expect(rows.length).toBe(3);

    panel.dispose();
  });

  it("should show correct Car ID, Speed, Position, and Behavior for each car", () => {
    const panel = createPanel(threeCars);

    const rows = getRows(container);

    // Row 1: player-1 (leader, sorted by overall)
    expect(cellText(rows[0], 0)).toBe("player-1");
    expect(cellText(rows[0], 1)).toBe("120");
    expect(cellText(rows[0], 2)).toContain("L3");
    expect(cellText(rows[0], 2)).toContain("45%");
    expect(cellText(rows[0], 2)).toContain("#1");
    expect(cellText(rows[0], 3)).toBe("Normal");

    // Row 2: ai-1
    expect(cellText(rows[1], 0)).toBe("ai-1");
    expect(cellText(rows[1], 1)).toBe("115");
    expect(cellText(rows[1], 2)).toContain("L3");
    expect(cellText(rows[1], 2)).toContain("42%");
    expect(cellText(rows[1], 2)).toContain("#2");
    expect(cellText(rows[1], 3)).toBe("Following");

    // Row 3: ai-2
    expect(cellText(rows[2], 0)).toBe("ai-2");
    expect(cellText(rows[2], 1)).toBe("108");
    expect(cellText(rows[2], 2)).toContain("L2");
    expect(cellText(rows[2], 2)).toContain("88%");
    expect(cellText(rows[2], 2)).toContain("#3");
    expect(cellText(rows[2], 3)).toBe("Passing");

    panel.dispose();
  });

  it("should sort rows by overall position (leader first)", () => {
    // Out-of-order input: car 3 first, car 1 second, car 2 third
    const unsorted: AiTelemetryCarData[] = [
      {
        carId: "ai-2",
        speed: 108,
        position: { lap: 2, trackProgress: 0.88, overall: 3 },
        behavior: "Passing",
      },
      {
        carId: "player-1",
        speed: 120,
        position: { lap: 3, trackProgress: 0.45, overall: 1 },
        behavior: "Normal",
      },
      {
        carId: "ai-1",
        speed: 115,
        position: { lap: 3, trackProgress: 0.42, overall: 2 },
        behavior: "Following",
      },
    ];
    const panel = createPanel(() => unsorted);

    const rows = getRows(container);
    expect(rows.length).toBe(3);
    expect(cellText(rows[0], 0)).toBe("player-1"); // overall 1
    expect(cellText(rows[1], 0)).toBe("ai-1"); // overall 2
    expect(cellText(rows[2], 0)).toBe("ai-2"); // overall 3

    panel.dispose();
  });
});

// ===========================================================================
// AC-8b: Live updates (values update on refresh at sample rate)
// ===========================================================================

describe("AC-8b: live updates with sample rate", () => {
  it("should update values after enough refresh calls pass the sample rate", () => {
    // Start with initial speed values
    let currentSpeed = 120;
    const reader = (): AiTelemetryCarData[] => [
      {
        carId: "player-1",
        speed: currentSpeed,
        position: { lap: 1, trackProgress: 0, overall: 1 },
        behavior: "Normal",
      },
    ];
    const panel = createPanel(reader, container, 10);

    // Initial render: speed should be 120
    let rows = getRows(container);
    expect(rows.length).toBe(1);
    expect(cellText(rows[0], 1)).toBe("120");

    // Change speed
    currentSpeed = 150;

    // Constructor rendered initial data. First refresh is skipped.
    // Sample re-read occurs at tick 11 (after 11 refreshes).
    for (let i = 0; i < 11; i++) {
      panel.refresh();
    }

    // After 11 refreshes (tick=11), we should see the new speed
    rows = getRows(container);
    expect(cellText(rows[0], 1)).toBe("150");

    panel.dispose();
  });

  it("should not update DOM between sample rate ticks", () => {
    let speed = 120;
    const reader = (): AiTelemetryCarData[] => [
      {
        carId: "player-1",
        speed,
        position: { lap: 1, trackProgress: 0, overall: 1 },
        behavior: "Normal",
      },
    ];
    const panel = createPanel(reader, container, 10);

    // Initial: speed = 120 (rendered in constructor)
    expect(cellText(getRows(container)[0], 1)).toBe("120");

    // Change speed but stay within sample window
    speed = 200;

    // First refresh (tick=1) is skipped — constructor already rendered
    // So we need to reach tick 11 for a re-render.
    // After 9 refreshes (ticks 2-10), still no re-render
    for (let i = 0; i < 9; i++) {
      panel.refresh();
    }

    // DOM should still show 120 (only 9 refreshes done,
    // tick counter = 9, (9-1)%10 = 8 ≠ 0 → no render)
    expect(cellText(getRows(container)[0], 1)).toBe("120");

    // One more: tick = 10, (10-1)%10 = 9 ≠ 0 → still no render
    panel.refresh();
    expect(cellText(getRows(container)[0], 1)).toBe("120");

    // Tick = 11: (11-1)%10 = 0 → render with speed=200!
    panel.refresh();
    expect(cellText(getRows(container)[0], 1)).toBe("200");

    panel.dispose();
  });

  it("should respect custom sample rate", () => {
    let data = threeCars();
    const reader = (): AiTelemetryCarData[] => data;
    const panel = createPanel(reader, container, 3);

    // Initial render: 3 rows
    let rows = getRows(container);
    expect(rows.length).toBe(3);

    // Change to empty
    data = [];

    // First refresh (tick=1) is skipped (constructor rendered).
    // Second refresh (tick=2): (2-1)%3 = 1 ≠ 0 → skip
    panel.refresh();
    panel.refresh();
    rows = getRows(container);
    expect(rows.length).toBe(3); // still showing old data

    // Third refresh (tick=3): (3-1)%3 = 2 ≠ 0 → skip
    panel.refresh();
    rows = getRows(container);
    expect(rows.length).toBe(3); // still showing old data

    // Fourth refresh (tick=4): (4-1)%3 = 0 → render with empty data!
    panel.refresh();
    const emptyEl = container.querySelector(".ait-empty") as HTMLElement;
    expect(emptyEl.style.display).not.toBe("none");

    panel.dispose();
  });

  it("should expose tick counter and sample rate for debugging", () => {
    const panel = createPanel(threeCars, container, 7);
    expect(panel.getSampleRate()).toBe(7);
    expect(panel.getTickCounter()).toBe(0);

    panel.refresh();
    expect(panel.getTickCounter()).toBe(1);

    panel.refresh();
    expect(panel.getTickCounter()).toBe(2);

    panel.dispose();
  });
});

// ===========================================================================
// AC-8c: Empty state when no AI cars registered
// ===========================================================================

describe("AC-8c: empty state (no AI cars on track)", () => {
  it("should show 'No AI cars on track' placeholder when no cars", () => {
    const panel = createPanel(noCars);

    const emptyEl = container.querySelector(".ait-empty") as HTMLElement;
    expect(emptyEl).not.toBeNull();
    expect(emptyEl.textContent).toBe("No AI cars on track");

    panel.dispose();
  });

  it("should hide table body when no cars", () => {
    const panel = createPanel(noCars);

    const tbody = container.querySelector("tbody") as HTMLElement;
    expect(tbody).not.toBeNull();
    expect(tbody.style.display).toBe("none");

    panel.dispose();
  });

  it("should switch from data to empty when cars are removed", () => {
    let data = threeCars();
    const panel = createPanel(() => data, container, 10);

    // Initially has data
    let emptyEl = container.querySelector(".ait-empty") as HTMLElement;
    expect(emptyEl.style.display).toBe("none");

    // Remove cars
    data = [];
    // Constructor rendered. Tick 1 is skipped. Tick 11 renders.
    for (let i = 0; i < 11; i++) {
      panel.refresh();
    }

    emptyEl = container.querySelector(".ait-empty") as HTMLElement;
    expect(emptyEl.style.display).not.toBe("none");
    expect(emptyEl.textContent).toBe("No AI cars on track");

    const tbody = container.querySelector("tbody") as HTMLElement;
    expect(tbody.style.display).toBe("none");

    panel.dispose();
  });

  it("should switch from empty to data when cars arrive", () => {
    let data: AiTelemetryCarData[] = [];
    const panel = createPanel(() => data);

    // Initially empty (rendered in constructor)
    let emptyEl = container.querySelector(".ait-empty") as HTMLElement;
    expect(emptyEl.style.display).not.toBe("none");

    // Add cars
    data = threeCars();
    // Tick 1 is skipped. Tick 11 would render, so we need 11 refreshes.
    // Actually with default sample rate 10:
    // Tick 1: skip; ticks 2-10: skip; tick 11: render
    for (let i = 0; i < 11; i++) {
      panel.refresh();
    }

    emptyEl = container.querySelector(".ait-empty") as HTMLElement;
    expect(emptyEl.style.display).toBe("none");

    const rows = getRows(container);
    expect(rows.length).toBe(3);

    panel.dispose();
  });
});

// ===========================================================================
// Player car highlighting
// ===========================================================================

describe("Player car highlighting", () => {
  it("should apply ait-row-player class to player-1 row", () => {
    const panel = createPanel(threeCars);

    const rows = container.querySelectorAll("tbody tr");
    const playerRow = rows[0] as HTMLTableRowElement; // player is overall #1
    expect(playerRow.classList.contains("ait-row-player")).toBe(true);
    expect(playerRow.classList.contains("ait-row-ai")).toBe(false);

    panel.dispose();
  });

  it("should apply ait-row-ai class to AI car rows", () => {
    const panel = createPanel(threeCars);

    const rows = container.querySelectorAll("tbody tr");
    // Row 1: ai-1 (overall #2)
    expect(
      (rows[1] as HTMLTableRowElement).classList.contains("ait-row-ai")
    ).toBe(true);
    expect(
      (rows[1] as HTMLTableRowElement).classList.contains("ait-row-player")
    ).toBe(false);
    // Row 2: ai-2 (overall #3)
    expect(
      (rows[2] as HTMLTableRowElement).classList.contains("ait-row-ai")
    ).toBe(true);
    expect(
      (rows[2] as HTMLTableRowElement).classList.contains("ait-row-player")
    ).toBe(false);

    panel.dispose();
  });

  it("should have data-car-id attribute on each row", () => {
    const panel = createPanel(threeCars);

    const rows = container.querySelectorAll("tbody tr");
    expect((rows[0] as HTMLTableRowElement).dataset.carId).toBe("player-1");
    expect((rows[1] as HTMLTableRowElement).dataset.carId).toBe("ai-1");
    expect((rows[2] as HTMLTableRowElement).dataset.carId).toBe("ai-2");

    panel.dispose();
  });

  it("should not highlight any row when no car is player-1", () => {
    const noPlayer: AiTelemetryCarData[] = [
      {
        carId: "ai-99",
        speed: 200,
        position: { lap: 1, trackProgress: 0.5, overall: 1 },
        behavior: "Normal",
      },
    ];
    const panel = createPanel(() => noPlayer);

    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(1);
    expect(
      (rows[0] as HTMLTableRowElement).classList.contains("ait-row-player")
    ).toBe(false);
    expect(
      (rows[0] as HTMLTableRowElement).classList.contains("ait-row-ai")
    ).toBe(true);

    panel.dispose();
  });
});

// ===========================================================================
// Behavior labels display
// ===========================================================================

describe("Behavior labels", () => {
  it("should display 'Normal' behavior", () => {
    const panel = createPanel(() => [
      {
        carId: "player-1",
        speed: 100,
        position: { lap: 1, trackProgress: 0, overall: 1 },
        behavior: "Normal",
      },
    ]);

    expect(cellText(getRows(container)[0], 3)).toBe("Normal");

    panel.dispose();
  });

  it("should display 'Following' behavior", () => {
    const panel = createPanel(() => [
      {
        carId: "ai-1",
        speed: 100,
        position: { lap: 1, trackProgress: 0, overall: 1 },
        behavior: "Following",
      },
    ]);

    expect(cellText(getRows(container)[0], 3)).toBe("Following");

    panel.dispose();
  });

  it("should display 'Passing' behavior", () => {
    const panel = createPanel(() => [
      {
        carId: "ai-1",
        speed: 100,
        position: { lap: 1, trackProgress: 0, overall: 1 },
        behavior: "Passing",
      },
    ]);

    expect(cellText(getRows(container)[0], 3)).toBe("Passing");

    panel.dispose();
  });
});

// ===========================================================================
// DOM structure
// ===========================================================================

describe("DOM structure", () => {
  it("should render header, table, and empty element", () => {
    const panel = createPanel(threeCars);

    expect(container.querySelector(".ait-header")).not.toBeNull();
    expect(container.querySelector(".ait-table")).not.toBeNull();
    expect(container.querySelector(".ait-container")).not.toBeNull();
    expect(container.querySelector(".ait-table-wrap")).not.toBeNull();

    panel.dispose();
  });

  it("should render 4 header columns", () => {
    const panel = createPanel(threeCars);

    const headers = container.querySelectorAll(".ait-th");
    expect(headers.length).toBe(4);
    expect((headers[0] as HTMLElement).textContent).toBe("Car ID");
    expect((headers[1] as HTMLElement).textContent).toBe("Speed (km/h)");
    expect((headers[2] as HTMLElement).textContent).toBe(
      "Position (Lap/Overall)"
    );
    expect((headers[3] as HTMLElement).textContent).toBe("Behavior");

    panel.dispose();
  });

  it("should hide empty element when data is present", () => {
    const panel = createPanel(threeCars);

    const emptyEl = container.querySelector(".ait-empty") as HTMLElement;
    expect(emptyEl.style.display).toBe("none");

    panel.dispose();
  });
});

// ===========================================================================
// Error handling
// ===========================================================================

describe("Error handling", () => {
  it("should show empty state when reader throws", () => {
    const panel = createPanel(() => {
      throw new Error("Simulated failure");
    });

    const emptyEl = container.querySelector(".ait-empty") as HTMLElement;
    expect(emptyEl).not.toBeNull();
    expect(emptyEl.style.display).not.toBe("none");
    expect(emptyEl.textContent).toBe("No AI cars on track");

    panel.dispose();
  });

  it("should recover after reader throws", () => {
    let shouldThrow = true;
    const panel = createPanel(
      () => {
        if (shouldThrow) {
          throw new Error("Transient failure");
        }
        return threeCars();
      },
      container,
      1
    ); // sample rate = 1 for immediate updates

    // Initially empty due to throw (rendered in constructor)
    let emptyEl = container.querySelector(".ait-empty") as HTMLElement;
    expect(emptyEl.style.display).not.toBe("none");

    // Stop throwing and refresh
    shouldThrow = false;
    panel.refresh(); // tick=1: skip (constructor rendered)
    panel.refresh(); // tick=2: (2-1)%1=0 → render with data!

    emptyEl = container.querySelector(".ait-empty") as HTMLElement;
    expect(emptyEl.style.display).toBe("none");
    expect(getRows(container).length).toBe(3);

    panel.dispose();
  });
});

// ===========================================================================
// Disposal
// ===========================================================================

describe("Disposal", () => {
  it("should remove DOM elements on dispose", () => {
    const panel = createPanel(threeCars);
    expect(container.children.length).toBeGreaterThan(0);

    panel.dispose();
    expect(container.children.length).toBe(0);
  });

  it("should be safe to call dispose multiple times", () => {
    const panel = createPanel(threeCars);

    expect(() => {
      panel.dispose();
      panel.dispose();
      panel.dispose();
    }).not.toThrow();

    expect(container.children.length).toBe(0);
  });

  it("should be safe to call refresh after dispose", () => {
    const panel = createPanel(threeCars);
    panel.dispose();

    expect(() => panel.refresh()).not.toThrow();
  });
});

// ===========================================================================
// Render stability
// ===========================================================================

describe("Render stability", () => {
  it("should render correctly with a single car", () => {
    const single: AiTelemetryCarData[] = [
      {
        carId: "player-1",
        speed: 100,
        position: { lap: 1, trackProgress: 0.5, overall: 1 },
        behavior: "Normal",
      },
    ];
    const panel = createPanel(() => single);

    const rows = getRows(container);
    expect(rows.length).toBe(1);

    panel.dispose();
  });

  it("should render correctly with many cars", () => {
    const many: AiTelemetryCarData[] = [];
    for (let i = 0; i < 25; i++) {
      many.push({
        carId: `car-${i}`,
        speed: 100 + i,
        position: { lap: 1, trackProgress: i / 25, overall: i + 1 },
        behavior:
          i % 3 === 0 ? "Normal" : i % 3 === 1 ? "Following" : "Passing",
      });
    }
    const panel = createPanel(() => many);

    const rows = getRows(container);
    expect(rows.length).toBe(25);

    panel.dispose();
  });

  it("should survive multiple refresh cycles", () => {
    const panel = createPanel(threeCars);

    for (let i = 0; i < 50; i++) {
      panel.refresh();
    }

    const rows = getRows(container);
    expect(rows.length).toBe(3);

    panel.dispose();
  });
});

// ===========================================================================
// DEV guard
// ===========================================================================

describe("DEV guard", () => {
  it("should render DOM when import.meta.env.DEV is true", () => {
    vi.stubEnv("DEV", true);
    vi.resetModules();
    return import("../../../src/core/dev-tools/ai-telemetry-panel").then(
      (mod) => {
        const Panel = mod.AiTelemetryPanel;
        const c = document.createElement("div");
        const panel = new Panel(c, threeCars);

        expect(c.querySelector(".ait-container")).not.toBeNull();
        expect(c.querySelector(".ait-header")).not.toBeNull();
        expect(c.querySelector(".ait-table")).not.toBeNull();

        panel.dispose();
        vi.unstubAllEnvs();
      }
    );
  });

  it("should not render DOM when import.meta.env.DEV is false", () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    return import("../../../src/core/dev-tools/ai-telemetry-panel").then(
      (mod) => {
        const Panel = mod.AiTelemetryPanel;
        const c = document.createElement("div");
        const panel = new Panel(c, threeCars);

        // No DOM elements should be created
        expect(c.querySelector(".ait-container")).toBeNull();
        expect(c.children.length).toBe(0);

        panel.dispose();
        vi.unstubAllEnvs();
      }
    );
  });

  it("should not crash when refresh is called in DEV=false mode", () => {
    vi.stubEnv("DEV", false);
    vi.resetModules();
    return import("../../../src/core/dev-tools/ai-telemetry-panel").then(
      (mod) => {
        const Panel = mod.AiTelemetryPanel;
        const c = document.createElement("div");
        const panel = new Panel(c, threeCars);

        expect(() => panel.refresh()).not.toThrow();

        panel.dispose();
        vi.unstubAllEnvs();
      }
    );
  });
});
