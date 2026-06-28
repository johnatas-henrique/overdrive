/**
 * @fileoverview GSM State Visualizer — GSM History tab panel for Dev Tools.
 *
 * Displays the current state, the last 20 state transitions with timestamps
 * and duration in previous state, and manual transition buttons for debugging.
 *
 * Read-only enforcement: this module subscribes to Event Bus events
 * (never emits). Manual transition calls to `gsm.transition()` are explicitly
 * permitted as DEV-guarded debug actions (Control Manifest D6 exception).
 *
 * ## Usage
 *
 * ```typescript
 * const panel = new GsmVisualizer(containerDiv, readOnlyEventBus, gsm);
 * panel.refresh();
 * // ...later...
 * panel.dispose();
 * ```
 *
 * @see TR-DVT-005 — GSM state visualiser
 * @see ADR-0009 — Dev Tools Architecture
 * @see ADR-0024 — Game State Machine
 * @see Control Manifest D6 — Read-only on all systems (with DEV-guarded exception)
 */

import type { Subscription } from "../../foundation/event-bus";
import type { GameStateMachine } from "../../foundation/gsm/GameStateMachine";
import { TRANSITIONS } from "../../foundation/gsm/TransitionTable";
import type { State } from "../../foundation/gsm/types";

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
  import("../../foundation/event-bus").IEventBus,
  "on" | "off" | "getSubscriptions"
>;

/**
 * A single recorded transition for display in the GSM History tab.
 */
