import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import type { Node } from "@babylonjs/core/node";
import type { Scene } from "@babylonjs/core/scene";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import type { EventMap, IEventBus } from "@/foundation/event-bus/types";
import { AssetError } from "./asset-error";
import type { TrackManifest } from "./types";

/**
 * Internal state machine for AssetManager lifecycle.
 *
 * - `uninitialized`: Before `init()` is called — all methods throw.
 * - `ready`: After `init()` — normal operation.
 * - `disposed`: After `dispose()` — all methods throw.
 */
type AssetState = "uninitialized" | "ready" | "disposed";

/**
 * Scene selector for `setActiveScene()`.
 *
 * String-based routing per ADR-0003 Invariant #2. Accepting a string
 * literal (rather than a Scene object) prevents passing an arbitrary
 * Scene and makes the active scene explicit in call sites.
 */
type SceneName = "menu" | "race";

/**
 * AssetManager — Two-Scene Architecture & Asset Lifecycle (ADR-0003).
 *
 * Manages two persistent Babylon.js Scenes (`menuScene` + `raceScene`)
 * that coexist in `engine.scenes[]`. Only one scene renders per frame,
 * controlled by `setActiveScene()`.
 *
 * The AssetContainer cache (`Map<string, AssetContainer>`) enables
 * zero-I/O scene transitions — containers are loaded once and
 * instantiated per scene (Story 002+).
 *
 * ## State Machine
 *
 * ```
 * Uninitialized → Ready → Disposed
 * ```
 *
 * - **Uninitialized**: All methods except `init()` throw `AssetError`.
 * - **Ready**: Normal operation after `init()`.
 * - **Disposed**: All methods throw `AssetError`.
 *
 * ## Usage
 *
 * ```typescript
 * const assetManager = new AssetManager();
 * assetManager.init(menuScene, raceScene);
 *
 * // During Menu → PreRace transition
 * assetManager.setActiveScene("race");
 * engine.runRenderLoop(() => assetManager.getActiveScene().render());
 * ```
 *
 * @see ADR-0003 — Two-Scene Architecture & Asset Lifecycle
 * @see Control Manifest C1 — Two persistent scenes
 * @see Control Manifest C2 — AssetContainers cached via Map<string, AssetContainer>
 */
export class AssetManager {
  /** Menu scene — shown during Title, Car Select, Track Select, etc. */
  private _menuScene: Scene | null = null;

  /** Race scene — shown during grid, racing, results. Has physics enabled. */
  private _raceScene: Scene | null = null;

  /** The currently active scene (rendered each frame). Defaults to `menuScene` after init. */
  private _activeScene: Scene | null = null;

  /**
   * AssetContainer cache — load once, instantiate per scene.
   * Populated by `load()` / `preload()` (Story 002+).
   */
  private readonly _cache: Map<string, AssetContainer> = new Map();

  /**
   * Manifest registry — maps asset IDs to their load paths.
   * Populated by `registerManifest()` during boot and consumed
   * by `load()` to build the URL for `LoadAssetContainerAsync`.
   */
  private readonly _manifests: Map<string, TrackManifest> = new Map();

  /** Optional EventBus for emitting lifecycle events. */
  private readonly _eventBus?: IEventBus;

  /** Current state machine state. */
  private _state: AssetState = "uninitialized";

  /**
   * @param eventBus - Optional EventBus for asset lifecycle events. When provided,
   *                   `load()` emits `asset.load.start`, `.progress`, `.complete`,
   *                   and `asset.error` events. When omitted, no events are emitted.
   */
  constructor(eventBus?: IEventBus) {
    this._eventBus = eventBus;
  }

  // ── Public API ────────────────────────────────────────────────

  /**
   * Initialize the AssetManager with two persistent scenes.
   *
   * Stores both scene references, creates an empty cache, and transitions
   * state to `Ready`. Idempotent — calling `init()` multiple times is
   * a safe no-op.
   *
   * @param menuScene - The Babylon.js Scene for menu states
   * @param raceScene - The Babylon.js Scene for race states
   *
   * @example
   * ```typescript
   * const am = new AssetManager();
   * am.init(menuScene, raceScene);
   * ```
   */
  init(menuScene: Scene, raceScene: Scene): void {
    if (this._state === "ready") {
      return; // Idempotent: second call is no-op
    }
    this._menuScene = menuScene;
    this._raceScene = raceScene;
    this._activeScene = menuScene;
    this._cache.clear(); // Ensure clean slate (cache populated by Story 002+)
    this._state = "ready";
  }

