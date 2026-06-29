/**
 * @fileoverview Simulation Snapshot debug panel — Sim Snapshot tab for Dev Tools.
 *
 * Displays registered ISnapshotable systems with their per-system FNV-1a hashes,
 * hash diff between current and last taken snapshot (green ✓ / red ✗ / —), and
 * Take/Restore snapshot controls guarded by `import.meta.env.DEV`.
 *
 * Read-only enforcement: this module reads from SimulationSnapshot public API
 * (getRegisteredSystems, getHashes). The Take and Restore buttons call
 * takeSnapshot()/restoreSnapshot() through the public API as deliberate debug
 * actions — an exception to the read-only rule permitted by Control Manifest D6.
 *
 * ## Usage
 *
 * ```typescript
 * const panel = new SimSnapshotPanel(containerDiv, simulationSnapshot);
 * panel.refresh();
 * // With notification callback:
 * const panel2 = new SimSnapshotPanel(container, snapshot, (msg) => console.log(msg));
 * // ...later...
 * panel.dispose();
 * panel2.dispose();
 * ```
 *
 * @see TR-DVT-004 — Simulation Snapshot debug panel
 * @see ADR-0009 — Dev Tools Architecture
 * @see ADR-0017 — Simulation Snapshot
 * @see Control Manifest D6 — Read-only on all systems (with DEV-guarded exception)
 */

import type {
  FullGameSnapshot,
  ISnapshotable,
  SimulationSnapshot,
} from "../../foundation/simulation-snapshot";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** CSS class prefix for sim-snapshot panel elements. */
const CSS_PREFIX = "ssn";

// ---------------------------------------------------------------------------
// SimSnapshotPanel
// ---------------------------------------------------------------------------

/**
 * Renders the Simulation Snapshot debug panel — list of registered systems,
 * per-system FNV-1a hash, hash diff indicators, and Take/Restore controls.
 *
 * ## Layout
 *
 * ```
 * .tab-panel (container)
 * └── .ssn-container
 *      ├── .ssn-header ("Simulation Snapshot")
 *      ├── .ssn-systems-section
 *      │    ├── .ssn-systems-header ("Registered Systems")
 *      │    └── .ssn-systems-list (scrollable rows)
 *      │         └── .ssn-system-row (per system)
 *      │              ├── .ssn-system-id
 *      │              ├── .ssn-system-hash (hex)
 *      │              └── .ssn-system-diff (✓ / ✗ / —)
 *      ├── .ssn-controls (DEV-guarded)
 *      │    ├── .ssn-take-btn
 *      │    └── .ssn-restore-btn + result
 *      └── .ssn-empty (when no systems registered)
 * ```
 */
export class SimSnapshotPanel {
  private _container: HTMLElement;
  private _snapshot: SimulationSnapshot;
  private _showNotification?: (message: string) => void;

  // Last taken snapshot (stored for restore and hash diff)
  private _lastSnapshot: FullGameSnapshot | null = null;

  // Track last restore result for display
  private _lastRestoreResult: string | null = null;
  private _lastRestoreIsSuccess = false;

  // Cached DOM elements
  private _systemsListEl!: HTMLElement;
  private _takeBtn!: HTMLButtonElement | null;
  private _restoreBtn!: HTMLButtonElement | null;
  private _restoreResultEl!: HTMLElement | null;

  /**
   * @param container - The tab panel DOM element to render into
   * @param snapshot - The SimulationSnapshot orchestrator instance
   * @param showNotification - Optional callback to show a notification (e.g. "Snapshot taken at tick ...")
   */
  constructor(
    container: HTMLElement,
    snapshot: SimulationSnapshot,
    showNotification?: (message: string) => void
  ) {
    if (!import.meta.env.DEV) {
      // Still assign refs so dispose() can be safely called
      this._container = container;
      this._snapshot = snapshot;
      return;
    }

    this._container = container;
    this._snapshot = snapshot;
    this._showNotification = showNotification;
    this._initState();
    this._initDOM();
  }

  // -----------------------------------------------------------------------
  // Private: state initialization (AC-21)
  // -----------------------------------------------------------------------

  /** Initialize or reset all reactive panel state. */
  private _initState(): void {
    this._lastSnapshot = null;
    this._lastRestoreResult = null;
    this._lastRestoreIsSuccess = false;
  }

  /**
   * Re-render the registered systems list and diff indicators.
   *
   * Safe to call when the panel is hidden — reads from SimulationSnapshot
   * and updates DOM regardless.
   */
  refresh(): void {
    this._renderSystems();
  }

