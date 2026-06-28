/**
 * @fileoverview Public interface for the Dev Tools singleton.
 *
 * Consumed by Story 002 (keybinds) and Stories 004-008 (data panels).
 * All implementations are behind `import.meta.env.DEV` guard —
 * the interface itself is type-only (zero runtime cost).
 *
 * @see TR-DVT-001 — HTML overlay rendering above 3D viewport
 * @see TR-DVT-002 — Event Bus inspector
 * @see TR-DVT-007 — Dev-tools keybinds (configurable via devTools.keys.*)
 * @see ADR-0009 — Dev Tools Architecture
 */

import type { IEventBus } from "../../foundation/event-bus";
import type { GameStateMachine } from "../../foundation/gsm/GameStateMachine";
import type { SimulationSnapshot } from "../../foundation/simulation-snapshot";

export interface IDevTools {
  /**
   * Inject the Event Bus for the Event Log tab panel.
   *
   * Must be called after `initDevTools()`. If the overlay is already
   * initialized, the Event Log tab is created immediately; otherwise
   * creation is deferred until the first `toggle()`.
   *
   * Internally wraps the bus in a read-only proxy that only exposes
   * `on()`, `off()`, and `getSubscriptions()` — never `emit()`.
   *
   * @param eventBus — The game's Event Bus instance
   * @see TR-DVT-002 — Event Bus inspector
   * @see Control Manifest D-F3 — Never emit events on the Event Bus
   */
  setEventBus(eventBus: IEventBus): void;

  /**
   * Inject the Game State Machine for the GSM History tab panel.
   *
   * Must be called after `initDevTools()`. If the overlay is already
   * initialized, the GSM History tab is created immediately; otherwise
   * creation is deferred until the first `toggle()`.
   *
   * Provides the GSM reference for reading history and for manual
   * transition buttons (DEV-guarded, Control Manifest D6 exception).
   *
   * @param gsm — The game's GameStateMachine instance
   * @see TR-DVT-005 — GSM state visualiser
   * @see ADR-0024 — Game State Machine
   */
  setGsm(gsm: GameStateMachine): void;

  /**
   * Inject the SimulationSnapshot orchestrator for the Sim Snapshot tab panel.
   *
   * Must be called after `initDevTools()`. If the overlay is already
   * initialized, the Sim Snapshot tab is created immediately; otherwise
   * creation is deferred until the first `toggle()`.
   *
   * Provides read access to registered ISnapshotable systems and their
   * hashes. Take/Restore controls call takeSnapshot()/restoreSnapshot()
   * as deliberate debug actions (Control Manifest D6 exception).
   *
   * @param snapshot — The SimulationSnapshot orchestrator instance
   * @see TR-DVT-004 — Simulation Snapshot debug panel
   * @see ADR-0017 — Simulation Snapshot
   */
  setSimulationSnapshot(snapshot: SimulationSnapshot): void;

  /**
   * Register a data source that provides renderable key/value pairs.
   * Called by game systems (physics, config, AI, etc.) to expose debug state.
   *
   * @param name — Unique data source name (e.g. "physics", "config", "ai")
   * @param reader — Zero-arg function returning a flat key/value map
   */
  registerDataSource(name: string, reader: () => Record<string, unknown>): void;

  /**
   * Toggle overlay visibility.
   * On first call, lazily creates the overlay DOM.
   */
  toggle(): void;

  /**
   * Whether the overlay is currently visible.
   */
  isVisible(): boolean;

  /**
   * Collapse/expand the overlay to a minimal state.
   * @param val — `true` to minimise, `false` to restore full overlay
   */
  setMinimised(val: boolean): void;

  /**
   * Refresh displayed metrics and data panels.
   * Called each tick by the pipeline and by `engine.onEndFrameObservable`.
   */
  update(): void;

  /**
   * Show a temporary notification message in the overlay.
   * Auto-dismisses after 2 seconds.
   *
   * @param message - The message text to display
   */
  showNotification(message: string): void;

  /**
   * Rebuild the config tree panel DOM.
   * Called when overlay becomes visible and on reload key press.
   */
  refreshConfigTree(): void;

  /**
   * Inject the AI telemetry reader for the AI Telemetry tab panel.
   *
   * Must be called after `initDevTools()`. If the overlay is already
   * initialized, the AI Telemetry tab is created immediately; otherwise
   * creation is deferred until the first `toggle()`.
   *
   * The reader function is called on each sample tick (every 10 refresh
   * calls by default) to fetch current telemetry data from the physics
   * and AI driver systems.
   *
   * @param getTelemetry — Zero-arg function returning current telemetry data
   * @see TR-DVT-008 — AI Telemetry Tab
   * @see Control Manifest D6 — Read-only on all systems
   */
  setAiTelemetry(getTelemetry: () => AiTelemetryCarData[]): void;

  /**
   * Tear down the overlay, remove DOM elements, release references.
   */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// AI Telemetry data types
// ---------------------------------------------------------------------------

/**
 * Per-car telemetry data for the AI Telemetry debug panel.
 *
 * This type describes the structured data consumed by the AiTelemetryPanel
 * for rendering the AI Telemetry tab in Dev Tools.
 *
 * @see TR-DVT-008 — AI Telemetry Tab
 */
export interface AiTelemetryCarData {
  /** Unique car identifier (e.g. "player-1", "ai-1") */
  carId: string;
  /** Current speed in km/h */
  speed: number;
  /** Race position details */
  position: {
    /** Current lap number (1-based) */
    lap: number;
    /** Progress within the current lap as a 0–1 fraction */
    trackProgress: number;
    /** Overall race position (1-based, 1 = leader) */
    overall: number;
  };
  /**
   * Active AI behavior state.
   * The AI Driver module will define the canonical union type.
   * Using `string` here avoids coupling to mock-only types that
   * will need expansion in production.
   */
  behavior: string;
}
