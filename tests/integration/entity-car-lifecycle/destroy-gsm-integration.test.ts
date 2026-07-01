// @vitest-environment node
/**
 * Integration tests for EntityLifecycle: destroyAll, GSM integration, and dispose.
 *
 * Covers AC-5 through AC-8, GSM-1, GSM-2, and IDEMPOTENT from Story 002.
 *
 * @see ADR-0005 — Entity/Car Lifecycle & State Ownership
 * @see TR-ECL-003 — destroyAll() implementation
 * @see TR-ECL-008 — GSM integration
 * @see TR-ECL-009 — dispose() teardown
 */

import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EntityLifecycle } from "@/entity-car-lifecycle/entity-lifecycle";
import {
  EntityLifecycleError,
  type GridConfig,
} from "@/entity-car-lifecycle/types";
import { EventBus } from "@/foundation/event-bus/event-bus";

// Mock PhysicsAggregate module BEFORE any value imports so that
// EntityLifecycle (which imports PhysicsAggregate as a value) gets
// the mock instead of the real Babylon.js Havok-dependent class.
vi.mock("@babylonjs/core/Physics/v2/physicsAggregate", () => {
  // biome-ignore lint/complexity/useArrowFunction: must be function expression for constructor behavior
  const PhysicsAggregate = vi.fn(function () {
    return {
      body: { dispose: vi.fn() },
      dispose: vi.fn(),
    };
  });
  return { PhysicsAggregate };
});

// These imports must come AFTER vi.mock because the mock is hoisted
// by Vitest and the real module would otherwise be cached first.
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { Scene as BabylonScene } from "@babylonjs/core/scene";

// ── Helpers ──────────────────────────────────────────────────

/** A representative 8-team grid. Player is at pole position (team[0]). */
const GRID_8_CARS: GridConfig = {
  teams: [
    { teamId: "macklen", driverProfile: "balanced" },
    { teamId: "willard", driverProfile: "aggressive" },
    { teamId: "stark", driverProfile: "defensive" },
    { teamId: "redbull", driverProfile: "aggressive" },
    { teamId: "ferrari", driverProfile: "balanced" },
    { teamId: "mercedes", driverProfile: "defensive" },
    { teamId: "aston", driverProfile: "aggressive" },
    { teamId: "alphine", driverProfile: "balanced" },
  ],
  playerTeamId: "macklen",
};

/** Shape of each instantiation entry for tracking dispose spies. */
interface InstantiationEntry {
  rootNodes: TransformNode[];
  particleSystems: never[];
  skeletons: never[];
  animationGroups: never[];
  dispose: ReturnType<typeof vi.fn>;
}

/**
 * Create an engine suitable for integration tests.
 * NullEngine provides deterministic, no-GPU scene operations.
 */
function createEngine(): NullEngine {
  return new NullEngine({
    renderWidth: 1,
    renderHeight: 1,
    textureSize: 1,
    deterministicLockstep: false,
    lockstepMaxSteps: 4,
  });
}

// ── Test Suite ───────────────────────────────────────────────

