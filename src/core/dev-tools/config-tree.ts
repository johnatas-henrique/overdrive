/**
 * @fileoverview Config Tree Panel — renders a tree view of all ConfigManager
 * namespaces inside the Dev Tools sidebar with in-place editing support.
 *
 * @see TR-DVT-003 — Config namespace inspector
 * @see ADR-0009 — Dev Tools Architecture
 * @see Control Manifest D6, D-F2 — Read-only on all systems, with explicit
 *      exception for config in-place edits via ConfigManager.setRuntime()
 *      under `import.meta.env.DEV` guard.
 */

import type {
  ConfigManager,
  DebugState,
} from "../../foundation/config/config-manager";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max number of flat key entries to show per namespace. */
const MAX_KEYS_PER_NAMESPACE = 200;

/** Debounce delay for in-place edit save (AC-24). */
const EDIT_DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// ConfigTreePanel
// ---------------------------------------------------------------------------

/**
 * Renders a tree view of ConfigManager namespaces inside a container element.
 *
 * Each namespace becomes a `<details>` element. Each key-value pair is a
 * `<li>` with a `<code>` key name and a clickable value `<span>`.
 * Collapsed `<details>` elements render zero child DOM nodes (native browser
 * behavior) — this is the performance mechanism for 100+ keys.
 *
 * ## In-place editing
 *
 * Double-click a value → `<input>` replaces `<span>` → Enter confirms via
 * `ConfigManager.setRuntime()` → flash background update.
 * Escape cancels. All guarded by `import.meta.env.DEV`.
 *
 * ## `undefined` rendering
 *
 * `value === undefined ? "\u2014" : String(value)` — em dash, not the
 * literal word "undefined".
 *
 * ## Usage
 *
 * ```typescript
 * const panel = new ConfigTreePanel(sidebarEl, getConfigManager, showNotification);
 * panel.refresh();
 * ```
 */
export class ConfigTreePanel {
  private _container: HTMLElement;
  private _getConfigManager: () => ConfigManager;
  private _showNotification?: (message: string) => void;
  private _editingKey: string | null = null;

  /**
   * @param container - The sidebar DOM element to render into
   * @param getConfigManager - Callback that returns the ConfigManager singleton
   * @param showNotification - Optional callback to show a notification (e.g. "key: old → new")
   */
  constructor(
    container: HTMLElement,
    getConfigManager: () => ConfigManager,
    showNotification?: (message: string) => void
  ) {
    this._container = container;
    this._getConfigManager = getConfigManager;
    this._showNotification = showNotification;
  }

  /**
   * Re-render the config tree from the current ConfigManager debug state.
   *
   * Collapsed `<details>` elements retain their expanded/collapsed state
   * across refreshes via the `open` attribute.
   */
  refresh(): void {
    if (!import.meta.env.DEV) return;

    let cm: ConfigManager;
    try {
      cm = this._getConfigManager();
    } catch {
      this._container.innerHTML = "";
      const errEl = document.createElement("div");
      errEl.className = "config-empty";
      errEl.textContent = "ConfigManager not initialized";
      this._container.appendChild(errEl);
      return;
    }

    const state = cm.getDebugState();
    this._renderTree(state);
  }

  // -------------------------------------------------------------------------
  // Private: rendering
  // -------------------------------------------------------------------------

  /**
   * Save which namespaces are currently expanded, rebuild DOM, restore state.
   */
  private _renderTree(state: DebugState): void {
    this._editingKey = null;
    const expanded = this._captureExpandedState();

    this._container.innerHTML = "";

    const namespaceNames = Object.keys(state.namespaces);
    if (namespaceNames.length === 0) {
      const emptyEl = document.createElement("div");
      emptyEl.className = "config-empty";
      emptyEl.textContent = "No config namespaces";
      this._container.appendChild(emptyEl);
      return;
    }

    for (const ns of namespaceNames) {
      const details = document.createElement("details");
      details.className = "config-namespace";
      details.dataset.ns = ns;
      if (expanded.has(ns)) {
        details.open = true;
      }

      const summary = document.createElement("summary");
      summary.textContent = ns;
      details.appendChild(summary);

      const nsData = state.namespaces[ns] as Record<string, unknown>;
      const flatKeys = this._flattenNamespace(ns, nsData);

      const ul = document.createElement("ul");
      ul.className = "config-ns-list";

      const keyCount = flatKeys.length;
      const displayKeys =
        keyCount > MAX_KEYS_PER_NAMESPACE
          ? flatKeys.slice(0, MAX_KEYS_PER_NAMESPACE)
          : flatKeys;

      for (const entry of displayKeys) {
        const li = document.createElement("li");
        li.className = "config-entry";

        const keyCode = document.createElement("code");
        keyCode.className = "config-key";
        keyCode.textContent = entry.dotPath;

        const valueSpan = document.createElement("span");
        valueSpan.className = "config-value";
        valueSpan.textContent = entry.displayValue;
        valueSpan.dataset.configKey = entry.dotPath;

        // Double-click to edit (DEV guard inside _startEdit)
        valueSpan.addEventListener("dblclick", (e) => {
          e.stopPropagation();
          this._startEdit(entry.dotPath, valueSpan);
        });

        li.appendChild(keyCode);
        li.appendChild(document.createTextNode(": "));
        li.appendChild(valueSpan);
        ul.appendChild(li);
      }

      if (keyCount > MAX_KEYS_PER_NAMESPACE) {
        const moreLi = document.createElement("li");
        moreLi.className = "config-more";
        moreLi.textContent = `… and ${keyCount - MAX_KEYS_PER_NAMESPACE} more keys`;
        ul.appendChild(moreLi);
      }

      details.appendChild(ul);
      this._container.appendChild(details);
    }
  }

