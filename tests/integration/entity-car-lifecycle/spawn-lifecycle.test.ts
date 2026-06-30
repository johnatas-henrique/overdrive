// @vitest-environment node
/**
 * Integration tests for EntityLifecycle: spawn and lifecycle state machine.
 *
 * Covers AC-1 through AC-5 from Story 001.
 *
 * @see ADR-0005 — Entity/Car Lifecycle & State Ownership
 * @see TR-ECL-001 through TR-ECL-007
 */

import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { Scene as BabylonScene } from "@babylonjs/core/scene";

import { EntityLifecycle } from "@/entity-car-lifecycle/entity-lifecycle";
import {
  EntityLifecycleError,
  type GridConfig,
} from "@/entity-car-lifecycle/types";
import { EventBus } from "@/foundation/event-bus/event-bus";

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

describe("EntityLifecycle", () => {
  let engine: NullEngine;
  let scene: Scene;
  let eventBus: EventBus;
  let lifecycle: EntityLifecycle;
  let mockContainer: AssetContainer;

  beforeEach(() => {
    // Reset mocks for a clean slate each test
    vi.clearAllMocks();

    engine = createEngine();
    scene = new BabylonScene(engine);

    eventBus = new EventBus();
    eventBus.init();

    lifecycle = new EntityLifecycle();

    // Build a mock AssetContainer whose instantiateModelsToScene()
    // returns a fresh car clone each time it is called.
    // Each "clone" has a TransformNode root and a child Mesh with
    // vertex data (simulating a GLB car hierarchy).
    // Aligned with Babylon.js 9.x InstantiatedEntries (rootNodes: Node[]).
    mockContainer = {
      instantiateModelsToScene: vi.fn().mockImplementation(() => {
        const rootNode = new TransformNode("car_root", scene);
        const chassisMesh = new Mesh("chassis", scene);
        // Give the mesh vertex data so _extractChassisMesh finds a geometry.
        chassisMesh.setVerticesData("position", [0, 0, 0, 1, 0, 0, 0, 1, 0]);
        // parent the chassis under root so getChildMeshes finds it
        chassisMesh.parent = rootNode;
        return {
          rootNodes: [rootNode],
          particleSystems: [],
          skeletons: [],
          animationGroups: [],
        };
      }),
    } as unknown as AssetContainer;
  });

  // ── AC-1: init() enters Idle state ──────────────────────────

  it("AC-1: init() transitions to Idle state", () => {
    expect(lifecycle.state).toBe("Uninitialized");

    lifecycle.init(eventBus, scene);

    expect(lifecycle.state).toBe("Idle");
  });

  it("AC-1: init() throws when called a second time", () => {
    lifecycle.init(eventBus, scene);

    expect(() => lifecycle.init(eventBus, scene)).toThrow(EntityLifecycleError);
  });

  // ── AC-2: spawnGrid creates 8 cars ──────────────────────────

  it("AC-2: spawnGrid creates all 8 cars synchronously", () => {
    lifecycle.init(eventBus, scene);

    const spawned: Array<{
      carId: string;
      teamId: string;
      gridIndex: number;
    }> = [];
    eventBus.on("entity.spawned", (p) => spawned.push(p));

    lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

    // State transition
    expect(lifecycle.state).toBe("GridActive");
    expect(lifecycle.entityCount).toBe(8);

    // Unique car IDs
    const ids = [
      "player",
      "ai_0",
      "ai_1",
      "ai_2",
      "ai_3",
      "ai_4",
      "ai_5",
      "ai_6",
    ];
    for (const id of ids) {
      expect(lifecycle.getEntity(id)).toBeDefined();
    }

    // Exactly 8 events emitted
    expect(spawned).toHaveLength(8);

    // Each event has correct carId, teamId, gridIndex
    expect(spawned[0]).toEqual({
      carId: "player",
      teamId: "macklen",
      gridIndex: 0,
    });
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

  it("AC-2: PhysicsAggregate created 8 times with CONVEX_HULL and 800 kg", () => {
    lifecycle.init(eventBus, scene);
    lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

    expect(PhysicsAggregate).toHaveBeenCalledTimes(8);

    // Every call has mass: 800 and the correct shape
    const calls = vi.mocked(PhysicsAggregate).mock.calls;
    for (const call of calls) {
      expect(call[1]).toBe(PhysicsShapeType.CONVEX_HULL);
      expect(call[2]).toMatchObject({ mass: 800 });
    }

    // Because the GLB root is a TransformNode (no geometry), each call
    // should also pass the extracted chassis Mesh via the `mesh` option.
    for (const call of calls) {
      expect(call[2]).toHaveProperty("mesh");
    }
  });

  it("AC-2: each car gets a unique PhysicsAggregate via instantiateModelsToScene", () => {
    lifecycle.init(eventBus, scene);
    lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

    // instantiateModelsToScene called once per car
    const instantiate = mockContainer.instantiateModelsToScene as ReturnType<
      typeof vi.fn
    >;
    expect(instantiate).toHaveBeenCalledTimes(8);

    // 8 distinct meshes and transform nodes created
    const nodeCount = scene.transformNodes.length;
    // 8 root nodes from instantiateModelsToScene + 0 pre-existing
    expect(nodeCount).toBeGreaterThanOrEqual(8);
  });

  // ── AC-3: Player entity ─────────────────────────────────────

  it("AC-3: player entity has mesh, physicsBody, and aiDriver = undefined", () => {
    lifecycle.init(eventBus, scene);
    lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

    const player = lifecycle.getEntity("player");

    expect(player).toBeDefined();
    expect(player?.id).toBe("player");
    expect(player?.teamId).toBe("macklen");
    expect(player?.gridIndex).toBe(0);
    expect(player?.mesh).toBeDefined();
    expect(player?.physicsBody).not.toBeNull();

    // TR-ECL-007: Player car has no AI driver
    expect(player?.aiDriver).toBeUndefined();
  });

  // ── AC-4: AI entities ───────────────────────────────────────

  it("AC-4: AI entities have aiDriver with teamId and driverProfile", () => {
    lifecycle.init(eventBus, scene);
    lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

    // Check a few AI cars across the grid
    const aiCars = [
      { id: "ai_0", teamId: "willard", profile: "aggressive" },
      { id: "ai_1", teamId: "stark", profile: "defensive" },
      { id: "ai_2", teamId: "redbull", profile: "aggressive" },
      { id: "ai_3", teamId: "ferrari", profile: "balanced" },
      { id: "ai_4", teamId: "mercedes", profile: "defensive" },
      { id: "ai_5", teamId: "aston", profile: "aggressive" },
      { id: "ai_6", teamId: "alphine", profile: "balanced" },
    ];

    for (const expected of aiCars) {
      const entity = lifecycle.getEntity(expected.id);
      expect(entity).toBeDefined();
      expect(entity?.teamId).toBe(expected.teamId);
      expect(entity?.gridIndex).toBe(
        GRID_8_CARS.teams.findIndex((t) => t.teamId === expected.teamId)
      );
      expect(entity?.aiDriver).toBeDefined();
      expect(entity?.aiDriver?.teamId).toBe(expected.teamId);
      expect(entity?.aiDriver?.driverProfile).toBe(expected.profile);
    }
  });

  // ── AC-5: Double-spawn guard ────────────────────────────────

  it("AC-5: double-spawn throws EntityLifecycleError", () => {
    lifecycle.init(eventBus, scene);
    lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

    // Second call must throw
    expect(() => lifecycle.spawnGrid(mockContainer, GRID_8_CARS)).toThrow(
      EntityLifecycleError
    );

    // State must remain GridActive (not rolled back)
    expect(lifecycle.state).toBe("GridActive");
    expect(lifecycle.entityCount).toBe(8);
  });

  // ── Edge Cases ──────────────────────────────────────────────

  it("getEntity returns undefined for non-existent carId", () => {
    lifecycle.init(eventBus, scene);

    expect(lifecycle.getEntity("nonexistent")).toBeUndefined();
    expect(lifecycle.getEntity("player")).toBeUndefined();
  });

  it("getEntity returns undefined before init", () => {
    expect(lifecycle.getEntity("player")).toBeUndefined();
  });

  it("chassis extraction: root Mesh with geometry used directly", () => {
    // Override the mock to return a root Mesh with geometry.
    const rootMesh = new Mesh("car_root", scene);
    rootMesh.setVerticesData("position", [0, 0, 0, 1, 0, 0, 0, 1, 0]);

    // rootMesh is the only root node — _resolveRoot picks it, _extractChassisMesh
    // sees it's a Mesh with geometry and returns it directly.
    const standaloneContainer = {
      instantiateModelsToScene: vi.fn().mockReturnValue({
        rootNodes: [rootMesh],
        skeletons: [],
        animationGroups: [],
      }),
    } as unknown as AssetContainer;

    const smallGrid: GridConfig = {
      teams: [{ teamId: "macklen", driverProfile: "balanced" }],
      playerTeamId: "macklen",
    };

    lifecycle.init(eventBus, scene);
    lifecycle.spawnGrid(standaloneContainer, smallGrid);

    // PhysicsAggregate was called with the root Mesh (which has geometry)
    // and should NOT have the `mesh` option (since root has geometry).
    const lastCall =
      vi.mocked(PhysicsAggregate).mock.calls[
        vi.mocked(PhysicsAggregate).mock.calls.length - 1
      ];
    expect(lastCall[2]).toEqual({ mass: 800 });
  });

  it("chassis extraction throws on GLB with no geometry", () => {
    const geometrylessContainer = {
      instantiateModelsToScene: vi.fn().mockReturnValue({
        rootNodes: [new TransformNode("empty_root", scene)],
        skeletons: [],
        animationGroups: [],
      }),
    } as unknown as AssetContainer;

    const singleTeam: GridConfig = {
      teams: [{ teamId: "macklen", driverProfile: "balanced" }],
      playerTeamId: "macklen",
    };

    lifecycle.init(eventBus, scene);
    expect(() =>
      lifecycle.spawnGrid(geometrylessContainer, singleTeam)
    ).toThrow(EntityLifecycleError);
  });

  // ── Additional coverage gaps from code review ──────────────

  it("activeBodyCount returns 8 after spawn", () => {
    lifecycle.init(eventBus, scene);
    lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

    expect(lifecycle.activeBodyCount).toBe(8);
  });

  it("AC-2: event ordering matches grid order", () => {
    lifecycle.init(eventBus, scene);

    const spawned: Array<{
      carId: string;
      teamId: string;
      gridIndex: number;
    }> = [];
    eventBus.on("entity.spawned", (p) => spawned.push(p));

    lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

    // All 8 events must be in grid order (gridIndex 0..7)
    for (let i = 0; i < spawned.length; i++) {
      expect(spawned[i].gridIndex).toBe(i);
    }
  });

  it("double-spawn error message is 'Grid already active'", () => {
    lifecycle.init(eventBus, scene);
    lifecycle.spawnGrid(mockContainer, GRID_8_CARS);

    expect(() => lifecycle.spawnGrid(mockContainer, GRID_8_CARS)).toThrow(
      "Grid already active"
    );
  });

  it("spawnGrid before init throws with 'Uninitialized'", () => {
    const singleTeam: GridConfig = {
      teams: [{ teamId: "macklen", driverProfile: "balanced" }],
      playerTeamId: "macklen",
    };

    expect(() => lifecycle.spawnGrid(mockContainer, singleTeam)).toThrow(
      "Uninitialized"
    );
  });

  it("empty teams array transitions to GridActive with zero entities", () => {
    lifecycle.init(eventBus, scene);

    const emptyGrid: GridConfig = {
      teams: [],
      playerTeamId: "macklen",
    };

    lifecycle.spawnGrid(mockContainer, emptyGrid);

    expect(lifecycle.state).toBe("GridActive");
    expect(lifecycle.entityCount).toBe(0);
    expect(lifecycle.activeBodyCount).toBe(0);
  });

  it("resolveRoot throws when rootNodes is empty", () => {
    const emptyRootContainer = {
      instantiateModelsToScene: vi.fn().mockReturnValue({
        rootNodes: [],
        skeletons: [],
        animationGroups: [],
      }),
    } as unknown as AssetContainer;

    const singleTeam: GridConfig = {
      teams: [{ teamId: "macklen", driverProfile: "balanced" }],
      playerTeamId: "macklen",
    };

    lifecycle.init(eventBus, scene);
    expect(() => lifecycle.spawnGrid(emptyRootContainer, singleTeam)).toThrow(
      "No root node in instantiation result"
    );
  });

  it("chassis extraction: rootNodes contains a Mesh with geometry directly", () => {
    // When the rootNodes array contains a Mesh with geometry directly
    // (not a TransformNode), _extractChassisMesh should find it in
    // the rootNodes scan (step 2) before falling to getChildMeshes.
    const rootMesh = new Mesh("car_root_with_geom", scene);
    rootMesh.setVerticesData("position", [0, 0, 0, 1, 0, 0, 0, 1, 0]);

    const meshContainer = {
      instantiateModelsToScene: vi.fn().mockReturnValue({
        rootNodes: [rootMesh],
        skeletons: [],
        animationGroups: [],
      }),
    } as unknown as AssetContainer;

    const singleTeam: GridConfig = {
      teams: [{ teamId: "macklen", driverProfile: "balanced" }],
      playerTeamId: "macklen",
    };

    lifecycle.init(eventBus, scene);
    lifecycle.spawnGrid(meshContainer, singleTeam);

    expect(lifecycle.entityCount).toBe(1);
    expect(lifecycle.getEntity("player")?.mesh).toBeDefined();
  });

  it("chassis extraction: root is TransformNode, rootNodes has a Mesh sibling", () => {
    // When root is a TransformNode (step 1 skipped), but rootNodes
    // also contains a Mesh with geometry, step 2 finds it.
    const rootNode = new TransformNode("car_root", scene);
    const chassisMesh = new Mesh("chassis_in_rootnodes", scene);
    chassisMesh.setVerticesData("position", [0, 0, 0, 1, 0, 0, 0, 1, 0]);

    const multiNodeContainer = {
      instantiateModelsToScene: vi.fn().mockReturnValue({
        rootNodes: [rootNode, chassisMesh],
        skeletons: [],
        animationGroups: [],
      }),
    } as unknown as AssetContainer;

    const singleTeam: GridConfig = {
      teams: [{ teamId: "macklen", driverProfile: "balanced" }],
      playerTeamId: "macklen",
    };

    lifecycle.init(eventBus, scene);
    lifecycle.spawnGrid(multiNodeContainer, singleTeam);

    expect(lifecycle.entityCount).toBe(1);
    expect(lifecycle.getEntity("player")?.mesh).toBeDefined();
    expect(lifecycle.getEntity("player")?.physicsBody).not.toBeNull();
  });

  it("chassis extraction: falls to getChildMeshes when rootNodes has no Mesh", () => {
    // Root is TransformNode, rootNodes only has TransformNode,
    // but getChildMeshes returns a child Mesh with geometry.
    const rootNode = new TransformNode("car_root_fallback", scene);
    const childMesh = new Mesh("chassis_child", scene);
    childMesh.setVerticesData("position", [0, 0, 0, 1, 0, 0, 0, 1, 0]);
    childMesh.parent = rootNode;

    const fallbackContainer = {
      instantiateModelsToScene: vi.fn().mockReturnValue({
        rootNodes: [rootNode],
        skeletons: [],
        animationGroups: [],
      }),
    } as unknown as AssetContainer;

    const singleTeam: GridConfig = {
      teams: [{ teamId: "macklen", driverProfile: "balanced" }],
      playerTeamId: "macklen",
    };

    lifecycle.init(eventBus, scene);
    lifecycle.spawnGrid(fallbackContainer, singleTeam);

    expect(lifecycle.entityCount).toBe(1);
    expect(lifecycle.getEntity("player")?.mesh).toBeDefined();
    expect(lifecycle.getEntity("player")?.physicsBody).not.toBeNull();
  });

  it("chassis extraction: skips non-Mesh children, finds Mesh in fallback", () => {
    // Root is TransformNode, rootNodes has only TransformNodes,
    // but getChildMeshes has a Mesh without geometry followed by a Mesh with geometry.
    // This exercises the false branch of `child instanceof Mesh && child.geometry`.
    const rootNode = new TransformNode("car_root_skip", scene);
    const emptyMesh = new Mesh("empty_mesh", scene);
    emptyMesh.parent = rootNode;
    // no setVerticesData → geometry is null
    const chassisMesh = new Mesh("chassis_found", scene);
    chassisMesh.setVerticesData("position", [0, 0, 0, 1, 0, 0, 0, 1, 0]);
    chassisMesh.parent = rootNode;

    const skipContainer = {
      instantiateModelsToScene: vi.fn().mockReturnValue({
        rootNodes: [rootNode],
        skeletons: [],
        animationGroups: [],
      }),
    } as unknown as AssetContainer;

    const singleTeam: GridConfig = {
      teams: [{ teamId: "macklen", driverProfile: "balanced" }],
      playerTeamId: "macklen",
    };

    lifecycle.init(eventBus, scene);
    lifecycle.spawnGrid(skipContainer, singleTeam);

    expect(lifecycle.entityCount).toBe(1);
    expect(lifecycle.getEntity("player")?.physicsBody).not.toBeNull();
  });
});
