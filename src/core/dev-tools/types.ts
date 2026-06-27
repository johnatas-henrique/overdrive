/**
 * @fileoverview Public interface for the Dev Tools singleton.
 *
 * Consumed by Story 002 (keybinds) and Stories 004-008 (data panels).
 * All implementations are behind `import.meta.env.DEV` guard —
 * the interface itself is type-only (zero runtime cost).
 *
 * @see TR-DVT-001 — HTML overlay rendering above 3D viewport
 * @see TR-DVT-007 — Dev-tools keybinds (configurable via devTools.keys.*)
 * @see ADR-0009 — Dev Tools Architecture
 */

export interface IDevTools {
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
   * Tear down the overlay, remove DOM elements, release references.
   */
  dispose(): void;
}
