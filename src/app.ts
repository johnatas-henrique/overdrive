import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { Vector3 } from "@babylonjs/core/Maths/math";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { Scene } from "@babylonjs/core/scene";
import "@babylonjs/core/Physics/joinedPhysicsEngineComponent";
import "@babylonjs/core/Materials/Textures/cubeTexture";
import "@babylonjs/core/Materials/Textures/Loaders/envTextureLoader";
import { templateConfig } from "./config/template-config";
import { CreateMainScene } from "./playground/main-scene";

class App {
  public engine!: Engine | WebGPUEngine;
  public scene!: Scene;
  private readonly canvas: HTMLCanvasElement;

  constructor() {
    this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    void this._bootstrap();
  }

  private async _bootstrap(): Promise<void> {
    this.engine = await this._createEngine();
    this.scene = new Scene(this.engine);
    await this._setPhysics();

    // ── Event Bus (shared across all systems) ─────────────────────
    // Created before CreateMainScene so game systems can use it
    // during their own initialisation (D-013 — EventBus creation order).
    const { EventBus } = await import("@/foundation/event-bus/event-bus");
    const eventBus = new EventBus();
    eventBus.init();

    await CreateMainScene(this.scene, eventBus);

    // ── Dev Tools (tree-shaken in production) ─────────────────────
    if (import.meta.env.DEV) {
      const { initDevTools } = await import("./core/dev-tools");
      const {
        getPlaygroundGsm,
        getPlaygroundSnapshot,
        getPlaygroundAiTelemetry,
      } = await import("./playground/main-scene");
      const gsm = getPlaygroundGsm();
      const simulationSnapshot = getPlaygroundSnapshot();
      const aiTelemetry = getPlaygroundAiTelemetry;
      await initDevTools(
        this.engine,
        this.scene,
        eventBus,
        gsm ?? undefined,
        simulationSnapshot ?? undefined,
        aiTelemetry
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
    this.scene.enablePhysics(new Vector3(0, -9.81, 0), plugin);
  }

  private _render(): void {
    this.engine.runRenderLoop(() => this.scene.render());
    window.addEventListener("resize", () => this.engine.resize());
  }
}

new App();
