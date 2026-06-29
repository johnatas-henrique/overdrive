/**
 * @fileoverview AI Telemetry debug panel — AI Telemetry tab for Dev Tools.
 *
 * Displays per-car telemetry data: speed, position (lap + track progress),
 * and active AI behavior node. Data is read from a provided reader function
 * that wraps the physics/AI driver system calls.
 *
 * ## Sample rate
 * The panel maintains an internal tick counter. Data is re-read and the DOM
 * is re-rendered on the first `refresh()` call and then every Nth call
 * (default N=10). Between samples, the previously rendered data remains
 * visible — no stale reads.
 *
 * ## Read-only enforcement
 * This module only reads from the telemetry provider and never writes state,
 * never emits Event Bus events — Control Manifest D6 compliant.
 *
 * ## Usage
 *
 * ```typescript
 * const panel = new AiTelemetryPanel(containerDiv, () => getMockAiTelemetry());
 * panel.refresh();
 * // ...later...
 * panel.dispose();
 * ```
 *
 * @see TR-DVT-008 — AI Telemetry Tab
 * @see ADR-0009 — Dev Tools Architecture
 * @see Control Manifest D6 — Read-only on all systems
 */

import type { AiTelemetryCarData } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** CSS class prefix for AI telemetry panel elements. */
const CSS_PREFIX = "ait";

/**
 * Default sample rate: re-read telemetry data and re-render every N
 * `refresh()` calls. Configurable via constructor `sampleRate` parameter.
 */
const DEFAULT_SAMPLE_RATE = 10;

/**
 * The car ID reserved for the local player's vehicle (AC-23).
 * Used to apply the player row highlight class.
 */
const PLAYER_CAR_ID = "player-1";

// ---------------------------------------------------------------------------
// AiTelemetryPanel
// ---------------------------------------------------------------------------

/**
 * Renders the AI Telemetry debug panel — per-car speed, position,
 * and active behavior node in an HTML table.
 *
 * ## Layout
 *
 * ```
 * .tab-panel (container)
 * └── .ait-container
 *      ├── .ait-header ("AI Telemetry")
 *      └── .ait-table-wrap (scrollable)
 *           └── .ait-table
 *                ├── thead: Car ID | Speed | Position | Behavior
 *                └── tbody: per-car rows
 *                     ├── .ait-row-player (player car, yellow)
 *                     └── .ait-row-ai (AI cars, white)
 *      └── .ait-empty (when no AI cars registered)
 * ```
 */
export class AiTelemetryPanel {
  private _container: HTMLElement;
  private _getTelemetry: () => AiTelemetryCarData[];
  private _sampleRate: number;

  // DOM elements
  private _containerEl!: HTMLElement;
  private _tbodyEl!: HTMLTableSectionElement;
  private _emptyEl!: HTMLElement;

  // State
  private _tickCounter = 0;
  private _disposed = false;

  /**
   * @param container - The tab panel DOM element to render into
   * @param getTelemetry - Zero-arg function returning current AI telemetry data
   * @param sampleRate - Re-read telemetry every N `refresh()` calls (default: 10)
   */
  constructor(
    container: HTMLElement,
    getTelemetry: () => AiTelemetryCarData[],
    sampleRate = DEFAULT_SAMPLE_RATE
  ) {
    if (!import.meta.env.DEV) {
      // Assign refs so dispose() can be safely called in DEV=false mode
      this._container = container;
      this._getTelemetry = getTelemetry;
      this._sampleRate = Math.max(1, sampleRate);
      return;
    }

    this._container = container;
    this._getTelemetry = getTelemetry;
    this._sampleRate = Math.max(1, sampleRate);
    this._initDOM();
  }

  /**
   * Tick the panel — increments the internal tick counter and re-renders
   * if the sample rate threshold is reached.
   *
   * The constructor renders initial data immediately via `_initDOM()` →
   * `_render()`. The first `refresh()` call is skipped to avoid an
   * immediate duplicate render. Subsequent calls re-render every N calls
   * (sample rate), where N is configurable via the constructor.
   *
   * Safe to call when the panel is hidden. Safe to call after `dispose()`
   * (no-op).
   */
  refresh(): void {
    if (this._disposed) return;
    if (!this._containerEl) return; // DEV=false guard — no DOM to update

    this._tickCounter++;

    // Skip first refresh — constructor already rendered initial data
    if (this._tickCounter === 1) return;

    // Only re-render every Nth call (sample rate)
    if ((this._tickCounter - 1) % this._sampleRate !== 0) return;

    this._render();
  }

