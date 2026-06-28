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
   * Tear down the overlay, remove DOM elements, release references.
   */
  dispose(): void;
}
