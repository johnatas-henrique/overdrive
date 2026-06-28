/**
 * @fileoverview Keyboard keybinds for Dev Tools overlay.
 *
 * Registers a `keydown` listener on `document` that handles:
 * - **Toggle key** (default: backtick `` ` ``) — shows/hides overlay
 * - **Reload key** (default: `1`) — triggers `ConfigManager.reload()`
 * - **Minimise key** (default: `2`) — collapses overlay to compact mode
 *
 * Keybind values are read from `DEV_TOOLS_KEYS` config (see
 * `src/config/dev-tools-config.ts`).
 *
 * All Dev Tools keybind code is behind `import.meta.env.DEV` guard via
 * `initDevTools()` — zero bytes in production builds.
 *
 * ## Usage
 *
 * ```typescript
 * import { initKeybinds } from "@/core/dev-tools/keybinds";
 *
 * initKeybinds();
 * ```
 *
 * @see TR-DVT-007 — Dev-menu keybinds (configurable via devTools.keys.*)
 * @see ADR-0009 — Dev Tools Architecture
 * @see Control Manifest D5 — Toggle/reload keys polled via keyboard path
 */

import { DEV_TOOLS_KEYS } from "../../config/dev-tools-config";
import {
  type ConfigChange,
  getConfigManager,
} from "../../foundation/config/config-manager";
import { getDevTools } from "./index";

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

/** Whether the overlay is currently in minimised (compact) mode. */
let _minimised = false;

/**
 * Handle to the active keydown listener dispose function.
 * Non-null when keybinds are initialized.
 */
let _disposeKeybindListener: (() => void) | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize keyboard keybinds for the Dev Tools overlay.
 *
 * Registers a `keydown` event listener on `document`. Safe to call
 * multiple times — subsequent calls are no-ops.
 *
 * Cleans up any previously registered listener first, handling stale
 * listeners across module reloads (e.g. `vi.resetModules()` in tests).
 *
 * @returns A dispose function that removes the keydown listener
 */
export function initKeybinds(): () => void {
  // Remove any previously registered listener from prior module instances
  const prevCleanup = (globalThis as Record<string, unknown>)
    .__DEV_TOOLS_KEYBINDS_CLEANUP;
  if (typeof prevCleanup === "function") {
    (prevCleanup as () => void)();
  }

  if (_disposeKeybindListener) {
    return _disposeKeybindListener;
  }

  document.addEventListener("keydown", handleKeyDown);

  _disposeKeybindListener = () => {
    document.removeEventListener("keydown", handleKeyDown);
    _disposeKeybindListener = null;
    (globalThis as Record<string, unknown>).__DEV_TOOLS_KEYBINDS_CLEANUP =
      undefined;
  };

  // Persist cleanup across module resets so initKeybinds() in a fresh
  // module instance can remove stale listeners
  (globalThis as Record<string, unknown>).__DEV_TOOLS_KEYBINDS_CLEANUP =
    _disposeKeybindListener;

  return _disposeKeybindListener;
}

/**
 * Internal keydown handler function.
 *
 * Exported for direct testing (see AC-2b test cases).
 * Registered as a `keydown` listener by `initKeybinds()`.
 *
 * @param event - The native KeyboardEvent
 */
export function handleKeyDown(event: KeyboardEvent): void {
  const devTools = getDevTools();
  const key = event.key;

  // ── Consume toggle/reload keys when overlay is visible ──────────────
  if (devTools.isVisible()) {
    if (key === DEV_TOOLS_KEYS.toggle || key === DEV_TOOLS_KEYS.reload) {
      event.preventDefault();
    }
  }

  // ── Toggle key: always works regardless of visibility ───────────────
  if (key === DEV_TOOLS_KEYS.toggle) {
    devTools.toggle();
    return;
  }

  // ── Reload / minimise keys: only when overlay is visible ────────────
  if (!devTools.isVisible()) return;

  if (key === DEV_TOOLS_KEYS.reload) {
    _handleReload();
  } else if (key === DEV_TOOLS_KEYS.minimise) {
    _minimised = !_minimised;
    devTools.setMinimised(_minimised);
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Handle the reload key press: call ConfigManager.reload() and show a
 * notification in the overlay with the changed values.
 *
 * If ConfigManager is not initialized, the reload is silently skipped.
 */
function _handleReload(): void {
  let cm: ReturnType<typeof getConfigManager>;
  try {
    cm = getConfigManager();
  } catch {
    // ConfigManager not yet initialized — cannot reload
    return;
  }

  const changes: ConfigChange[] = cm.reload();
  const devTools = getDevTools();

  if (changes.length === 0) {
    devTools.showNotification("config reloaded — no changes");
    devTools.refreshConfigTree();
    return;
  }

  const parts = changes.map(
    (c) => `${c.key}: ${String(c.old)} → ${String(c.new)}`
  );
  devTools.showNotification(`config reloaded — ${parts.join("; ")}`);
  devTools.refreshConfigTree();
}
