import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { Scene } from "@babylonjs/core/scene";
import { AssetError } from "./asset-error";

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

  /** Current state machine state. */
  private _state: AssetState = "uninitialized";

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
   * Internal: add all meshes from an AssetContainer to the active scene.
   *
   * Delegates to `container.addAllToScene()`. Note: `AssetContainer.addAllToScene()`
   * takes no parameters — the container is scene-bound at load time.
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
}
