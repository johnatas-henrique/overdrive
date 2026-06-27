import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import type { IDevTools } from "./types";

/**
 * Dev Tools overlay — HTML overlay positioned absolutely over the canvas,
 * showing FPS, frame time, draw calls, mesh count, and physics time via SceneInstrumentation.
 *
 * ## Lifecycle
 * 1. Instantiated via `new DevTools(engine, scene)` (only when `import.meta.env.DEV`)
 * 2. Overlay DOM created lazily on first `toggle()` call
 * 3. Metrics refreshed by `engine.onEndFrameObservable` after each complete frame
 * 4. `dispose()` tears down all DOM and observable subscriptions
 *
 * ## Tree-shaking
 * Vite evaluates `import.meta.env.DEV` at compile time. Since this class
 * is only instantiated inside a `if (import.meta.env.DEV)` block, Vite
 * eliminates the entire module in production bundles.
 *
 * @see TR-DVT-001 — HTML overlay rendering above 3D viewport
 * @see ADR-0009 — Dev Tools Architecture
 * @see Control Manifest D1-D4, D-F1, D-F2
 */
export class DevTools implements IDevTools {
  private _engine: AbstractEngine;
  private _scene: Scene;
  private _initialized = false;
  private _visible = false;
  private _overlay: HTMLDivElement | null = null;
  private _instrumentation: SceneInstrumentation | null = null;
  private _dataSources = new Map<string, () => Record<string, unknown>>();
  private _metricElements: Record<string, HTMLSpanElement> = {};
  private _frameEndObserver: Observer<AbstractEngine> | null = null;

  constructor(engine: AbstractEngine, scene: Scene) {
    this._engine = engine;
    this._scene = scene;

    if (!import.meta.env.DEV) return;

    // SceneInstrumentation captures engine/scene performance counters
    this._instrumentation = new SceneInstrumentation(scene);
    this._instrumentation.captureFrameTime = true;
    this._instrumentation.capturePhysicsTime = true;

    // Register frame-end refresh — fires after each complete frame render
    this._frameEndObserver = engine.onEndFrameObservable.add(() => {
      this._refreshDisplay();
    });
  }

  // ---------------------------------------------------------------------------
  // IDevTools implementation
  // ---------------------------------------------------------------------------

  /** @inheritdoc */
  registerDataSource(
    name: string,
    reader: () => Record<string, unknown>
  ): void {
    this._dataSources.set(name, reader);
  }

  /** @inheritdoc */
  toggle(): void {
    if (!import.meta.env.DEV) return;

    if (!this._initialized) {
      this._initOverlay();
    }

    if (!this._overlay) return;

    this._visible = !this._visible;
    this._overlay.style.display = this._visible ? "flex" : "none";

    if (this._visible) {
      this._refreshDisplay();
    }
  }

  /** @inheritdoc */
  isVisible(): boolean {
    return this._visible;
  }

  /** @inheritdoc */
  setMinimised(_val: boolean): void {
    // Story 003 will implement the visual collapse/expand of the overlay.
  }

  /** @inheritdoc */
  update(): void {
    if (!import.meta.env.DEV) return;
    this._refreshDisplay();
  }

  /** @inheritdoc */
  showNotification(message: string): void {
    if (!import.meta.env.DEV) return;
    if (!this._initialized || !this._overlay) return;

    // Remove existing notification if still showing
    const existing = this._overlay.querySelector(".dev-notification");
    if (existing) existing.remove();

    const el = document.createElement("div");
    el.className = "dev-notification";
    el.textContent = message;
    el.style.cssText =
      "position:absolute;bottom:4px;left:50%;transform:translateX(-50%);" +
      "background:#333;color:#ffd700;padding:4px 12px;border-radius:4px;" +
      "font-family:'Courier New',monospace;font-size:12px;white-space:nowrap;" +
      "z-index:1001;pointer-events:none";

    this._overlay.appendChild(el);

    setTimeout(() => {
      if (el.parentElement) el.remove();
    }, 2000);
  }