export interface GsmTransitionEntry {
  /** Source state */
  readonly from: State | "[initial]";
  /** Target state */
  readonly to: State;
  /** Date.now() when the transition completed */
  readonly timestamp: number;
  /** Milliseconds spent in source state before this transition */
  readonly durationInPreviousState: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max history entries in the ring buffer (matching GSM's TR-GSM-005). */
const MAX_HISTORY = 20;

// ---------------------------------------------------------------------------
// GsmVisualizer
// ---------------------------------------------------------------------------

/**
 * Renders the GSM History tab panel — current state indicator, transition
 * history timeline, and manual transition buttons — inside a given container.
 *
 * Subscribes to `gsm.state.exited` and `gsm.state.entered` on the Event Bus
 * to capture transitions. Seeds the display from the GSM's internal history.
 *
 * ## Layout
 *
 * ```
 * .tab-panel (container)
 * ├── .gsm-current-state (highlighted badge)
 * ├── .gsm-transition-section (DEV-guarded manual transition buttons)
 * │    ├── .gsm-transition-label
 * │    └── .gsm-transition-buttons
 * │         └── button.gsm-transition-btn (per target state)
 * ├── .gsm-history-header ("Transition History")
 * └── .gsm-history-list (scrollable transition rows, newest first)
 *      └── .gsm-history-row
 *           ├── .gsm-history-ts
 *           ├── .gsm-history-from
 *           ├── .gsm-history-arrow (" → ")
 *           ├── .gsm-history-to
 *           └── .gsm-history-duration
 * ```
 */
export class GsmVisualizer {
  private _container: HTMLElement;
  private _eventBus: IReadOnlyEventBus;
  private _gsm: GameStateMachine;
  private _history: GsmTransitionEntry[] = [];
  private _currentState: State | null = null;
  private _stateEntryTime: number = 0;
  private _pendingExit: { from: State; timestamp: number } | null = null;
  private _subscriptions: Subscription[] = [];

  // Cached DOM elements
  private _currentStateLabelEl!: HTMLElement;
  private _historyListEl!: HTMLElement;
  private _transitionButtonsEl!: HTMLElement;

  /**
   * @param container - The tab panel DOM element to render into
   * @param eventBus - Read-only Event Bus reference (no emit access)
   * @param gsm - The Game State Machine instance (for getHistory and transition)
   */
  constructor(
    container: HTMLElement,
    eventBus: IReadOnlyEventBus,
    gsm: GameStateMachine
  ) {
    if (!import.meta.env.DEV) {
      // Still assign refs so dispose() can be safely called
      this._container = container;
      this._eventBus = eventBus;
      this._gsm = gsm;
      return;
    }

    this._container = container;
    this._eventBus = eventBus;
    this._gsm = gsm;

    // Seed history and current state from GSM's internal ring buffer
    this._seedFromGsmHistory();

    this._initDOM();
    this._startCapture();
  }

  /**
   * Re-render the current state badge, history list, and transition buttons.
   *
   * Safe to call when the panel is hidden — reads from buffer and
   * updates DOM regardless.
   */
  refresh(): void {
    this._renderAll();
  }

  /**
   * Tear down all subscriptions and release DOM.
   *
   * After dispose, the visualizer cannot be reused — create a new instance.
   */
  dispose(): void {
    for (const sub of this._subscriptions) {
      sub.unsubscribe();
    }
    this._subscriptions = [];
    this._container.innerHTML = "";
    this._history = [];
    this._currentState = null;
    this._pendingExit = null;
  }

  /**
   * Expose the transition history for testing.
   *
   * @returns A shallow copy of the internal history buffer
   */
  getHistory(): ReadonlyArray<GsmTransitionEntry> {
    return [...this._history];
  }

  /**
   * Expose the current tracked state for testing.
   *
   * @returns The current state, or `null` if no state has been entered yet
   */
  getCurrentState(): State | null {
    return this._currentState;
  }

  // -----------------------------------------------------------------------
  // Private: initialization
  // -----------------------------------------------------------------------

  /**
   * Seed the visualizer's history buffer from the GSM's internal ring buffer.
   *
   * Called once on construction. Derives initial current state from the
   * last history entry's `to` field, if any.
   * Caps entries at MAX_HISTORY to match the ring buffer contract.
   */
  private _seedFromGsmHistory(): void {
    const gsmHistory = this._gsm.getHistory();

    // Apply ring buffer cap — keep only the last MAX_HISTORY entries
    const sliceStart =
      gsmHistory.length > MAX_HISTORY ? gsmHistory.length - MAX_HISTORY : 0;
    const sliced = gsmHistory.slice(sliceStart);

    for (const entry of sliced) {
      this._history.push({
        from: entry.from,
        to: entry.to,
        timestamp: entry.timestamp,
        durationInPreviousState: entry.durationInPreviousState,
      });
    }

    // Derive current state from last history entry (if any)
    if (gsmHistory.length > 0) {
      this._currentState = gsmHistory[gsmHistory.length - 1].to;
    }
  }

  // -----------------------------------------------------------------------
  // Private: DOM setup
  // -----------------------------------------------------------------------

  /** Create the current state badge, transition buttons, and history list DOM. */
  private _initDOM(): void {
    this._container.innerHTML = "";

    // Container fills available space
    this._container.classList.add("gsm-container");

    // ── Current state header ──────────────────────────────────────────
    const stateHeader = document.createElement("div");
    stateHeader.className = "gsm-current-state-header";

    const stateLabel = document.createElement("span");
    stateLabel.className = "gsm-current-state-label";
    stateLabel.textContent = "Current State:";
    stateHeader.appendChild(stateLabel);

    this._currentStateLabelEl = document.createElement("span");
    this._currentStateLabelEl.className = "gsm-current-state-value";
    stateHeader.appendChild(this._currentStateLabelEl);

    this._container.appendChild(stateHeader);

    // ── Current state indicator container (for CSS targeting) ─────────
    // The header above doubles as the indicator. No extra element needed.

    // ── Transition buttons section ─────────────────────────────────────
    const buttonsSection = document.createElement("div");
    buttonsSection.className = "gsm-transition-section";

    const buttonsLabel = document.createElement("div");
    buttonsLabel.className = "gsm-transition-label";
    buttonsLabel.textContent = "Manual Transitions (DEV)";
    buttonsSection.appendChild(buttonsLabel);

    this._transitionButtonsEl = document.createElement("div");
    this._transitionButtonsEl.className = "gsm-transition-buttons";
    buttonsSection.appendChild(this._transitionButtonsEl);

    this._container.appendChild(buttonsSection);

    // ── History list section ──────────────────────────────────────────
    const historyHeader = document.createElement("div");
    historyHeader.className = "gsm-history-header";
    historyHeader.textContent = "Transition History";
    this._container.appendChild(historyHeader);

    this._historyListEl = document.createElement("div");
    this._historyListEl.className = "gsm-history-list";
    this._container.appendChild(this._historyListEl);

    // Initial render
    this._renderAll();
  }

  /** Subscribe to GSM events on the Event Bus. */
  private _startCapture(): void {
    // Track exit timestamp for duration computation
    const exitSub = this._eventBus.on(
      "gsm.state.exited",
      (payload: { from: string }) => {
        this._pendingExit = {
          from: payload.from as State,
          timestamp: Date.now(),
        };
      }
    );

    // Record transition on entered
    const enterSub = this._eventBus.on(
      "gsm.state.entered",
      (payload: { from: string; to: string }) => {
        const to = payload.to as State;
        const from = payload.from as State;
        this._currentState = to;

        const now = Date.now();
        // Compute actual time-in-state using the entry timestamp
        // rather than _pendingExit (which is set synchronously within
        // the same transition call, yielding ~0ms):
        const duration =
          this._stateEntryTime > 0
            ? now - this._stateEntryTime
            : this._pendingExit
              ? now - this._pendingExit.timestamp
              : 0;
        this._pendingExit = null;
        this._stateEntryTime = now;

        this._recordTransition({
          from,
          to,
          timestamp: now,
          durationInPreviousState: duration,
        });

        // Re-render when state changes occur
        this._renderAll();
      }
    );

    this._subscriptions.push(exitSub, enterSub);
  }

  // -----------------------------------------------------------------------
  // Private: ring buffer management
  // -----------------------------------------------------------------------

  /**
   * Add a transition entry to the history ring buffer.
   * Evicts oldest entry when buffer exceeds MAX_HISTORY (FIFO eviction).
   */
  private _recordTransition(entry: GsmTransitionEntry): void {
    this._history.push(entry);
    if (this._history.length > MAX_HISTORY) {
      this._history.shift();
    }
  }

  // -----------------------------------------------------------------------
  // Private: rendering
  // -----------------------------------------------------------------------

  /** Re-render all sections of the panel. */
  private _renderAll(): void {
    this._renderCurrentState();
    this._renderHistoryList();
    this._renderTransitionButtons();
  }

  /** Update the current state badge. */
  private _renderCurrentState(): void {
    if (!this._currentStateLabelEl) return;
    if (this._currentState) {
      this._currentStateLabelEl.textContent = this._currentState;
      this._currentStateLabelEl.className =
        "gsm-current-state-value gsm-state-highlight";
    } else {
      this._currentStateLabelEl.textContent = "(none)";
      this._currentStateLabelEl.className = "gsm-current-state-value";
    }
  }

  /** Render the transition history (newest first). */
  private _renderHistoryList(): void {
    if (!this._historyListEl) return;
    this._historyListEl.innerHTML = "";

    if (this._history.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "gsm-empty";
      emptyMsg.textContent = "No transitions recorded yet";
      this._historyListEl.appendChild(emptyMsg);
      return;
    }

    // Newest first (reverse chronological)
    const reversed = [...this._history].reverse();

    for (const entry of reversed) {
      const row = document.createElement("div");
      row.className = "gsm-history-row";
      row.dataset.fromState = entry.from;
      row.dataset.toState = entry.to;

      // Timestamp (HH:MM:SS.mmm)
      const ts = document.createElement("span");
      ts.className = "gsm-history-ts";
      ts.textContent = new Date(entry.timestamp).toISOString().slice(11, 23);
      row.appendChild(ts);

      // Transition arrow: from → to
      const fromEl = document.createElement("span");
      fromEl.className = "gsm-history-from";
      fromEl.textContent = entry.from;
      row.appendChild(fromEl);

      const arrow = document.createElement("span");
      arrow.className = "gsm-history-arrow";
      arrow.textContent = " → ";
      row.appendChild(arrow);

      const toEl = document.createElement("span");
      toEl.className = "gsm-history-to";
      toEl.textContent = entry.to;
      row.appendChild(toEl);

      // Duration in previous state
      const dur = document.createElement("span");
      dur.className = "gsm-history-duration";
      dur.textContent = `${entry.durationInPreviousState}ms`;
      row.appendChild(dur);

      this._historyListEl.appendChild(row);
    }
  }

  /** Render manual transition buttons (DEV-guarded). */
  private _renderTransitionButtons(): void {
    if (!this._transitionButtonsEl) return;
    if (!this._currentState) {
      this._transitionButtonsEl.innerHTML = "";
      return;
    }

    this._transitionButtonsEl.innerHTML = "";

    const targets = TRANSITIONS[this._currentState];
    if (!targets || targets.length === 0) {
      const noOps = document.createElement("span");
      noOps.className = "gsm-transition-none";
      noOps.textContent = "No valid transitions from current state";
      this._transitionButtonsEl.appendChild(noOps);
      return;
    }

    for (const target of targets) {
      const btn = document.createElement("button");
      btn.className = "gsm-transition-btn";
      btn.textContent = `→ ${target}`;
      btn.dataset.targetState = target;

      btn.addEventListener("click", () => {
        if (confirm(`Transition to "${target}"?`)) {
          // Deliberate developer action — exception to read-only rule
          // (Control Manifest D6: "Manual transition buttons under
          //  import.meta.env.DEV guard are permitted")
          this._gsm.transition(target).catch((err: unknown) => {
            console.warn("[GsmVisualizer] Transition failed:", err);
          });
        }
      });

      this._transitionButtonsEl.appendChild(btn);
    }
  }
}
