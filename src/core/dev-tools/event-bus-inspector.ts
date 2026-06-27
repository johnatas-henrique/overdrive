/**
 * @fileoverview Event Bus Inspector — Event Log tab panel for Dev Tools.
 *
 * Captures all events via wildcard subscription, maintains a 100-entry ring
 * buffer, and renders the event history with filter support alongside a live
 * subscription list.
 *
 * Read-only enforcement: this module receives a read-only wrapper that only
 * exposes `on()`, `off()`, and `getSubscriptions()` — never `emit()`.
 *
 * ## Usage
 *
 * ```typescript
 * const panel = new EventBusInspector(containerDiv, readOnlyEventBus);
 * panel.refresh();
 * // ...later...
 * panel.dispose();
 * ```
 *
 * @see TR-DVT-002 — Event Bus inspector
 * @see ADR-0009 — Dev Tools Architecture
 * @see ADR-0001 — Event Bus Architecture
 * @see Control Manifest D6 — Read-only on all systems
 * @see Control Manifest D-F3 — Never emit events on the Event Bus
 */

import type { IEventBus, Subscription } from "../../foundation/event-bus";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Read-only subset of IEventBus that exposes only observation methods.
 *
 * Used by Dev Tools panels to enforce the "never emit" constraint
 * at the type level.
 */
export type IReadOnlyEventBus = Pick<
  IEventBus,
  "on" | "off" | "getSubscriptions"
>;

/**
 * A single captured event in the log buffer.
 */
export interface EventLogEntry {
  /** Event name (e.g. "gsm.state.entered") */
  name: string;
  /** Event payload */
  payload: unknown;
  /** Timestamp when the event was captured */
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of events kept in the ring buffer. */
const MAX_LOG_ENTRIES = 100;

// ---------------------------------------------------------------------------
// EventBusInspector
// ---------------------------------------------------------------------------

/**
 * Renders the Event Log tab panel — event history, subscription list,
 * and filter input — inside a given container element.
 *
 * Subscribes to all events on construction via a wildcard `"*"` handler.
 * The handler never calls `emit()` — read-only observation only.
 *
 * ## Layout
 *
 * ```
 * .tab-panel (container)
 * ├── .inspector-filter (filter input row)
 * ├── .inspector-subs-header ("Active Subscriptions")
 * ├── .inspector-subs-list (event → count list)
 * ├── .inspector-log-header ("Event History")
 * └── .inspector-log-list (scrollable event rows, newest first)
 * ```
 */
export class EventBusInspector {
  private _container: HTMLElement;
  private _eventBus: IReadOnlyEventBus;
  private _eventLog: EventLogEntry[] = [];
  private _filter = "";
  private _listEl!: HTMLElement;
  private _subsListEl!: HTMLElement;
  private _filterInput!: HTMLInputElement;
  private _subscription: Subscription | null = null;

  /**
   * @param container - The tab panel DOM element to render into
   * @param eventBus - Read-only Event Bus reference (no emit access)
   */
  constructor(container: HTMLElement, eventBus: IReadOnlyEventBus) {
    this._container = container;
    this._eventBus = eventBus;
    this._initDOM();
    this._startCapture();
  }

  /**
   * Re-render the event log and subscription list from current data.
   *
   * Safe to call when the panel is hidden — reads from buffer and
   * updates DOM regardless.
   */
  refresh(): void {
    if (!import.meta.env.DEV) return;
    this._renderEventLog();
    this._renderSubscriptionList();
  }

  /**
   * Tear down all subscriptions and release DOM.
   *
   * After dispose, the inspector cannot be reused — create a new instance.
   */
  dispose(): void {
    this._subscription?.unsubscribe();
    this._subscription = null;
    this._container.innerHTML = "";
    this._eventLog = [];
  }

  /** Expose the 100-entry ring buffer for testing. */
  getEventLog(): ReadonlyArray<EventLogEntry> {
    return [...this._eventLog];
  }

  // ---------------------------------------------------------------------------
  // Private: DOM setup
  // ---------------------------------------------------------------------------