  /**
   * Set which scene renders each frame.
   *
   * Controls the scene returned by `getActiveScene()` and used by the
   * render loop (`engine.runRenderLoop(() => am.getActiveScene().render())`).
   *
   * @param scene - `'menu'` to render menuScene, `'race'` to render raceScene
   *
   * @throws {AssetError} If called before `init()`
   * @throws {AssetError} If `scene` is not `'menu'` or `'race'`
   *
   * @example
   * ```typescript
   * am.setActiveScene("race"); // Switch to race scene rendering
   * am.setActiveScene("menu"); // Switch back to menu scene
   * ```
   */
  setActiveScene(scene: SceneName): void {
    this._assertInitialized();
    if (scene === "menu") {
      this._activeScene = this._menuScene;
    } else if (scene === "race") {
      this._activeScene = this._raceScene;
    } else {
      throw new AssetError(
        `Invalid scene: '${String(scene)}'. Expected 'menu' or 'race'`
      );
    }
  }

  /**
   * Return the currently active Scene.
   *
   * Used by the render loop to call `scene.render()` each frame.
   *
   * @returns The active Babylon.js Scene
   *
   * @throws {AssetError} If called before `init()`
   *
   * @example
   * ```typescript
   * const active = am.getActiveScene();
   * active.render();
   * ```
   */
  getActiveScene(): Scene {
    this._assertInitialized();
    return this._activeScene as Scene;
  }

  /**
   * Return the number of cached AssetContainers.
   *
   * Useful for test verification and debug panels. The cache is populated
   * by `load()` / `preload()` (Story 002+).
   *
   * @returns Number of entries in the cache
   */
  get cacheSize(): number {
    return this._cache.size;
  }

  /**
   * Internal: add all meshes from an AssetContainer to its bound scene.
   *
   * Delegates to `container.addAllToScene()`. Note: `AssetContainer.addAllToScene()`
   * takes no parameters — the container is scene-bound at load time (the scene
   * passed to `LoadAssetContainerAsync`), not the currently active scene.
   *
   * @param container - The AssetContainer whose meshes should be added to the active scene
   *
   * @throws {AssetError} If called before `init()`
   *
   * @internal
   */
  _addAllToScene(container: AssetContainer): void {
    this._assertInitialized();
    container.addAllToScene();
  }

  // ── Manifest Registration ─────────────────────────────────────

  /**
   * Register an asset manifest for deferred loading.
   *
   * Stores the manifest keyed by `id` in an internal map. The manifest
   * is consumed by `load()` to build the URL for `LoadAssetContainerAsync`.
   *
   * @param id - Unique asset identifier (e.g. `'spa'` for Spa track)
   * @param manifest - Manifest describing the GLB asset paths
   *
   * @throws {AssetError} If called before `init()`
   *
   * @example
   * ```typescript
   * am.registerManifest("spa", {
   *   glb: { rootUrl: "assets/tracks/spa/", filename: "spa.glb" },
   * });
   * ```
   */
  registerManifest(id: string, manifest: TrackManifest): void {
    this._assertNotDisposed();
    this._assertInitialized();
    this._manifests.set(id, manifest);
  }

  // ── Lifecycle & Cleanup ─────────────────────────────────────

  /**
   * Remove all cached containers from the active scene.
   *
   * Calls `container.removeAllFromScene()` on every cached AssetContainer.
   * Containers remain in the cache and can be re-added via `load()`.
   * Used during PostRace→Menu transition.
   *
   * Idempotent — calling twice is a safe no-op. Calling after `dispose()`
   * is also a safe no-op.
   *
   * @throws {AssetError} If called before `init()`
   */
  unloadAll(): void {
    if (this._state === "disposed") return;
    this._assertInitialized();
    for (const container of this._cache.values()) {
      container.removeAllFromScene();
    }
  }

  /**
   * Dispose all cached containers and clear the cache.
   *
   * Calls `container.dispose()` on every cached AssetContainer, then clears
   * the cache map. Transitions state to `Disposed`. Used at application quit.
   *
   * Does NOT dispose `menuScene` or `raceScene` — scene ownership is outside
   * AssetManager (Control Manifest C1).
   *
   * Idempotent — calling twice is a safe no-op.
   *
   * @throws {AssetError} If called before `init()`
   */
  dispose(): void {
    if (this._state === "disposed") return;
    this._assertInitialized();
    for (const container of this._cache.values()) {
      container.dispose();
    }
    this._cache.clear();
    this._state = "disposed";
  }

  /**
   * Dispose a single cached container and remove it from the cache.
   *
   * Calls `container.dispose()` and removes the entry. Other containers
   * are unaffected. Missing ID is a safe no-op.
   *
   * @param id - Asset identifier to dispose
   *
   * @throws {AssetError} If called before `init()`
   */
  disposeContainer(id: string): void {
    this._assertNotDisposed();
    this._assertInitialized();
    const container = this._cache.get(id);
    if (!container) return; // Safe no-op for missing ID
    container.dispose();
    this._cache.delete(id);
  }

  // ── Asset Loading ────────────────────────────────────────────