describe("EntityLifecycle — Destroy & GSM Integration", () => {
  let engine: NullEngine;
  let scene: Scene;
  let eventBus: EventBus;
  let lifecycle: EntityLifecycle;
  let mockContainer: AssetContainer;
  /** Tracks each instantiation entry returned by the mock container. */
  let spawnEntries: InstantiationEntry[];

  beforeEach(() => {
    vi.clearAllMocks();

    engine = createEngine();
    scene = new BabylonScene(engine);

    eventBus = new EventBus();
    eventBus.init();

    lifecycle = new EntityLifecycle();
    spawnEntries = [];

    // Build a mock AssetContainer that returns a fresh car clone each time
    // and tracks each result in spawnEntries for dispose verification.
    mockContainer = {
      instantiateModelsToScene: vi.fn().mockImplementation(() => {
        const rootNode = new TransformNode("car_root", scene);
        const chassisMesh = new Mesh("chassis", scene);
        chassisMesh.setVerticesData("position", [0, 0, 0, 1, 0, 0, 0, 1, 0]);
        chassisMesh.parent = rootNode;
        const entry: InstantiationEntry = {
          rootNodes: [rootNode],
          particleSystems: [],
          skeletons: [],
          animationGroups: [],
          dispose: vi.fn(),
        };
        spawnEntries.push(entry);
        return entry;
      }),
    } as unknown as AssetContainer;
  });

  // ═════════════════════════════════════════════════════════════
  //  AC-5: destroyAll cleanup
  // ═════════════════════════════════════════════════════════════

  describe("AC-5: destroyAll cleanup", () => {
    it("disposes physics bodies, emits despawned, clears map, transitions to Idle", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      // Track despawn events
      const despawned: string[] = [];
      eventBus.on("entity.despawned", (p) => despawned.push(p.carId));

      // Capture aggregate references before destroy
      const mockAggregates = vi.mocked(PhysicsAggregate).mock.results;

      lifecycle.destroyAll();

      // State and map cleaned
      expect(lifecycle.state).toBe("Idle");
      expect(lifecycle.entityCount).toBe(0);
      expect(lifecycle.activeBodyCount).toBe(0);

      // 8 despawn events emitted (reverse order per ADR-0005)
      expect(despawned).toHaveLength(8);
      // Reverse iteration first emits the last added car (ai_6)
      expect(despawned[0]).toBe("ai_6");
      // Last emitted is the first added car (player)
      expect(despawned[7]).toBe("player");

      // Each aggregate's dispose was called exactly once
      for (const result of mockAggregates) {
        expect(result.value.dispose).toHaveBeenCalledTimes(1);
      }

      // Each mesh entry was disposed
      expect(spawnEntries).toHaveLength(8);
      for (const entry of spawnEntries) {
        expect(entry.dispose).toHaveBeenCalledTimes(1);
      }
    });

    it("emits entity.despawned with correct car IDs", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      const despawned: string[] = [];
      eventBus.on("entity.despawned", (p) => despawned.push(p.carId));

      lifecycle.destroyAll();

      // All 8 car IDs are represented (order doesn't matter for this assertion)
      expect(despawned).toEqual(
        expect.arrayContaining([
          "player",
          "ai_0",
          "ai_1",
          "ai_2",
          "ai_3",
          "ai_4",
          "ai_5",
          "ai_6",
        ])
      );
      // Exactly 8 events
      expect(despawned).toHaveLength(8);
    });

    it("destroyAll while Idle is a silent no-op", () => {
      lifecycle.init(eventBus, scene);
      // No spawnGrid call — lifecycle is in Idle

      expect(() => lifecycle.destroyAll()).not.toThrow();
      expect(lifecycle.state).toBe("Idle");
      expect(lifecycle.entityCount).toBe(0);
    });

    it("destroyAll before init is a silent no-op", () => {
      // lifecycle is Uninitialized

      expect(() => lifecycle.destroyAll()).not.toThrow();
      expect(lifecycle.state).toBe("Uninitialized");
    });

    it("despawn event order does not affect physics body dispose count", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      const mockAggregates = vi.mocked(PhysicsAggregate).mock.results;

      lifecycle.destroyAll();

      // All 8 aggregates disposed exactly once regardless of iteration order
      expect(mockAggregates).toHaveLength(8);
      const disposeCounts = mockAggregates.map(
        (r) => r.value.dispose.mock.calls.length
      );
      expect(disposeCounts).toEqual(Array(8).fill(1));
    });
  });

  // ═════════════════════════════════════════════════════════════
  //  AC-6: getEntity after destroy
  // ═════════════════════════════════════════════════════════════

  describe("AC-6: getEntity after destroy", () => {
    it("returns undefined for all car IDs after destroyAll", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      lifecycle.destroyAll();

      expect(lifecycle.getEntity("player")).toBeUndefined();
      expect(lifecycle.getEntity("ai_0")).toBeUndefined();
      expect(lifecycle.getEntity("ai_6")).toBeUndefined();
      expect(lifecycle.getEntity("nonexistent")).toBeUndefined();
    });

    it("returns undefined after destroyAll (entity map empty)", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      lifecycle.destroyAll();

      // After destroy, getEntity returns undefined because entity map is empty
      expect(lifecycle.getEntity("player")).toBeUndefined();
      expect(lifecycle.getEntity("ai_0")).toBeUndefined();
    });
  });

  // ═════════════════════════════════════════════════════════════
  //  AC-8: Event received by downstream
  // ═════════════════════════════════════════════════════════════

  describe("AC-8: entity.spawned events", () => {
    it("emits entity.spawned for all 8 cars during manual spawn", () => {
      lifecycle.init(eventBus, scene);

      const spawned: Array<{
        carId: string;
        teamId: string;
        gridIndex: number;
      }> = [];
      eventBus.on("entity.spawned", (p) => spawned.push(p));

      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      // All 8 cars spawned
      expect(spawned).toHaveLength(8);

      // Player car event
      expect(spawned[0]).toEqual({
        carId: "player",
        teamId: "macklen",
        gridIndex: 0,
      });

      // AI car events
      expect(spawned[1]).toEqual({
        carId: "ai_0",
        teamId: "willard",
        gridIndex: 1,
      });
      expect(spawned[7]).toEqual({
        carId: "ai_6",
        teamId: "alphine",
        gridIndex: 7,
      });
    });

    it("verifies spawned AND despawned events are paired per car", () => {
      lifecycle.init(eventBus, scene);

      const spawned: string[] = [];
      const despawned: string[] = [];
      eventBus.on("entity.spawned", (p) => spawned.push(p.carId));
      eventBus.on("entity.despawned", (p) => despawned.push(p.carId));

      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);
      lifecycle.destroyAll();

      // Same set of car IDs — every spawned car is despawned
      expect(spawned.sort()).toEqual(despawned.sort());
      expect(spawned).toHaveLength(8);
    });

    it("emits entity.spawned during GSM-triggered auto-spawn", () => {
      lifecycle.init(eventBus, scene);

      // First, do an initial spawn/destroy cycle to store container/config
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);
      lifecycle.destroyAll();

      // Now subscribe and trigger auto-spawn via GSM
      const spawned: Array<{
        carId: string;
        teamId: string;
        gridIndex: number;
      }> = [];
      eventBus.on("entity.spawned", (p) => spawned.push(p));

      eventBus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });

      // Events emitted for all 8 cars
      expect(spawned).toHaveLength(8);
      expect(spawned[0].carId).toBe("player");
      expect(spawned[0].gridIndex).toBe(0);
    });
  });

  // ═════════════════════════════════════════════════════════════
  //  GSM-1: PreRace auto-spawn
  // ═════════════════════════════════════════════════════════════

  describe("GSM-1: PreRace auto-spawn", () => {
    it("auto-spawns grid on PreRace state entry when container/config stored", () => {
      lifecycle.init(eventBus, scene);

      // Store container/config via manual spawn, then destroy
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);
      lifecycle.destroyAll();
      expect(lifecycle.state).toBe("Idle");

      // Trigger GSM PreRace
      eventBus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });

      // Grid was auto-spawned
      expect(lifecycle.state).toBe("GridActive");
      expect(lifecycle.entityCount).toBe(8);
      expect(lifecycle.getEntity("player")).toBeDefined();
      expect(lifecycle.getEntity("ai_0")).toBeDefined();
      expect(lifecycle.getEntity("ai_6")).toBeDefined();
    });

    it("auto-spawn reuses stored container and config for subsequent cycles", () => {
      lifecycle.init(eventBus, scene);

      // First cycle: manual spawn → auto-destroy via GSM
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);
      eventBus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });
      expect(lifecycle.state).toBe("Idle");

      // Second cycle: PreRace auto-spawn
      eventBus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });
      expect(lifecycle.state).toBe("GridActive");
      expect(lifecycle.entityCount).toBe(8);

      // Verify entities are fresh (player exists with correct data)
      const player = lifecycle.getEntity("player");
      expect(player).toBeDefined();
      expect(player?.teamId).toBe("macklen");
      expect(player?.aiDriver).toBeUndefined();
    });

    it("is a silent no-op on PreRace when no container/config stored", () => {
      lifecycle.init(eventBus, scene);
      // No prior spawnGrid — no stored container/config

      eventBus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });

      // State unchanged (still Idle)
      expect(lifecycle.state).toBe("Idle");
      expect(lifecycle.entityCount).toBe(0);
    });

    it("does not auto-spawn on non-PreRace states", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);
      lifecycle.destroyAll();

      // Emit unrelated state transitions
      eventBus.emit("gsm.state.entered", { from: "Loading", to: "Menu" });
      eventBus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });
      eventBus.emit("gsm.state.entered", { from: "Paused", to: "Racing" });

      // State should still be Idle (no PreRace emit)
      expect(lifecycle.state).toBe("Idle");
      expect(lifecycle.entityCount).toBe(0);
    });
  });

  // ═════════════════════════════════════════════════════════════
  //  GSM-2: PostRace auto-destroy
  // ═════════════════════════════════════════════════════════════

  describe("GSM-2: PostRace auto-destroy", () => {
    it("auto-destroys grid on PostRace state entry", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      expect(lifecycle.state).toBe("GridActive");

      eventBus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });

      expect(lifecycle.state).toBe("Idle");
      expect(lifecycle.entityCount).toBe(0);
      expect(lifecycle.activeBodyCount).toBe(0);
    });

    it("emits entity.despawned during GSМ-triggered destroy", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      const despawned: string[] = [];
      eventBus.on("entity.despawned", (p) => despawned.push(p.carId));

      eventBus.emit("gsm.state.entered", { from: "Racing", to: "PostRace" });

      expect(despawned).toHaveLength(8);
      // Reverse iteration order
      expect(despawned[0]).toBe("ai_6");
    });

    it("does not destroy on non-PostRace states", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      // Emit unrelated transitions
      eventBus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" }); // already GridActive — spawn would throw but handler guards via state assertion inside spawnGrid
      eventBus.emit("gsm.state.entered", { from: "PreRace", to: "Racing" });

      // Should still be GridActive
      expect(lifecycle.state).toBe("GridActive");
      expect(lifecycle.entityCount).toBe(8);
    });
  });

  // ═════════════════════════════════════════════════════════════
  //  IDEMPOTENT: double destroy
  // ═════════════════════════════════════════════════════════════

  describe("IDEMPOTENT: double destroy", () => {
    it("second destroyAll call is a no-op (no errors, no events)", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      lifecycle.destroyAll();
      expect(lifecycle.state).toBe("Idle");

      // Track despawn events during second call
      const secondDespawns: string[] = [];
      eventBus.on("entity.despawned", (p) => secondDespawns.push(p.carId));

      // Second call must be a complete no-op
      expect(() => lifecycle.destroyAll()).not.toThrow();
      expect(secondDespawns).toHaveLength(0);
      expect(lifecycle.state).toBe("Idle");
      expect(lifecycle.entityCount).toBe(0);
      expect(lifecycle.activeBodyCount).toBe(0);
    });

    it("third call is also a no-op (idempotent beyond double)", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      lifecycle.destroyAll(); // first
      lifecycle.destroyAll(); // second
      lifecycle.destroyAll(); // third

      expect(lifecycle.state).toBe("Idle");
      expect(lifecycle.entityCount).toBe(0);
    });

    it("physics body dispose not called on second destroy", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      const mockAggregates = vi.mocked(PhysicsAggregate).mock.results;

      lifecycle.destroyAll();

      // Each aggregate was disposed exactly once (from first call)
      for (const result of mockAggregates) {
        expect(result.value.dispose).toHaveBeenCalledTimes(1);
      }

      lifecycle.destroyAll();

      // Still exactly once (second call is no-op)
      for (const result of mockAggregates) {
        expect(result.value.dispose).toHaveBeenCalledTimes(1);
      }
    });
  });

  // ═════════════════════════════════════════════════════════════
  //  dispose()
  // ═════════════════════════════════════════════════════════════

  describe("dispose()", () => {
    it("transitions to Disposed state", () => {
      lifecycle.init(eventBus, scene);

      lifecycle.dispose();

      expect(lifecycle.state).toBe("Disposed");
    });

    it("cleans up subscriptions — no leaked handlers after dispose", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      lifecycle.dispose();

      // After dispose, no GSM subscription remains to react
      // (we verify by emitting PreRace and checking state)
      eventBus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });

      // State remains Disposed, proving the handler was unsubscribed
      expect(lifecycle.state).toBe("Disposed");
    });

    it("cleans up physics bodies and mesh entries when disposed mid-race", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      const mockAggregates = vi.mocked(PhysicsAggregate).mock.results;

      lifecycle.dispose();

      // Physics aggregates were disposed
      for (const result of mockAggregates) {
        expect(result.value.dispose).toHaveBeenCalledTimes(1);
      }

      // Mesh entries were disposed
      for (const entry of spawnEntries) {
        expect(entry.dispose).toHaveBeenCalledTimes(1);
      }

      expect(lifecycle.state).toBe("Disposed");
    });

    it("is idempotent — second dispose does not throw", () => {
      lifecycle.init(eventBus, scene);

      lifecycle.dispose();
      expect(() => lifecycle.dispose()).not.toThrow();
      expect(lifecycle.state).toBe("Disposed");
    });

    it("spawnGrid after dispose throws with clear message", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.dispose();

      expect(() => lifecycle.spawnGrid(mockContainer, GRID_8_CARS)).toThrow(
        EntityLifecycleError
      );
      expect(() => lifecycle.spawnGrid(mockContainer, GRID_8_CARS)).toThrow(
        "Lifecycle is disposed — create a new instance"
      );
    });

    it("init after dispose throws with clear message", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.dispose();

      expect(() => lifecycle.init(eventBus, scene)).toThrow(
        EntityLifecycleError
      );
      expect(() => lifecycle.init(eventBus, scene)).toThrow(
        "Cannot init() from state 'Disposed'"
      );
    });

    it("destroyAll after dispose is a no-op", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);
      lifecycle.dispose();

      expect(() => lifecycle.destroyAll()).not.toThrow();
      expect(lifecycle.state).toBe("Disposed");

      // Physics body dispose count should still be 1 (from dispose, not destroyAll)
      const mockAggregates = vi.mocked(PhysicsAggregate).mock.results;
      for (const result of mockAggregates) {
        expect(result.value.dispose).toHaveBeenCalledTimes(1);
      }
    });
  });

  // ═════════════════════════════════════════════════════════════
  //  Edge Cases: Full lifecycle cycles
  // ═════════════════════════════════════════════════════════════

  describe("Full lifecycle cycles", () => {
    it("getEntity returns undefined after destroyAll (entity map empty)", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      lifecycle.destroyAll();

      // After destroyAll, entity map is empty
      expect(lifecycle.getEntity("player")).toBeUndefined();
      expect(lifecycle.getEntity("ai_0")).toBeUndefined();
    });

    it("GSM-triggered PreRace after destroy is allowed (full cycle)", () => {
      lifecycle.init(eventBus, scene);

      // Full cycle: spawn → destroy → GSM PreRace → spawn
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);
      lifecycle.destroyAll();
      expect(lifecycle.state).toBe("Idle");

      // Reset mock call count so we can verify new spawn
      vi.clearAllMocks();
      spawnEntries.length = 0;

      // Trigger GSM PreRace
      eventBus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" });

      // New grid was spawned with fresh entities
      expect(lifecycle.state).toBe("GridActive");
      expect(lifecycle.entityCount).toBe(8);
      expect(vi.mocked(PhysicsAggregate).mock.calls).toHaveLength(8);
    });
  });

  // ═════════════════════════════════════════════════════════════
  //  QA Review: Additional Coverage Gaps
  // ═════════════════════════════════════════════════════════════

  describe("PhysicsAggregate constructor args", () => {
    it("creates aggregate with CONVEX_HULL shape and 800 kg mass", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      const {
        PhysicsShapeType,
      } = require("@babylonjs/core/Physics/v2/IPhysicsEnginePlugin");

      // Verify each of the 8 PhysicsAggregate calls
      const calls = vi.mocked(PhysicsAggregate).mock.calls;
      expect(calls).toHaveLength(8);

      for (const call of calls) {
        // arg[0] = transformNode, arg[1] = shape type, arg[2] = options, arg[3] = scene
        expect(call[1]).toBe(PhysicsShapeType.CONVEX_HULL);
        expect(call[2]).toMatchObject({ mass: 800 });
      }
    });
  });

  describe("CarEntity property correctness", () => {
    it("player car has correct ID, teamId, gridIndex, and no aiDriver", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      const player = lifecycle.getEntity("player");
      expect(player).toBeDefined();
      expect(player?.id).toBe("player");
      expect(player?.teamId).toBe("macklen");
      expect(player?.gridIndex).toBe(0);
      expect(player?.aiDriver).toBeUndefined();
      expect(player?.mesh).toBeDefined();
      expect(player?.physicsBody).toBeDefined();
    });

    it("AI cars have correct IDs, teamIds, gridIndices, and aiDriver", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      for (let i = 0; i < 7; i++) {
        const aiCar = lifecycle.getEntity(`ai_${i}`);
        expect(aiCar).toBeDefined();
        expect(aiCar?.id).toBe(`ai_${i}`);
        expect(aiCar?.teamId).toBe(GRID_8_CARS.teams[i + 1].teamId);
        expect(aiCar?.gridIndex).toBe(i + 1);
        expect(aiCar?.aiDriver).toEqual({
          teamId: GRID_8_CARS.teams[i + 1].teamId,
          driverProfile: GRID_8_CARS.teams[i + 1].driverProfile,
        });
      }
    });
  });

  describe("State machine error paths", () => {
    it("double init throws EntityLifecycleError", () => {
      lifecycle.init(eventBus, scene);

      expect(() => lifecycle.init(eventBus, scene)).toThrow(
        EntityLifecycleError
      );
      expect(() => lifecycle.init(eventBus, scene)).toThrow(
        "Cannot init() from state 'Idle'"
      );
    });

    it("spawnGrid from GridActive throws 'Grid already active'", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      expect(() => lifecycle.spawnGrid(mockContainer, GRID_8_CARS)).toThrow(
        EntityLifecycleError
      );
      expect(() => lifecycle.spawnGrid(mockContainer, GRID_8_CARS)).toThrow(
        "Grid already active"
      );
    });
  });

  describe("Stored container/config inspection", () => {
    it("stores and exposes container after spawnGrid", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      expect(lifecycle.getStoredContainer()).toBe(mockContainer);
      expect(lifecycle.getStoredGridConfig()).toEqual(GRID_8_CARS);
    });

    it("clears stored container/config after dispose", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      lifecycle.dispose();

      expect(lifecycle.getStoredContainer()).toBeNull();
      expect(lifecycle.getStoredGridConfig()).toBeNull();
    });
  });

  describe("PreRace while GridActive (edge case)", () => {
    it("PreRace emit while GridActive logs error via EventBus isolation (no throw)", () => {
      lifecycle.init(eventBus, scene);
      lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

      // PreRace while GridActive → spawnGrid throws internally
      // EventBus catches the error — verify state is unchanged
      expect(() =>
        eventBus.emit("gsm.state.entered", { from: "Menu", to: "PreRace" })
      ).not.toThrow();

      // GridActive state is preserved (spawnGrid error was caught by EventBus)
      expect(lifecycle.state).toBe("GridActive");
      expect(lifecycle.entityCount).toBe(8);
    });
  });
});