  /** Create the filter input, subscription list, and event log DOM. */
  private _initDOM(): void {
    this._container.innerHTML = "";

    // Container fills available space
    this._container.style.cssText +=
      "display:flex;flex-direction:column;height:100%";

    // ── Filter input row ──
    const filterRow = document.createElement("div");
    filterRow.className = "inspector-filter";
    filterRow.style.cssText =
      "display:flex;gap:4px;padding:4px 8px;align-items:center;" +
      "background:#1a1a1a;border-bottom:1px solid #333";

    const filterLabel = document.createElement("span");
    filterLabel.textContent = "Filter:";
    filterLabel.style.cssText = "color:#888;font-size:11px;white-space:nowrap";
    filterRow.appendChild(filterLabel);

    this._filterInput = document.createElement("input");
    this._filterInput.type = "text";
    this._filterInput.placeholder = "event name...";
    this._filterInput.style.cssText =
      "flex:1;background:#0a0a0a;color:#e6db74;border:1px solid #333;" +
      "padding:2px 6px;font-family:'Courier New',monospace;font-size:11px;" +
      "outline:none";
    this._filterInput.addEventListener("input", () => {
      this._filter = this._filterInput.value.toLowerCase();
      this._renderEventLog();
    });
    filterRow.appendChild(this._filterInput);

    this._container.appendChild(filterRow);

    // ── Subscription list section ──
    const subsHeader = document.createElement("div");
    subsHeader.className = "inspector-subs-header";
    subsHeader.textContent = "Active Subscriptions";
    subsHeader.style.cssText =
      "color:#ffd700;font-size:11px;font-weight:bold;padding:4px 8px;" +
      "background:#1a1a1a;border-bottom:1px solid #333";
    this._container.appendChild(subsHeader);

    this._subsListEl = document.createElement("div");
    this._subsListEl.className = "inspector-subs-list";
    this._subsListEl.style.cssText =
      "padding:2px 8px;font-family:'Courier New',monospace;font-size:11px;" +
      "max-height:120px;overflow-y:auto;background:#0a0a0a;" +
      "border-bottom:1px solid #333";
    this._container.appendChild(this._subsListEl);

    // ── Event log section ──
    const logHeader = document.createElement("div");
    logHeader.className = "inspector-log-header";
    logHeader.textContent = "Event History";
    logHeader.style.cssText =
      "color:#ffd700;font-size:11px;font-weight:bold;padding:4px 8px;" +
      "background:#1a1a1a;border-bottom:1px solid #333";
    this._container.appendChild(logHeader);

    this._listEl = document.createElement("div");
    this._listEl.className = "inspector-log-list";
    this._listEl.style.cssText =
      "flex:1;overflow-y:auto;font-family:'Courier New',monospace;" +
      "font-size:11px;padding:2px 0";
    this._container.appendChild(this._listEl);
  }

  /** Subscribe to all events and capture them in the ring buffer. */
  private _startCapture(): void {
    if (!import.meta.env.DEV) return;

    this._subscription = this._eventBus.on("*", (detail) => {
      this._eventLog.push({
        name: detail.event,
        payload: detail.payload,
        timestamp: Date.now(),
      });

      // FIFO eviction: drop oldest when buffer exceeds max
      if (this._eventLog.length > MAX_LOG_ENTRIES) {
        this._eventLog.shift();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Private: rendering
  // ---------------------------------------------------------------------------

  /** Render the filtered event log (newest first). */
  private _renderEventLog(): void {
    let entries = this._eventLog;

    // Apply filter: case-insensitive substring match on event name
    if (this._filter) {
      entries = entries.filter((e) =>
        e.name.toLowerCase().includes(this._filter)
      );
    }

    // Newest first (reverse chronological)
    const reversed = [...entries].reverse();

    this._listEl.innerHTML = "";

    if (reversed.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.textContent = this._filter
        ? `No events matching "${this._filter}"`
        : "No events captured yet";
      emptyMsg.style.cssText = "color:#666;padding:8px";
      this._listEl.appendChild(emptyMsg);
      return;
    }

    for (const entry of reversed) {
      const row = document.createElement("div");
      row.style.cssText =
        "padding:1px 8px;display:flex;gap:8px;line-height:1.6";
      row.style.color = "#ccc";
      row.dataset.eventName = entry.name;

      // Timestamp (HH:MM:SS.mmm)
      const ts = document.createElement("span");
      ts.style.cssText = "color:#666;white-space:nowrap";
      ts.textContent = new Date(entry.timestamp).toISOString().slice(11, 23);
      row.appendChild(ts);

      // Event name
      const name = document.createElement("span");
      name.style.cssText = "color:#66d9ef;white-space:nowrap";
      name.textContent = entry.name;
      row.appendChild(name);

      // Payload preview (truncated JSON, 80 char max)
      const payload = document.createElement("span");
      payload.style.cssText =
        "color:#e6db74;overflow:hidden;text-overflow:ellipsis";
      try {
        payload.textContent =
          entry.payload !== undefined
            ? JSON.stringify(entry.payload, null, 0).slice(0, 80)
            : "";
      } catch {
        payload.textContent = "[unserializable]";
      }
      row.appendChild(payload);

      this._listEl.appendChild(row);
    }
  }

  /** Render the list of active subscriptions (event name → handler count). */
  private _renderSubscriptionList(): void {
    const subs = this._eventBus.getSubscriptions();

    this._subsListEl.innerHTML = "";

    if (subs.size === 0) {
      const emptyEl = document.createElement("div");
      emptyEl.textContent = "No active subscriptions";
      emptyEl.style.cssText = "color:#666;padding:2px 0";
      this._subsListEl.appendChild(emptyEl);
      return;
    }

    // Sort by event name for deterministic rendering
    const sorted = Array.from(subs.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );

    for (const [eventName, count] of sorted) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;line-height:1.6";

      const nameEl = document.createElement("span");
      nameEl.style.cssText = "color:#66d9ef";
      nameEl.textContent = eventName;
      row.appendChild(nameEl);

      const colonEl = document.createElement("span");
      colonEl.style.cssText = "color:#888";
      colonEl.textContent = ":";
      row.appendChild(colonEl);

      const countEl = document.createElement("span");
      countEl.style.cssText = "color:#e6db74";
      countEl.textContent = `${count}`;
      row.appendChild(countEl);

      this._subsListEl.appendChild(row);
    }
  }
}
