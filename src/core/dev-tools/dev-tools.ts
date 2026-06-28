import "./dev-tools.css";

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { SceneInstrumentation } from "@babylonjs/core/Instrumentation/sceneInstrumentation";
import type { Observer } from "@babylonjs/core/Misc/observable";
import type { Scene } from "@babylonjs/core/scene";
import { getConfigManager } from "@/foundation/config/config-manager";
import type { IEventBus } from "../../foundation/event-bus";
import type { GameStateMachine } from "../../foundation/gsm/GameStateMachine";
import type { SimulationSnapshot } from "../../foundation/simulation-snapshot";
import { defined } from "../../shared/assert-defined";
import { AiTelemetryPanel } from "./ai-telemetry-panel";
import { ConfigTreePanel } from "./config-tree";
import {
  EventBusInspector,
  type IReadOnlyEventBus,
} from "./event-bus-inspector";
import { GsmVisualizer } from "./gsm-visualizer";
import { disposeKeybinds } from "./keybinds";
import { SimSnapshotPanel } from "./sim-snapshot-panel";
import type { AiTelemetryCarData, IDevTools } from "./types";

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
  private _minimised = false;
  private _overlay: HTMLDivElement | null = null;
  private _middle: HTMLDivElement | null = null;
  private _topBar: HTMLDivElement | null = null;
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

  // GSM History tab
  private _gsm: GameStateMachine | null = null;
  private _gsmVisualizer: GsmVisualizer | null = null;

  // Simulation Snapshot tab
  private _simulationSnapshot: SimulationSnapshot | null = null;
  private _simSnapshotPanel: SimSnapshotPanel | null = null;

  // AI Telemetry tab
  private _aiTelemetryReader: (() => AiTelemetryCarData[]) | null = null;
  private _aiTelemetryPanel: AiTelemetryPanel | null = null;

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
    if (this._eventBus) return;
    this._eventBus = eventBus;

    // If overlay is already initialized, create the Event Log tab now
    if (this._initialized && this._tabBar && this._tabContent) {
      this._createEventLogTab();
      // Also create GSM History tab if GSM is already available
      if (this._gsm) {
        this._createGsmHistoryTab();
      }
    }
  }

  /** @inheritdoc */
  setGsm(gsm: GameStateMachine): void {
    if (this._gsm) return;
    this._gsm = gsm;

    // Create GSM History tab if overlay is initialized and Event Bus is available
    if (
      this._initialized &&
      this._tabBar &&
      this._tabContent &&
      this._eventBus
    ) {
      this._createGsmHistoryTab();
    }
  }

  /** @inheritdoc */
  setAiTelemetry(getTelemetry: () => AiTelemetryCarData[]): void {
    if (this._aiTelemetryReader) return;
    this._aiTelemetryReader = getTelemetry;

    // If overlay is already initialized, create the tab now
    if (this._initialized && this._tabBar && this._tabContent) {
      this._createAiTelemetryTab();
    }
  }

  /** @inheritdoc */
  setSimulationSnapshot(snapshot: SimulationSnapshot): void {
    if (this._simulationSnapshot) return;
    this._simulationSnapshot = snapshot;

    // Create Sim Snapshot tab if overlay is initialized
    if (this._initialized && this._tabBar && this._tabContent) {
      this._createSimSnapshotTab();
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
      this.setMinimised(this._minimised);
      this._refreshConfigTree();
      this._refreshDisplay();
    }
  }

  /** @inheritdoc */
  isVisible(): boolean {
    return this._visible;
  }

  /** @inheritdoc */
  setMinimised(val: boolean): void {
    this._minimised = val;
    if (!this._middle || !this._topBar) return;

    if (val) {
      this._middle.style.display = "none";
      if (this._sidebar) this._sidebar.style.display = "none";
    } else {
      this._middle.style.display = "flex";
      if (this._sidebar) this._sidebar.style.display = "";
    }
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

    this._overlay.appendChild(el);

    setTimeout(() => {
      if (el.parentElement) el.remove();
    }, 2000);
  }

  /** @inheritdoc */
  refreshConfigTree(): void {
    this._refreshConfigTree();
  }

  /** @inheritdoc */
  dispose(): void {
    if (!import.meta.env.DEV) return;

    // Remove the keyboard listener to prevent stale singleton reference
    disposeKeybinds();

    // Dispose GSM visualizer
    this._gsmVisualizer?.dispose();
    this._gsmVisualizer = null;
    this._gsm = null;

    // Dispose Sim Snapshot panel
    this._simSnapshotPanel?.dispose();
    this._simSnapshotPanel = null;
    this._simulationSnapshot = null;

    // Dispose AI Telemetry panel
    this._aiTelemetryPanel?.dispose();
    this._aiTelemetryPanel = null;
    this._aiTelemetryReader = null;

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
    this._minimised = false;
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

    // ── Top bar: FPS, frame time, draw calls, mesh count ──────────────
    const topBar = document.createElement("div");
    topBar.className = "top-bar";

    this._createMetric(topBar, "FPS", "fps");
    this._createMetric(topBar, "Frame", "frame");
    this._createMetric(topBar, "DC", "dc");
    this._createMetric(topBar, "Meshes", "meshes");
    this._createMetric(topBar, "Phys", "phys");

    overlay.appendChild(topBar);
    this._topBar = topBar;

    // ── Middle row: sidebar + main panel (flex row, fills remaining space) ──
    const middle = document.createElement("div");
    middle.className = "dev-middle";

    // ── Sidebar: config tree ──────────────────────────────────────────
    const sidebar = document.createElement("div");
    sidebar.className = "sidebar";
    middle.appendChild(sidebar);

    // ── Main panel: tab container ─────────────────────────────────────
    const mainPanel = document.createElement("div");
    mainPanel.className = "main-panel";

    // Tab bar
    this._tabBar = document.createElement("div");
    this._tabBar.className = "tab-bar";
    mainPanel.appendChild(this._tabBar);

    // Tab content area
    this._tabContent = document.createElement("div");
    this._tabContent.className = "tab-content";
    mainPanel.appendChild(this._tabContent);

    middle.appendChild(mainPanel);

    overlay.appendChild(middle);
    this._middle = middle;

    // ── Bottom bar: input/physics state (hidden in Story 003) ─────────
    const bottomBar = document.createElement("div");
    bottomBar.className = "bottom-bar";
    overlay.appendChild(bottomBar);

    container.appendChild(overlay);

    this._overlay = overlay;
    this._sidebar = sidebar;
    this._initialized = true;

    // ── Register "config" data source ─────────────────────────────────
    this._initConfigDataSource();

    // If event bus was set before overlay init, create the tab now
    if (this._eventBus) {
      this._createEventLogTab();
      // Also create GSM History tab if GSM is already available
      if (this._gsm) {
        this._createGsmHistoryTab();
      }
    }

    // If SimulationSnapshot was set before overlay init, create the tab now
    if (this._simulationSnapshot) {
      this._createSimSnapshotTab();
    }

    // If AI Telemetry reader was set before overlay init, create the tab now
    if (this._aiTelemetryReader) {
      this._createAiTelemetryTab();
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
    defined(this._tabContent);
    defined(this._tabBar);
    defined(this._eventBus);

    // Create tab panel container
    const panel = document.createElement("div");
    panel.className = "tab-panel";
    panel.dataset.tabId = "event-log";

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
   * Create the GSM History tab panel and its tab button.
   *
   * Called by `setGsm()` when the overlay is already initialized,
   * or by `_initOverlay()` when both Event Bus and GSM were set
   * before the first toggle.
   */
  private _createGsmHistoryTab(): void {
    defined(this._tabContent);
    defined(this._tabBar);
    defined(this._eventBus);
    defined(this._gsm);

    // Create tab panel container
    const panel = document.createElement("div");
    panel.className = "tab-panel";
    panel.dataset.tabId = "gsm-history";

    // Create read-only Event Bus wrapper
    const readOnlyBus: IReadOnlyEventBus = this._eventBus;

    this._gsmVisualizer = new GsmVisualizer(panel, readOnlyBus, this._gsm);
    this._tabContent.appendChild(panel);

    // Create tab button
    const btn = document.createElement("button");
    btn.className = "tab";
    btn.dataset.tabId = "gsm-history";
    btn.textContent = "GSM History";
    btn.addEventListener("click", () => this._switchTab("gsm-history"));
    this._tabBar.appendChild(btn);

    // Register tab definition
    this._tabs.push({
      id: "gsm-history",
      label: "GSM History",
      refresh: () => this._gsmVisualizer?.refresh(),
    });
  }

  /**
   * Create the Simulation Snapshot tab panel and its tab button.
   *
   * Called by `setSimulationSnapshot()` when the overlay is already
   * initialized, or by `_initOverlay()` when SimulationSnapshot was set
   * before the first toggle.
   */
  private _createSimSnapshotTab(): void {
    defined(this._tabContent);
    defined(this._tabBar);
    defined(this._simulationSnapshot);

    // Create tab panel container
    const panel = document.createElement("div");
    panel.className = "tab-panel";
    panel.dataset.tabId = "sim-snapshot";

    this._simSnapshotPanel = new SimSnapshotPanel(
      panel,
      this._simulationSnapshot,
      (msg: string) => this.showNotification(msg)
    );
    this._tabContent.appendChild(panel);

    // Create tab button
    const btn = document.createElement("button");
    btn.className = "tab";
    btn.dataset.tabId = "sim-snapshot";
    btn.textContent = "Sim Snapshot";
    btn.addEventListener("click", () => this._switchTab("sim-snapshot"));
    this._tabBar?.appendChild(btn);

    // Register tab definition
    this._tabs.push({
      id: "sim-snapshot",
      label: "Sim Snapshot",
      refresh: () => this._simSnapshotPanel?.refresh(),
    });
  }

  /**
   * Create the AI Telemetry tab panel and its tab button.
   *
   * Called by `setAiTelemetry()` when the overlay is already initialized,
   * or by `_initOverlay()` when the reader was set before the first toggle.
   */
  private _createAiTelemetryTab(): void {
    defined(this._tabContent);
    defined(this._tabBar);
    defined(this._aiTelemetryReader);

    // Create tab panel container
    const panel = document.createElement("div");
    panel.className = "tab-panel";
    panel.dataset.tabId = "ai-telemetry";

    this._aiTelemetryPanel = new AiTelemetryPanel(
      panel,
      this._aiTelemetryReader
    );
    this._tabContent.appendChild(panel);

    // Create tab button
    const btn = document.createElement("button");
    btn.className = "tab";
    btn.dataset.tabId = "ai-telemetry";
    btn.textContent = "AI Telemetry";
    btn.addEventListener("click", () => this._switchTab("ai-telemetry"));
    this._tabBar.appendChild(btn);

    // Register tab definition
    this._tabs.push({
      id: "ai-telemetry",
      label: "AI Telemetry",
      refresh: () => this._aiTelemetryPanel?.refresh(),
    });
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
      el.classList.toggle("active", isActive);
    });

    // Show/hide tab panels
    const panels = this._tabContent?.querySelectorAll(".tab-panel");
    panels?.forEach((panel) => {
      const el = panel as HTMLDivElement;
      const isActive = el.dataset.tabId === tabId;
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
    defined(this._sidebar);

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
    labelEl.className = "metric-label";
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

    // Config tree is NOT refreshed here — it's refreshed once on toggle
    // and on explicit refreshConfigTree() calls (reload key). Doing it
    // every frame resets <details> open/close state and causes flicker.
  }
}
