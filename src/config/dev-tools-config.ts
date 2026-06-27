/**
 * @fileoverview Dev Tools keybind configuration.
 *
 * Centralised key definitions for Dev Tools overlay controls.
 * All key references throughout the codebase should read from this config
 * rather than hardcoding key strings — changing a keybind requires editing
 * this file only.
 *
 * @see ADR-0009 — Dev Tools Architecture
 * @see TR-DVT-007 — Dev-menu keybinds
 */

/** Key codes for Dev Tools overlay controls. */
export interface DevToolsKeys {
  /** Toggle overlay visibility (default: backtick `) */
  toggle: string;
  /** Force-reload config (default: 1) */
  reload: string;
  /** Toggle minimised overlay (default: 2) */
  minimise: string;
}

/**
 * Default Dev Tools keybinds.
 *
 * Chosen to avoid conflicts with browser shortcuts:
 * - Backtick/1/2 are standard debug console keys (Source engine pattern)
 */
export const DEV_TOOLS_KEYS: DevToolsKeys = {
  toggle: "`",
  reload: "1",
  minimise: "2",
};
