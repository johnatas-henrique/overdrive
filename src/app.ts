import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { Vector3 } from "@babylonjs/core/Maths/math";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { Scene } from "@babylonjs/core/scene";
import "@babylonjs/core/Physics/joinedPhysicsEngineComponent";
import "@babylonjs/core/Materials/Textures/cubeTexture";
import "@babylonjs/core/Materials/Textures/Loaders/envTextureLoader";
import { AssetManager } from "./asset-manager/asset-manager";
import { templateConfig } from "./config/template-config";

class App {
  public engine!: Engine | WebGPUEngine;
  public menuScene!: Scene;
  public raceScene!: Scene;
  private readonly canvas: HTMLCanvasElement;
  private readonly assetManager = new AssetManager();

  constructor() {
    this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    void this._bootstrap();
  }

  private async _bootstrap(): Promise<void> {
    this.engine = await this._createEngine();

    // ADR-0003: Two persistent scenes — menuScene + raceScene
    // coexist in engine.scenes[]. Only the active scene renders per frame.
    this.menuScene = new Scene(this.engine);
    this.raceScene = new Scene(this.engine);

    // Babylon.js requires at least one camera per scene to render.
    // Minimal placeholder cameras — replaced by proper cameras in later stories.
    this._addPlaceholderCamera(this.menuScene);
    this._addPlaceholderCamera(this.raceScene);

    // Physics is only needed on the race scene (menu has no physics)
    // Register the Havok plugin against raceScene so that race state
    // (PhysicsBody, PhysicsAggregate) binds to the correct scene.
    await this._setPhysics();

    // ── Event Bus (shared across all systems) ─────────────────────
    // Created before AssetManager.init so systems that emit during
    // their own initialisation already have the bus available (D-013).
    const { EventBus } = await import("@/foundation/event-bus/event-bus");
    const eventBus = new EventBus();
    eventBus.init();

    // ADR-0003: AssetManager.init() stores both scene references,
    // creates the empty cache, and transitions to Ready state.
    this.assetManager.init(this.menuScene, this.raceScene);

    // ── Dev Tools (tree-shaken in production) ─────────────────────
    if (import.meta.env.DEV) {
      const { initDevTools } = await import("./core/dev-tools");
      await initDevTools(
        this.engine,
        this.assetManager.getActiveScene(),
        eventBus
        // gsm, simulationSnapshot, aiTelemetry omitted —
        // they are optional and not yet available at bootstrap time.
      );
    }

    this._render();
  }

  async _createEngine(): Promise<Engine | WebGPUEngine> {
    if (templateConfig.rendering.webgpuFirst && "gpu" in navigator) {
      try {
        const webgpu = new WebGPUEngine(this.canvas, {
          adaptToDeviceRatio:
            templateConfig.rendering.engine.adaptToDeviceRatio,
          antialias: templateConfig.rendering.engine.antialias,
        });
        await webgpu.initAsync();
        return webgpu;
      } catch (error) {
        console.warn("WebGPU failed, falling back to WebGL2.", error);
      }
    }
    return new Engine(this.canvas, true, {
      stencil: templateConfig.rendering.engine.stencil,
      disableWebGL2Support:
        templateConfig.rendering.engine.disableWebGL2Support,
      adaptToDeviceRatio: templateConfig.rendering.engine.adaptToDeviceRatio,
    });
  }

  async _setPhysics(): Promise<void> {
    const { default: HavokPhysics } = await import("@babylonjs/havok");
    const hk = await HavokPhysics();
    const plugin = new HavokPlugin(true, hk);
    // Physics registered against raceScene — menu does not require physics.
    this.raceScene.enablePhysics(new Vector3(0, -9.81, 0), plugin);
  }

  /**
   * Add a minimal ArcRotateCamera to a scene.
   *
   * Babylon.js requires at least one camera per scene to render without
   * throwing "No camera defined". These placeholders are replaced by
   * proper cameras in Story 003 (Camera) and Story 005b (GSM Orchestration).
   */
  private _addPlaceholderCamera(scene: Scene): void {
    const camera = new ArcRotateCamera(
      "placeholder",
      -Math.PI / 2,
      Math.PI / 2.5,
      12,
      Vector3.Zero(),
      scene
    );
    camera.minZ = 0.1;
    // Do not attach controls — this is a placeholder, not user-controlled
  }

  /**
   * Start the render loop.
   *
   * Pipeline drives from `engine.runRenderLoop()` (ADR-0002), NOT from
   * `scene.onBeforeRenderObservable`. The active scene is obtained from
   * AssetManager, which controls which scene renders per frame.
   */
  private _render(): void {
    this.engine.runRenderLoop(() =>
      this.assetManager.getActiveScene().render()
    );
    window.addEventListener("resize", () => this.engine.resize());
  }
}

new App();
