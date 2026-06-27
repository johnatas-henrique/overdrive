import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import { getConfigManager } from "@/foundation/config/config-manager";
import type { IEventBus } from "../../foundation/event-bus";
import { ConfigTreePanel } from "./config-tree";
import {
  EventBusInspector,
  type IReadOnlyEventBus,
} from "./event-bus-inspector";
import type { IDevTools } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Internal tab definition for the main panel tab system. */
interface TabDefinition {
  id: string;
  label: string;
  refresh?: () => void;
}

/**
 * Dev Tools overlay — HTML overlay positioned absolutely over the canvas,
 * showing FPS, frame time, draw calls, mesh count, physics time via
 * SceneInstrumentation, and tabbed data panels (Event Log, etc.).
 *
 * ## Lifecycle
 * 1. Instantiated via `new DevTools(engine, scene)` (only when `import.meta.env.DEV`)
 * 2. Overlay DOM created lazily on first `toggle()` call
 * 3. Event Bus injected via `setEventBus()` (triggers Event Log tab creation)
 * 4. Metrics refreshed by `engine.onEndFrameObservable` after each complete frame
 * 5. `dispose()` tears down all DOM and observable subscriptions
 *
 * ## Tree-shaking
 * Vite evaluates `import.meta.env.DEV` at compile time. Since this class
 * is only instantiated inside a `if (import.meta.env.DEV)` block, Vite
 * eliminates the entire module in production bundles.
 *
 * @see TR-DVT-001 — HTML overlay rendering above 3D viewport
 * @see TR-DVT-002 — Event Bus inspector
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
  private _sidebar: HTMLDivElement | null = null;
  private _configTreePanel: ConfigTreePanel | null = null;

  // Event Bus + tab system
  private _eventBus: IEventBus | null = null;
  private _eventBusInspector: EventBusInspector | null = null;
  private _tabBar: HTMLDivElement | null = null;
  private _tabContent: HTMLDivElement | null = null;
  private _activeTabId: string | null = null;
  private _tabs: TabDefinition[] = [];

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
      this.update();
    });
  }

  // ---------------------------------------------------------------------------
  // IDevTools implementation
  // ---------------------------------------------------------------------------

  /** @inheritdoc */
  setEventBus(eventBus: IEventBus): void {
    if (!import.meta.env.DEV) return;
    if (this._eventBus) return;
    this._eventBus = eventBus;

    // If overlay is already initialized, create the Event Log tab now
    if (this._initialized && this._tabBar && this._tabContent) {
      this._createEventLogTab();
    }
  }

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

    // Dispose Event Bus inspector
    this._eventBusInspector?.dispose();
    this._eventBusInspector = null;
    this._eventBus = null;

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
    this._sidebar = null;
    this._tabBar = null;
    this._tabContent = null;
    this._configTreePanel = null;
    this._initialized = false;
    this._visible = false;
    this._dataSources.clear();
    this._metricElements = {};
    this._instrumentation = null;
    this._tabs = [];
    this._activeTabId = null;
  }

  // ---------------------------------------------------------------------------
  // Private: overlay DOM creation
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
      "position:absolute;inset:0;pointer-events:none;z-index:10;" +
      "display:none;flex-direction:column";

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

    // ── Middle row: sidebar + main panel (flex row, fills remaining space) ──
    const middle = document.createElement("div");
    middle.style.cssText =
      "flex:1;display:flex;flex-direction:row;overflow:hidden";

    // ── Sidebar: config tree ──────────────────────────────────────────
    const sidebar = document.createElement("div");
    sidebar.className = "sidebar";
    sidebar.style.cssText =
      "width:320px;display:flex;flex-direction:column;" +
      "background:#0a0a0a;border-right:1px solid #333;overflow-y:auto";
    middle.appendChild(sidebar);

    // ── Main panel: tab container ─────────────────────────────────────
    const mainPanel = document.createElement("div");
    mainPanel.className = "main-panel";
    mainPanel.style.cssText =
      "flex:1;display:flex;flex-direction:column;overflow:hidden";

    // Tab bar
    this._tabBar = document.createElement("div");
    this._tabBar.className = "tab-bar";
    this._tabBar.style.cssText =
      "display:flex;gap:0;background:#1a1a1a;border-bottom:1px solid #333;" +
      "min-height:28px;pointer-events:auto";
    mainPanel.appendChild(this._tabBar);

    // Tab content area
    this._tabContent = document.createElement("div");
    this._tabContent.className = "tab-content";
    this._tabContent.style.cssText =
      "flex:1;overflow:hidden;display:flex;flex-direction:column;pointer-events:auto";
    mainPanel.appendChild(this._tabContent);

    middle.appendChild(mainPanel);

    overlay.appendChild(middle);

    // ── Bottom bar: input/physics state (hidden in Story 003) ─────────
    const bottomBar = document.createElement("div");
    bottomBar.className = "bottom-bar";
    bottomBar.style.display = "none";
    overlay.appendChild(bottomBar);

    container.appendChild(overlay);

    this._overlay = overlay;
    this._sidebar = sidebar;
    this._initialized = true;

    // ── Register "config" data source ─────────────────────────────────
    if (import.meta.env.DEV) {
      this._initConfigDataSource();
    }

    // If event bus was set before overlay init, create the tab now
    if (this._eventBus) {
      this._createEventLogTab();
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Event Log tab creation
  // ---------------------------------------------------------------------------

  /**
   * Create the Event Log tab panel and its tab button.
   *
   * Called by `setEventBus()` when the overlay is already initialized,
   * or by `_initOverlay()` when the bus was set before the first toggle.
   */
  private _createEventLogTab(): void {
    if (!this._tabContent || !this._tabBar || !this._eventBus) return;

    // Create tab panel container
    const panel = document.createElement("div");
    panel.className = "tab-panel";
    panel.dataset.tabId = "event-log";
    panel.style.cssText = "display:none;height:100%;flex-direction:column";

    // Create read-only wrapper via type narrowing (IEventBus → IReadOnlyEventBus)
    // TypeScript allows this because IEventBus structurally satisfies the pick.
    const readOnlyBus: IReadOnlyEventBus = this._eventBus;

    this._eventBusInspector = new EventBusInspector(panel, readOnlyBus);
    this._tabContent.appendChild(panel);

    // Create tab button
    const btn = document.createElement("button");
    btn.className = "tab";
    btn.dataset.tabId = "event-log";
    btn.textContent = "Event Log";
    btn.style.cssText =
      "padding:4px 16px;background:transparent;color:#888;border:none;" +
      "cursor:pointer;font-family:'Courier New',monospace;font-size:11px;" +
      "border-bottom:2px solid transparent";
    btn.addEventListener("click", () => this._switchTab("event-log"));
    this._tabBar.appendChild(btn);

    // Register tab definition
    this._tabs.push({
      id: "event-log",
      label: "Event Log",
      refresh: () => this._eventBusInspector?.refresh(),
    });

    // Switch to this tab (activates it)
    this._switchTab("event-log");
  }

  /**
   * Switch the active tab — updates tab button styles, shows/hides
   * panel divs, and calls the tab's refresh callback.
   *
   * @param tabId — The `id` field of the TabDefinition to activate
   */
  private _switchTab(tabId: string): void {
    this._activeTabId = tabId;

    // Update tab button styles
    const tabBtns = this._tabBar?.querySelectorAll(".tab");
    tabBtns?.forEach((btn) => {
      const el = btn as HTMLButtonElement;
      const isActive = el.dataset.tabId === tabId;
      el.style.color = isActive ? "#ffd700" : "#888";
      el.style.borderBottom = isActive
        ? "2px solid #ffd700"
        : "2px solid transparent";
      el.classList.toggle("active", isActive);
    });

    // Show/hide tab panels
    const panels = this._tabContent?.querySelectorAll(".tab-panel");
    panels?.forEach((panel) => {
      const el = panel as HTMLDivElement;
      const isActive = el.dataset.tabId === tabId;
      el.style.display = isActive ? "flex" : "none";
      el.classList.toggle("active", isActive);
    });

    // Refresh the active tab
    const tab = this._tabs.find((t) => t.id === tabId);
    if (tab?.refresh) {
      tab.refresh();
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Config data source (Story 004)
  // ---------------------------------------------------------------------------

  /**
   * Register the "config" data source and lazily create the ConfigTreePanel.
   *
   * The data source reader is invoked each `_refreshDisplay()` tick.
   * The panel is created on first `_refreshDisplay()` that finds
   * ConfigManager initialized — avoids early access before init.
   */
  private _initConfigDataSource(): void {
    if (!this._sidebar) return;

    this.registerDataSource("config", () => {
      try {
        return getConfigManager().getDebugState() as unknown as Record<
          string,
          unknown
        >;
      } catch {
        return { namespaces: {}, accessLog: [], envOverrides: [] } as Record<
          string,
          unknown
        >;
      }
    });
  }

  /**
   * Lazily create and/or refresh the config tree panel.
   *
   * The panel is created on first refresh tick where ConfigManager is
   * fully initialized (has `getDebugState`). If the singleton is not yet
   * initialized or the mock doesn't expose the full API, the panel is
   * skipped — no crash, retried on next tick.
   */
  private _refreshConfigTree(): void {
    if (!this._sidebar) return;

    // Lazy create: if panel doesn't exist yet, try to create it
    if (!this._configTreePanel) {
      try {
        const cm = getConfigManager();
        // Guard: ConfigManager must expose getDebugState (the expected API)
        if (typeof cm.getDebugState !== "function") {
          return;
        }
        this._configTreePanel = new ConfigTreePanel(
          this._sidebar,
          () => getConfigManager(),
          (msg: string) => this.showNotification(msg)
        );
      } catch {
        console.warn(
          "[DevTools] ConfigManager not available — retry next tick"
        );
        return;
      }
    }

    // Refresh the panel
    this._configTreePanel.refresh();
  }

  // ---------------------------------------------------------------------------
  // Private: metrics rendering
  // ---------------------------------------------------------------------------

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

    // Refresh the active tab panel
    const activeTab = this._tabs.find((t) => t.id === this._activeTabId);
    if (activeTab?.refresh) {
      activeTab.refresh();
    }

    // Refresh data source panels (config tree, etc.)
    this._refreshConfigTree();
  }
}
