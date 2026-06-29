/**
 * @fileoverview Dev Tools entry point — tree-shaken in production builds.
 *
 * All Dev Tools code is guarded by `import.meta.env.DEV`, which Vite
 * evaluates at compile time: `true` in dev, `false` in production.
 * The minifier eliminates dead code when the guard is `false`, producing
 * zero bytes for the entire Dev Tools module tree in production bundles.
 *
 * This guard is testable at runtime via `vi.stubEnv("DEV", false)`,
 * unlike the compile-time `__DEV__` constant which cannot be stubbed.
 *
 * ## Usage
 *
 * ```typescript
 * import { initDevTools, devTools } from "@/core/dev-tools";
 *
 * if (import.meta.env.DEV) {
 *   await initDevTools(engine, scene, eventBus);
 *
 *   // Later, from keybind handler (Story 002):
 *   devTools.toggle();
 * }
 * ```
 *
 * @see TR-DVT-001 — HTML overlay rendering above 3D viewport
 * @see TR-DVT-006 — Tree-shaken in production via DEV guard
 * @see ADR-0009 — Dev Tools Architecture
 * @see Control Manifest D-G1 — Zero bytes in production build
 */

// Type-only import+export — zero runtime cost, consumed by Stories 002-008
import type { AiTelemetryCarData, IDevTools } from "./types";

export type { AiTelemetryCarData, IDevTools };

// Side-effect marker for compile guard verification (Story 001).
// Tests assert this was called to prove the DEV guard block executes.
if (import.meta.env.DEV) {
  (globalThis as Record<string, unknown>).__DEV_TOOLS_LOADED__ = true;
}

// ---------------------------------------------------------------------------
// Singleton — must be initialised via initDevTools() before use
// Uses dynamic import() inside the guard to keep the module tree-shakeable.
// ---------------------------------------------------------------------------

let _instance: IDevTools | null = null;
let _initializing = false;

/**
 * Initialize the Dev Tools singleton with the game's engine, scene,
 * optional Event Bus for the Event Log tab panel, optional Game
 * State Machine for the GSM History tab panel, and optional
 * SimulationSnapshot for the Sim Snapshot tab panel.
 *
 * Must be called once during startup (behind `import.meta.env.DEV`).
 * Safe to call multiple times — subsequent calls are no-ops.
 *
 * @param engine  — The Babylon.js Engine instance (Engine or WebGPUEngine)
 * @param scene   — The active Babylon.js Scene instance
 * @param eventBus — Optional Event Bus instance for the Event Log tab (Story 005)
 * @param gsm     — Optional GameStateMachine instance for the GSM History tab (Story 006)
 * @param simulationSnapshot — Optional SimulationSnapshot instance for the Sim Snapshot tab (Story 007)
 * @param aiTelemetry — Optional AI telemetry reader for the AI Telemetry tab (Story 008)
 */
export async function initDevTools(
  engine: import("@babylonjs/core/Engines/abstractEngine").AbstractEngine,
  scene: import("@babylonjs/core/scene").Scene,
  eventBus?: import("@/foundation/event-bus/types").IEventBus,
  gsm?: import("@/foundation/gsm/GameStateMachine").GameStateMachine,
  simulationSnapshot?: import("@/foundation/simulation-snapshot/simulation-snapshot").SimulationSnapshot,
  aiTelemetry?: () => AiTelemetryCarData[]
): Promise<void> {
  if (!import.meta.env.DEV) return;
  if (_instance || _initializing) return;

  // Set initializing flag before the dynamic import to serialise
  // concurrent calls (D-007 race condition fix): a second call
  // that arrives while import() is pending sees _initializing === true.
  _initializing = true;

  const { DevTools } = await import("./dev-tools");
  _instance = new DevTools(engine, scene);

  // Inject the Event Bus for the Event Log tab (Story 005)
  if (eventBus) {
    _instance.setEventBus(eventBus);
  }

  // Inject the Game State Machine for the GSM History tab (Story 006)
  if (gsm) {
    _instance.setGsm(gsm);
  }

  // Inject SimulationSnapshot for the Sim Snapshot tab (Story 007)
  if (simulationSnapshot) {
    _instance.setSimulationSnapshot(simulationSnapshot);
  }

  // Inject AI Telemetry reader for the AI Telemetry tab (Story 008)
  if (aiTelemetry) {
    _instance.setAiTelemetry(aiTelemetry);
  }

  // Set up keyboard keybinds for the dev tools overlay (Story 002)
  const { initKeybinds } = await import("./keybinds");
  initKeybinds();
}

/**
 * Return the initialized Dev Tools instance.
 *
 * @throws {Error} If `initDevTools()` has not been called
 */
export function getDevTools(): IDevTools {
  if (!_instance) {
    throw new Error(
      "DevTools not initialized. Call initDevTools(engine, scene) first."
    );
  }
  return _instance;
}

/**
 * Reset the singleton state for testing purposes.
 *
 * Sets `_instance` and `_initializing` to their initial values,
 * allowing `initDevTools()` to be called again without re-importing
 * the entire module tree via `vi.resetModules()`.
 *
 * DEV-only — tree-shaken in production builds.
 *
 * @internal Only for test use.
 */
export function _resetDevToolsForTesting(): void {
  if (!import.meta.env.DEV) return;
  _instance?.dispose();
  _instance = null;
  _initializing = false;
}

/**
 * Proxy for the Dev Tools singleton.
 *
 * Allows static `import { devTools }` before `initDevTools()` is called.
 * Property access throws a clear error if accessed before initialization.
 *
 * @example
 * ```typescript
 * import { devTools } from "@/core/dev-tools";
 *
 * // Safe: passes a reference, no property accessed yet
 * document.addEventListener("keydown", (e) => {
 *   if (e.key === DEV_TOOLS_KEYS.toggle) devTools.toggle(); // throws if not initialized
 * });
 * ```
 */
export const devTools = new Proxy<IDevTools>({} as IDevTools, {
  get(_, prop: string | symbol) {
    if (!_instance) {
      throw new Error(
        "DevTools not initialized. Call initDevTools(engine, scene) first."
      );
    }
    const value = (_instance as unknown as Record<string | symbol, unknown>)[
      prop
    ];
    return typeof value === "function" ? value.bind(_instance) : value;
  },
});