  /**
   * Load an asset by ID, caching the resulting AssetContainer.
   *
   * If the asset is already cached, returns the cached container
   * synchronously (zero I/O). On first load, resolves the manifest,
   * calls `LoadAssetContainerAsync`, unparents source meshes from
   * the race scene, caches the container, and adds it to the active
   * scene.
   *
   * Load errors propagate naturally via Promise rejection — errors
   * are NOT caught-and-silenced.
   *
   * @param id - Asset identifier previously registered via `registerManifest()`
   * @returns The AssetContainer containing the loaded meshes and nodes
   *
   * @throws {AssetError} If called before `init()`
   * @throws {AssetError} If called after `dispose()`
   * @throws {AssetError} If `id` was not registered via `registerManifest()`
   *
   * @example
   * ```typescript
   * const container = await am.load("spa");
   * container.instantiateModelsToScene();
   * ```
   */
  async load(id: string): Promise<AssetContainer> {
    this._assertNotDisposed();
    this._assertInitialized();

    this._emit("asset.load.start", { ids: [id] });

    // Cache hit — zero I/O
    if (this._cache.has(id)) {
      // biome-ignore lint/style/noNonNullAssertion: has() guarantees get() returns value — Map consistency
      const container = this._cache.get(id)!;
      this._emit("asset.load.progress", { id, loaded: 1, total: 1 });
      this._emit("asset.load.complete", { id });
      this._addAllToScene(container);
      return container;
    }

    // Cache miss — resolve manifest and load
    const manifest = this._manifests.get(id);
    if (!manifest) {
      this._emit("asset.error", {
        assetId: id,
        error: new AssetError(`Manifest not found for asset '${id}'`),
      });
      throw new AssetError(`Manifest not found for asset '${id}'`);
    }

    let container: AssetContainer;
    try {
      container = await LoadAssetContainerAsync(
        manifest.glb.filename,
        this._raceScene as Scene,
        { rootUrl: manifest.glb.rootUrl }
      );
    } catch (error) {
      this._emit("asset.error", {
        assetId: id,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }

    // TODO: Detect texture load failures via scene.onTextureLoadingErrorObservable.
    // Babylon.js logs a warning and shows checkerboard for missing textures —
    // not a rejection. Emit 'asset.error' with the texture ID when detected.
    // Not unit-testable; requires manual smoke check.

    this._emit("asset.load.progress", { id, loaded: 1, total: 1 });
    this._emit("asset.load.complete", { id });
    container.removeAllFromScene();
    this._cache.set(id, container);
    this._addAllToScene(container);
    return container;
  }

  // ── Node Lookup ──────────────────────────────────────────────

  /**
   * Look up a node by ID or name across all cached AssetContainers.
   *
   * Searches both `meshes` and `transformNodes` in every cached
   * container. Returns the first match (by `id` or `name`) or
   * `undefined` if no match is found.
   *
   * Safe to call before `init()` — returns `undefined` with no error.
   * Throws after `dispose()`.
   *
   * @param id - The node's `id` or `name` property to search for
   * @returns The matching Node, or `undefined`
   *
   * @example
   * ```typescript
   * const root = am.get<TransformNode>("spa_root");
   * if (root) root.position.x += 10;
   * ```
   */
  get<T extends Node = Node>(id: string): T | undefined {
    this._assertNotDisposed();
    for (const container of this._cache.values()) {
      // Search meshes (by id or name — Babylon.js convention)
      const mesh = container.meshes.find((n) => n.id === id || n.name === id) as
        | T
        | undefined;
      if (mesh) return mesh;
      // Search transform nodes (catches root TransformNodes from GLBs)
      const tn = container.transformNodes.find(
        (n) => n.id === id || n.name === id
      ) as T | undefined;
      if (tn) return tn;
    }
    return undefined;
  }

  // ── Internal Helpers ──────────────────────────────────────────

  /**
   * Guard: assert the AssetManager is in the `Ready` state.
   *
   * @throws {AssetError} With message `'Not initialized'` if state is not `'ready'`
   */
  private _assertInitialized(): void {
    if (this._state !== "ready") {
      throw new AssetError("Not initialized");
    }
  }

  /**
   * Guard: assert the AssetManager is NOT in the Disposed state.
   *
   * @throws {AssetError} With message `'Already disposed'` if state is `'disposed'`
   */
  private _assertNotDisposed(): void {
    if (this._state === "disposed") {
      throw new AssetError("Already disposed");
    }
  }

  /**
   * Emit an event on the optional EventBus (no-op when no bus is configured).
   *
   * @param event - Event name from EventMap
   * @param payload - Typed payload matching the event
   */
  private _emit<T extends keyof EventMap>(
    event: T,
    payload: EventMap[T]
  ): void {
    this._eventBus?.emit(event, payload);
  }
}