  /**
   * Read which namespaces are currently expanded so we can preserve state
   * across re-renders.
   */
  private _captureExpandedState(): Set<string> {
    const expanded = new Set<string>();
    for (const child of this._container.children) {
      if (child instanceof HTMLDetailsElement && child.open) {
        expanded.add(child.dataset.ns as string);
      }
    }
    return expanded;
  }

  /**
   * Flatten a namespace's nested object into dot-path key → display value
   * entries. Unlike ConfigManager's internal `_flattenObject`, this method is
   * used solely for rendering and is exported as part of the public interface
   * for the tree panel.
   */
  private _flattenNamespace(
    prefix: string,
    obj: Record<string, unknown>
  ): Array<{ dotPath: string; displayValue: string }> {
    const result: Array<{ dotPath: string; displayValue: string }> = [];

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = `${prefix}.${key}`;
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        result.push(
          ...this._flattenNamespace(fullKey, value as Record<string, unknown>)
        );
      } else {
        result.push({
          dotPath: fullKey,
          displayValue: value === undefined ? "\u2014" : String(value),
        });
      }
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Private: in-place editing
  // -------------------------------------------------------------------------

  /**
   * Begin in-place editing of a config value.
   *
   * Replaces the value `<span>` with an `<input>` element. Enter confirms
   * via `ConfigManager.setRuntime()`. Escape cancels. Blur (focus loss)
   * behaves as cancel unless already confirmed by Enter.
   *
   * Guarded by `import.meta.env.DEV` — in production this entire code path
   * is unreachable since the ConfigTreePanel is never instantiated.
   */
  private _startEdit(key: string, valueSpan: HTMLSpanElement): void {
    if (!import.meta.env.DEV) return;
    if (this._editingKey) return; // Already editing another key

    this._editingKey = key;
    const currentText = valueSpan.textContent as string;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "config-input";
    input.value = currentText === "\u2014" ? "" : currentText;

    valueSpan.replaceWith(input);
    input.focus();
    input.select();

    input.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this._finishEdit(input, key, currentText, true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        this._finishEdit(input, key, currentText, false);
      }
    });

    // Fallback: if focus is lost without Enter/Escape, treat as cancel
    const blurHandler = () => {
      if (this._editingKey) {
        this._finishEdit(input, key, currentText, false);
      }
    };
    input.addEventListener("blur", blurHandler);
    // biome-ignore lint/suspicious/noExplicitAny: expando property for blur handler
    (input as any)._editBlurHandler = blurHandler;
  }

  /**
   * Complete the in-place editing cycle. Restores the `<span>` and, if
   * confirmed, calls `ConfigManager.setRuntime()` with the new value.
   */
  private _finishEdit(
    input: HTMLInputElement,
    key: string,
    originalText: string,
    confirmed: boolean
  ): void {
    const newSpan = document.createElement("span");
    newSpan.className = "config-value";
    newSpan.dataset.configKey = key;

    if (confirmed) {
      const rawValue = input.value;
      // Attempt to parse as number if it looks numeric
      const parsed: unknown =
        rawValue === "true"
          ? true
          : rawValue === "false"
            ? false
            : rawValue === "null"
              ? null
              : /^-?\d+(\.\d+)?$/.test(rawValue)
                ? Number(rawValue)
                : rawValue;

      try {
        const cm = this._getConfigManager();
        const oldVal = cm.setRuntime(key, parsed);

        newSpan.textContent = String(parsed);

        // Flash the updated value
        newSpan.style.transition = "background 0.3s";
        newSpan.style.background = "#4a4";
        setTimeout(() => {
          newSpan.style.background = "transparent";
        }, EDIT_DEBOUNCE_MS);

        // Show notification with old → new
        if (this._showNotification) {
          this._showNotification(
            `config updated — ${key}: ${String(oldVal)} → ${String(parsed)}`
          );
        }
      } catch {
        // If setRuntime fails, revert to original display value
        newSpan.textContent = originalText;
      }
    } else {
      newSpan.textContent = originalText;
    }

    // Re-attach the dblclick listener on the new span
    newSpan.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      this._startEdit(key, newSpan);
    });

    // Remove the blur listener before detaching the input from DOM
    // biome-ignore lint/suspicious/noExplicitAny: expando property for blur handler
    const blurHandler = (input as any)._editBlurHandler as () => void;
    input.removeEventListener("blur", blurHandler);

    // Clear the guard BEFORE replaceWith: if replaceWith triggers blur
    // on the input, the blur fallback handler checks _editingKey and
    // returns early when it is null (preventing double-processing).
    this._editingKey = null;
    input.replaceWith(newSpan);
  }
}