  /**
   * Tear down DOM and release references.
   *
   * After dispose, the panel cannot be reused — create a new instance.
   * Safe to call multiple times (subsequent calls are no-ops).
   */
  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this._container.innerHTML = "";
  }

  // -----------------------------------------------------------------------
  // Private: accessors for testing
  // -----------------------------------------------------------------------

  /** @internal — Exposed for test assertions */
  getTickCounter(): number {
    return this._tickCounter;
  }

  /** @internal — Exposed for test assertions */
  getSampleRate(): number {
    return this._sampleRate;
  }

  // -----------------------------------------------------------------------
  // Private: DOM setup
  // -----------------------------------------------------------------------

  /** Create the full panel DOM structure. */
  private _initDOM(): void {
    this._container.innerHTML = "";

    // ── Container ────────────────────────────────────────────────────
    this._containerEl = document.createElement("div");
    this._containerEl.className = `${CSS_PREFIX}-container`;
    this._container.appendChild(this._containerEl);

    // ── Header ───────────────────────────────────────────────────────
    const header = document.createElement("div");
    header.className = `${CSS_PREFIX}-header`;
    header.textContent = "AI Telemetry";
    this._containerEl.appendChild(header);

    // ── Table wrap (scrollable) ──────────────────────────────────────
    const tableWrap = document.createElement("div");
    tableWrap.className = `${CSS_PREFIX}-table-wrap`;

    const table = document.createElement("table");
    table.className = `${CSS_PREFIX}-table`;

    // Table head
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const columns = [
      "Car ID",
      "Speed (km/h)",
      "Position (Lap/Overall)",
      "Behavior",
    ];
    for (const col of columns) {
      const th = document.createElement("th");
      th.className = `${CSS_PREFIX}-th`;
      th.textContent = col;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Table body
    this._tbodyEl = document.createElement("tbody");
    table.appendChild(this._tbodyEl);

    tableWrap.appendChild(table);
    this._containerEl.appendChild(tableWrap);

    // ── Empty state ──────────────────────────────────────────────────
    this._emptyEl = document.createElement("div");
    this._emptyEl.className = `${CSS_PREFIX}-empty`;
    this._emptyEl.textContent = "No AI cars on track";
    this._containerEl.appendChild(this._emptyEl);

    // Initial render
    this._render();
  }

  // -----------------------------------------------------------------------
  // Private: rendering
  // -----------------------------------------------------------------------

  /** Re-read telemetry data and update the table DOM. */
  private _render(): void {
    let telemetry: AiTelemetryCarData[];

    try {
      telemetry = this._getTelemetry();
    } catch {
      telemetry = [];
    }

    // Toggle empty state
    const hasData = telemetry.length > 0;
    this._emptyEl.style.display = hasData ? "none" : "";
    this._tbodyEl.style.display = hasData ? "" : "none";

    if (!hasData) {
      return;
    }

    // Sort by overall position (leader first)
    // Perf note: this runs on every sample tick, sorting at most 3-25 items.
    // Acceptable for MVP — O(n log n) on a 25-element array is negligible
    // (< 0.01 ms even on low-end hardware). If the field grows beyond ~100
    // cars, switch to a sorted data structure.
    const sorted = [...telemetry].sort(
      (a, b) => a.position.overall - b.position.overall
    );

    // Rebuild table body
    this._tbodyEl.innerHTML = "";

    for (const car of sorted) {
      const row = document.createElement("tr");
      const isPlayer = car.carId === PLAYER_CAR_ID;
      row.className = isPlayer
        ? `${CSS_PREFIX}-row-player`
        : `${CSS_PREFIX}-row-ai`;
      row.dataset.carId = car.carId;

      // Car ID
      this._appendCell(row, car.carId);

      // Speed
      this._appendCell(row, `${car.speed}`);

      // Position: "L3 / 45% / #1"
      const lapStr = `L${car.position.lap}`;
      const progressStr = `${Math.round(car.position.trackProgress * 100)}%`;
      const overallStr = `#${car.position.overall}`;
      this._appendCell(row, `${lapStr} / ${progressStr} / ${overallStr}`);

      // Behavior
      this._appendCell(row, car.behavior);

      this._tbodyEl.appendChild(row);
    }
  }

  /** Create and append a table cell to a row. */
  private _appendCell(row: HTMLTableRowElement, text: string): void {
    const td = document.createElement("td");
    td.className = `${CSS_PREFIX}-td`;
    td.textContent = text;
    row.appendChild(td);
  }
}