  /**
   * Tear down DOM and release references.
   *
   * After dispose, the panel cannot be reused — create a new instance.
   */
  dispose(): void {
    this._container.innerHTML = "";
    this._lastSnapshot = null;
    this._lastRestoreResult = null;
    this._takeBtn = null;
    this._restoreBtn = null;
    this._restoreResultEl = null;
  }

  /**
   * Expose the last stored snapshot for testing.
   *
   * @returns The last taken FullGameSnapshot, or `null` if none taken.
   */
  getLastSnapshot(): FullGameSnapshot | null {
    return this._lastSnapshot;
  }

  /** @internal — DEBUG ONLY: programmatic take snapshot (exposed for tests) */
  debugTakeSnapshot(): void {
    this._handleTake();
  }

  /** @internal — DEBUG ONLY: programmatic restore snapshot (exposed for tests) */
  debugRestoreSnapshot(): void {
    this._handleRestore();
  }

  // -----------------------------------------------------------------------
  // Private: DOM setup
  // -----------------------------------------------------------------------

  /** Create the full panel DOM structure. */
  private _initDOM(): void {
    this._container.innerHTML = "";

    // ── Container ────────────────────────────────────────────────────
    const container = document.createElement("div");
    container.className = `${CSS_PREFIX}-container`;
    this._container.appendChild(container);

    // ── Header ───────────────────────────────────────────────────────
    const header = document.createElement("div");
    header.className = `${CSS_PREFIX}-header`;
    header.textContent = "Simulation Snapshot";
    container.appendChild(header);

    // ── Registered systems section ───────────────────────────────────
    const systemsSection = document.createElement("div");
    systemsSection.className = `${CSS_PREFIX}-systems-section`;

    const systemsHeader = document.createElement("div");
    systemsHeader.className = `${CSS_PREFIX}-systems-header`;
    systemsHeader.textContent = "Registered Systems";
    systemsSection.appendChild(systemsHeader);

    // ── Controls section (DEV-guarded) ───────────────────────────────
    const controlsSection = document.createElement("div");
    controlsSection.className = `${CSS_PREFIX}-controls`;

    const controlsLabel = document.createElement("div");
    controlsLabel.className = `${CSS_PREFIX}-controls-label`;
    controlsLabel.textContent = "Snapshot Controls (DEV)";
    controlsSection.appendChild(controlsLabel);

    const controlsRow = document.createElement("div");
    controlsRow.className = `${CSS_PREFIX}-controls-row`;

    // Take Snapshot button
    this._takeBtn = document.createElement("button");
    this._takeBtn.className = `${CSS_PREFIX}-take-btn`;
    this._takeBtn.textContent = "Take Snapshot";
    this._takeBtn.addEventListener("click", () => this._handleTake());
    controlsRow.appendChild(this._takeBtn);

    // Restore Snapshot button
    this._restoreBtn = document.createElement("button");
    this._restoreBtn.className = `${CSS_PREFIX}-restore-btn`;
    this._restoreBtn.textContent = "Restore Snapshot";
    this._restoreBtn.disabled = true; // disabled until snapshot taken
    this._restoreBtn.addEventListener("click", () => this._handleRestore());
    controlsRow.appendChild(this._restoreBtn);

    controlsSection.appendChild(controlsRow);

    // Restore result display
    this._restoreResultEl = document.createElement("div");
    this._restoreResultEl.className = `${CSS_PREFIX}-restore-result`;
    controlsSection.appendChild(this._restoreResultEl);

    systemsSection.appendChild(controlsSection);

    this._systemsListEl = document.createElement("div");
    this._systemsListEl.className = `${CSS_PREFIX}-systems-list`;
    systemsSection.appendChild(this._systemsListEl);

    container.appendChild(systemsSection);

    // Initial render
    this._renderSystems();
  }

  // -----------------------------------------------------------------------
  // Private: event handlers
  // -----------------------------------------------------------------------

  /** Handle Take Snapshot button click. */
  private _handleTake(): void {
    try {
      const snap = this._snapshot.takeSnapshot({ force: true });
      if (snap) {
        this._lastSnapshot = snap;
        if (this._restoreBtn) {
          this._restoreBtn.disabled = false;
        }
        // Clear previous restore result
        this._lastRestoreResult = null;
        if (this._restoreResultEl) {
          this._restoreResultEl.textContent = "";
          this._restoreResultEl.className = `${CSS_PREFIX}-restore-result`;
        }
        this._showNotification?.(`Snapshot taken at tick ${snap.tick}`);
      }
    } catch (err) {
      console.warn(
        "[SimSnapshotPanel] Take snapshot failed:",
        err instanceof Error ? err.message : String(err)
      );
    }

    this._renderSystems();
  }

