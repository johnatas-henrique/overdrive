import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4, Vector3 } from "@babylonjs/core/Maths/math";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import type { Scene } from "@babylonjs/core/scene";
import { templateConfig } from "../config/template-config";
import {
  ConfigManager,
  setConfigManager,
} from "../foundation/config/config-manager";
import type { IEventBus } from "../foundation/event-bus";
import { GameStateMachine } from "../foundation/gsm/GameStateMachine";
import type { ISnapshotable } from "../foundation/simulation-snapshot";
import { fnv1a, SimulationSnapshot } from "../foundation/simulation-snapshot";
import { CreateSceneGUI } from "./gui";

/** Singleton GSM instance for Dev Tools testing (Story 006) */
let _gsm: GameStateMachine | null = null;

/** Singleton SimulationSnapshot instance for Dev Tools testing (Story 007) */
let _snapshot: SimulationSnapshot | null = null;

/** Get the playground GSM instance (or null if not initialized) */
export const getPlaygroundGsm = (): GameStateMachine | null => _gsm;

/** Get the playground SimulationSnapshot instance (or null if not initialized) */
export const getPlaygroundSnapshot = (): SimulationSnapshot | null => _snapshot;

/**
 * Get the playground AI telemetry reader function.
 *
 * Returns the mock telemetry function. Replace with a real aggregated reader
 * when Physics, RaceManager, and AI Driver systems are implemented.
 */
export { getMockAiTelemetry as getPlaygroundAiTelemetry } from "./ai-telemetry-mock";

/**
 * Minimal ISnapshotable implementation for playground testing.
 *
 * Stores a flat record of state and provides deterministic FNV-1a hashing.
 */
class PlaygroundSnapshotSystem implements ISnapshotable {
  readonly systemId: string;
  private _state: Record<string, unknown>;

  constructor(systemId: string, state?: Record<string, unknown>) {
    this.systemId = systemId;
    this._state = state ? JSON.parse(JSON.stringify(state)) : {};
  }

  serialize(): Record<string, unknown> {
    return JSON.parse(JSON.stringify(this._state));
  }

  deserialize(state: Record<string, unknown>): void {
    this._state = JSON.parse(JSON.stringify(state));
  }

  hash(state?: Record<string, unknown>): string {
    const data = state ?? this._state;
    return fnv1a(JSON.stringify(data));
  }
}

export const CreateMainScene = async (
  scene: Scene,
  eventBus?: IEventBus
): Promise<void> => {
  scene.clearColor = new Color4(0.05, 0.05, 0.08, 1);

  const camera = new ArcRotateCamera(
    "camera",
    -Math.PI / 2,
    Math.PI / 2.5,
    12,
    Vector3.Zero(),
    scene
  );
  camera.attachControl(true);

  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
  light.intensity = 0.7;

  if (templateConfig.features.pipeline) {
    new DefaultRenderingPipeline("defaultPipeline", true, scene);
  }

  const ground = MeshBuilder.CreateGround(
    "ground",
    { width: 10, height: 10 },
    scene
  );
  const groundMat = new StandardMaterial("groundMat", scene);
  groundMat.diffuseColor = new Color3(0.22, 0.24, 0.3);
  ground.material = groundMat;

  if (templateConfig.features.physics) {
    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene);
  }

  const sphere = MeshBuilder.CreateSphere("sphere", { diameter: 1.5 }, scene);
  sphere.position = new Vector3(0, 3, 0);
  const sphereMat = new StandardMaterial("sphereMat", scene);
  sphereMat.diffuseColor = new Color3(0.8, 0.2, 0.2);
  sphere.material = sphereMat;

  if (templateConfig.features.physics) {
    new PhysicsAggregate(sphere, PhysicsShapeType.SPHERE, { mass: 1 }, scene);
  }

  if (templateConfig.features.gui) {
    await CreateSceneGUI(scene);
  }

  // Initialize ConfigManager for Dev Tools testing (reload key, config tree)
  if (import.meta.env.DEV) {
    try {
      const cm = new ConfigManager();
      cm.init();
      setConfigManager(cm);

      // Register test config keys for AC-9 performance verification
      const testNamespace = "test";
      const testConfig: Record<string, number | string | boolean> = {};
      for (let i = 0; i < 120; i++) {
        testConfig[`key_${i}`] =
          i % 3 === 0 ? `value_${i}` : i % 3 === 1 ? i * 0.1 : i % 2 === 0;
      }
      cm.register(testNamespace, testConfig);
    } catch {
      // ConfigManager may already be initialized
    }

    // Initialize GameStateMachine for Dev Tools GSM History tab (Story 006)
    try {
      _gsm = new GameStateMachine(eventBus);
      _gsm.init();
    } catch {
      // GameStateMachine may already be initialized
    }

    // Initialize SimulationSnapshot for Dev Tools Sim Snapshot tab (Story 007)
    try {
      const ss = new SimulationSnapshot();
      ss.init();
      ss.register(
        new PlaygroundSnapshotSystem("physics", { speed: 120, rpm: 6500 })
      );
      ss.register(
        new PlaygroundSnapshotSystem("fuel", { level: 85.3, maxCapacity: 100 })
      );
      ss.register(
        new PlaygroundSnapshotSystem("tire", {
          temps: [90, 92, 88, 91],
          wear: 0.25,
        })
      );
      ss.register(
        new PlaygroundSnapshotSystem("ai", {
          difficulty: 1.0,
          behavior: "aggressive",
        })
      );
      _snapshot = ss;
    } catch {
      // SimulationSnapshot may already be initialized
    }
  }
};