  /** @inheritdoc */
  dispose(): void {
    if (!import.meta.env.DEV) return;

    // Unsubscribe from frame-end observable (before DOM removal)
    if (this._frameEndObserver) {
      this._engine.onEndFrameObservable.remove(this._frameEndObserver);
      this._frameEndObserver = null;
    }

    // Remove overlay from DOM
    if (this._overlay?.parentElement) {
      this._overlay.parentElement.removeChild(this._overlay);
    }

    // Dispose the SceneInstrumentation counters
    this._instrumentation?.dispose();

    this._overlay = null;
    this._initialized = false;
    this._visible = false;
    this._dataSources.clear();
    this._metricElements = {};
    this._instrumentation = null;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Lazily create the overlay DOM structure.
   * Called once on first `toggle()` — zero DOM nodes before this.
   */
  private _initOverlay(): void {
    const canvas = this._engine.getRenderingCanvas();
    const container = canvas?.parentElement;
    if (!container) {
      console.warn(
        "[DevTools] Cannot create overlay — canvas or canvas container not found"
      );
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = "dev-overlay";
    overlay.style.cssText =
      "position:absolute;inset:0;pointer-events:none;z-index:10;display:none";

    // ── Top bar: FPS, frame time, draw calls, mesh count ──────────────
    const topBar = document.createElement("div");
    topBar.className = "top-bar";
    topBar.style.cssText =
      "display:flex;gap:16px;padding:4px 8px;" +
      "background:#0a0a0a;color:#fff;" +
      "font-family:'Courier New',monospace;font-size:12px;height:20px";

    this._createMetric(topBar, "FPS", "fps");
    this._createMetric(topBar, "Frame", "frame");
    this._createMetric(topBar, "DC", "dc");
    this._createMetric(topBar, "Meshes", "meshes");
    this._createMetric(topBar, "Phys", "phys");

    overlay.appendChild(topBar);

    // ── Sidebar: config tree (hidden in Story 003, populated by Stories 004+) ──
    const sidebar = document.createElement("div");
    sidebar.className = "sidebar";
    sidebar.style.display = "none";
    overlay.appendChild(sidebar);

    // ── Main panel: tab container (hidden in Story 003) ──────────────
    const mainPanel = document.createElement("div");
    mainPanel.className = "main-panel";
    mainPanel.style.display = "none";
    overlay.appendChild(mainPanel);

    // ── Bottom bar: input/physics state (hidden in Story 003) ─────────
    const bottomBar = document.createElement("div");
    bottomBar.className = "bottom-bar";
    bottomBar.style.display = "none";
    overlay.appendChild(bottomBar);

    container.appendChild(overlay);

    this._overlay = overlay;
    this._initialized = true;
  }

  /**
   * Create a single metric label+value pair inside a top-bar item.
   */
  private _createMetric(parent: HTMLElement, label: string, key: string): void {
    const labelEl = document.createElement("span");
    labelEl.style.color = "#ffd700";
    labelEl.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.dataset.metric = key;
    valueEl.textContent = "--";

    const item = document.createElement("span");
    item.appendChild(labelEl);
    item.appendChild(document.createTextNode(" "));
    item.appendChild(valueEl);

    parent.appendChild(item);
    this._metricElements[key] = valueEl;
  }

  /**
   * Read the latest instrumentation counters and update the DOM.
   * Safe to call when overlay is hidden — guards on `_initialized && _visible`.
   */
  private _refreshDisplay(): void {
    if (!this._initialized || !this._visible) return;
    if (!this._instrumentation) return;

    const inst = this._instrumentation;
    const ft = inst.frameTimeCounter.current;

    this._metricElements.fps.textContent =
      ft > 0 ? `${Math.round(1000 / ft)}` : "--";

    this._metricElements.frame.textContent =
      ft > 0 ? `${ft.toFixed(1)} ms` : "-- ms";

    this._metricElements.dc.textContent = `${inst.drawCallsCounter.current}`;
    this._metricElements.meshes.textContent = `${this._scene.meshes.length}`;

    this._metricElements.phys.textContent =
      inst.physicsTimeCounter.current > 0
        ? `${inst.physicsTimeCounter.current.toFixed(1)} ms`
        : "-- ms";
  }
}