  /** Handle Restore Snapshot button click. */
  private _handleRestore(): void {
    if (!this._lastSnapshot || !this._restoreResultEl) return;

    try {
      const result = this._snapshot.restoreSnapshot(this._lastSnapshot);
      const succeededStr =
        result.succeeded.length > 0
          ? `Restored: ${result.succeeded.join(", ")}`
          : "No systems restored";
      const failedStr =
        result.failed.length > 0
          ? ` Failed: ${result.failed.map((f) => f.systemId).join(", ")}`
          : "";

      this._lastRestoreResult = `${succeededStr}${failedStr}`;
      this._lastRestoreIsSuccess = result.failed.length === 0;

      this._restoreResultEl.textContent = this._lastRestoreResult;
      this._restoreResultEl.className = `${CSS_PREFIX}-restore-result ${
        this._lastRestoreIsSuccess
          ? `${CSS_PREFIX}-restore-success`
          : `${CSS_PREFIX}-restore-fail`
      }`;
      this._showNotification?.(this._lastRestoreResult);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      this._lastRestoreResult = `Restore failed: ${msg}`;
      this._lastRestoreIsSuccess = false;
      this._restoreResultEl.textContent = this._lastRestoreResult;
      this._restoreResultEl.className = `${CSS_PREFIX}-restore-result ${CSS_PREFIX}-restore-fail`;
      console.warn("[SimSnapshotPanel] Restore snapshot failed:", msg);
    }

    this._renderSystems();
  }

  // -----------------------------------------------------------------------
  // Private: rendering
  // -----------------------------------------------------------------------

  /** Re-render the registered systems list with hashes and diff. */
  private _renderSystems(): void {
    // Guard: DEV=false mode — no DOM to render
    if (!this._systemsListEl) return;

    // Read current systems and hashes from SimulationSnapshot
    let systems: ReadonlyArray<ISnapshotable>;
    let currentHashes: Map<string, string> | null = null;

    try {
      systems = this._snapshot.getRegisteredSystems();
      currentHashes = this._snapshot.getHashes();
    } catch {
      // Snapshot not initialized — display error state
      this._systemsListEl.innerHTML = "";
      const errEl = document.createElement("div");
      errEl.className = `${CSS_PREFIX}-empty`;
      errEl.textContent = "SimulationSnapshot not initialized";
      this._systemsListEl.appendChild(errEl);
      return;
    }

    this._systemsListEl.innerHTML = "";

    if (systems.length === 0) {
      const emptyEl = document.createElement("div");
      emptyEl.className = `${CSS_PREFIX}-empty`;
      emptyEl.textContent = "No systems registered";
      this._systemsListEl.appendChild(emptyEl);
      return;
    }

    // Build map of snapshot hashes (keyed by systemId) for diff
    const snapshotHashes = new Map<string, string>();
    if (this._lastSnapshot) {
      for (const [sysId, data] of Object.entries(this._lastSnapshot.systems)) {
        snapshotHashes.set(sysId, data.hash);
      }
    }

    const hasSnapshotBaseline = this._lastSnapshot !== null;

    for (const system of systems) {
      const row = document.createElement("div");
      row.className = `${CSS_PREFIX}-system-row`;

      // System ID
      const idEl = document.createElement("span");
      idEl.className = `${CSS_PREFIX}-system-id`;
      idEl.textContent = system.systemId;
      row.appendChild(idEl);

      // Current hash (from getHashes)
      const hashEl = document.createElement("span");
      hashEl.className = `${CSS_PREFIX}-system-hash`;
      const currentHash = currentHashes.get(system.systemId);
      hashEl.textContent = currentHash ?? "error";
      hashEl.title = `FNV-1a: ${currentHash ?? "error"}`;
      row.appendChild(hashEl);

      // Diff indicator
      const diffEl = document.createElement("span");
      diffEl.className = `${CSS_PREFIX}-system-diff`;

      if (!hasSnapshotBaseline) {
        // No snapshot taken yet — no baseline for diff
        diffEl.textContent = "\u2014"; // em dash
        diffEl.classList.add("ssn-diff-none");
      } else {
        const baselineHash = snapshotHashes.get(system.systemId);
        if (baselineHash === undefined) {
          // System wasn't in the last snapshot
          diffEl.textContent = "\u2014"; // em dash
          diffEl.classList.add("ssn-diff-none");
        } else if (currentHash === baselineHash) {
          diffEl.textContent = "\u2713"; // check mark
          diffEl.classList.add("ssn-diff-match");
        } else {
          diffEl.textContent = "\u2717"; // cross mark
          diffEl.classList.add("ssn-diff-change");
        }
      }

      row.appendChild(diffEl);

      this._systemsListEl.appendChild(row);
    }
  }
}
