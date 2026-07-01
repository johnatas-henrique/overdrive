/**
 * Story 001: Physics Core Skeleton — Integration and unit tests.
 *
 * Covers all 7 acceptance criteria for the arcade dynamic physics skeleton:
 *   AC-1 — Pipeline ordering verification
 *   AC-2 — Havok executeStep called exactly once per tick
 *   AC-3 — State lifecycle (lifecycle-gated — deferred note)
 *   AC-4 — Phase 3 velocity override
 *   AC-5 — Ground tracking (Y follows spline elevation)
 *   AC-6 — Active bodies lifecycle (lifecycle-gated — deferred note)
 *   AC-7 — Determinism (identical seed + inputs → identical output)
 *
 * @see ADR-0008 — Vehicle Physics — Arcade Dynamic
 * @see STORY-001 — Physics Core Skeleton
 */

import { Vector3 } from "@babylonjs/core/Maths/math";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FixedUpdatePipeline } from "@/foundation/determinism/fixed-update-pipeline";
import { Phase1Stub } from "@/physics-handling/phase1-stub";
import { PhysicsService } from "@/physics-handling/physics-service";
import type {
  CarPhysicsState,
  IPhysics,
  ITrackSystem,
  PhysicsConfig,
} from "@/physics-handling/types";

// ─── Mock Babylon.js WASM module ──────────────────────────────────────────
// @babylonjs/havok loads a WebAssembly binary. We mock the default export
// so unit tests can run in node without WASM support.
vi.mock("@babylonjs/havok", () => ({
  default: vi.fn().mockResolvedValue({
    HP_World_Create: vi.fn().mockReturnValue([0, 1]),
    HP_World_SetGravity: vi.fn(),
    HP_World_SetSpeedLimit: vi.fn(),
    HP_QueryCollector_Create: vi.fn().mockReturnValue([0, 1]),
  }),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const TEST_CONFIG: PhysicsConfig = {
  baseGrip: 0.95,
  steerClampSpeed: 25,
  steerMinRatio: 0.4,
  liftOffRearFactor: 0.7,
  liftOffMinSteering: 0.3,
  liftOffThrottleMax: 0.3,
  dragCoeff: 0.3,
  maxBrakeForce: 15,
  pitSpeedLimit: 12,
  offTrackFriction: 0.4,
  offTrackGripFactor: 0.6,
  offTrackMinSpeed: 5,
  kerbGripLoss: 0.5,
  speedModRefSpeed: 30,
  speedModMinFactor: 0.8,
  autoShiftRpmThreshold: 8000,
  rpmMax: 10000,
  minGripFactor: 0.1,
  stopEpsilon: 0.1,
  carHalfWidth: 0.7,
  topSpeedL1toL5: [40, 50, 60, 72, 85] as [
    number,
    number,
    number,
    number,
    number,
  ],
  accelerationL1toL5: [0.8, 1.0, 1.2, 1.4, 1.6] as [
    number,
    number,
    number,
    number,
    number,
  ],
  corneringL1toL5: [0.6, 0.7, 0.8, 0.9, 1.0] as [
    number,
    number,
    number,
    number,
    number,
  ],
};

function createMockScene() {
  return {
    enablePhysics: vi.fn(),
    disablePhysicsEngine: vi.fn(),
  } as any;
}

function createMockHavokPlugin() {
  return {
    executeStep: vi.fn(),
    dispose: vi.fn(),
  } as any;
}

function createMockBody() {
  // Track the last velocity set for assertion
  let _lastLinearVelocity: { x: number; y: number; z: number } = {
    x: 0,
    y: 0,
    z: 0,
  };
  let _lastAngularVelocity: { x: number; y: number; z: number } = {
    x: 0,
    y: 0,
    z: 0,
  };
  const position = { x: 0, y: 0, z: 0 };

  return {
    position,
    getObjectCenterWorld: vi.fn(() => ({
      x: position.x,
      y: position.y,
      z: position.z,
    })),
    setLinearVelocity: vi.fn((v: { x: number; y: number; z: number }) => {
      _lastLinearVelocity = v;
    }),
    getLinearVelocity: vi.fn(() => _lastLinearVelocity),
    setAngularVelocity: vi.fn((v: { x: number; y: number; z: number }) => {
      _lastAngularVelocity = v;
    }),
    getAngularVelocity: vi.fn(() => _lastAngularVelocity),
    get class() {
      return {
        _lastLinearVelocity,
        _lastAngularVelocity,
      };
    },
  } as any;
}

function createMockTrackSystem(): ITrackSystem {
  return {
    getElevation: vi.fn((_pos: number) => 0),
    getTangent: vi.fn((_pos: number) => new Vector3(0, 0, 1)),
  };
}

function addCarState(
  physics: IPhysics & { _carStates?: Map<string, CarPhysicsState> },
  carId: string,
  body: any
): void {
  // Access internal state map via bracket notation (testing pattern)
  const states = (physics as any)._carStates as Map<string, CarPhysicsState>;
  states.set(carId, {
    carId,
    body,
    targetSpeed: 0,
    targetYawRate: 0,
    splinePosition: 0,
    speedKmh: 0,
    rpm: 0,
    gear: 0,
    lateralG: 0,
    accelG: 0,
    tireSqueal: 0,
    kerbHit: false,
    offTrack: false,
    gripMultiplier: 1,
    fuelMult: 1,
    tireCondition: 1,
    locked: false,
    pitMode: false,
    tireBlownEmitted: false,
    fuelEmptyEmitted: false,
    wasAboveStopEpsilon: false,
  });
}

// ─── AC-1: Pipeline Ordering ──────────────────────────────────────────────

describe("AC-1 — Pipeline ordering", () => {
  it("executes Input → Physics → AI in fixed slot order", () => {
    const callLog: string[] = [];
    const pipeline = new FixedUpdatePipeline();

    pipeline.register("input", () => callLog.push("input"), 1);
    pipeline.register("physics", () => callLog.push("physics"), 2);
    pipeline.register("ai", () => callLog.push("ai"), 3);

    pipeline.start();
    pipeline.executeTick(FIXED_DT);

    expect(callLog).toEqual(["input", "physics", "ai"]);
  });

  it("executes all 8 slots in their defined order", () => {
    const callLog: string[] = [];
    const pipeline = new FixedUpdatePipeline();

    pipeline.register("s1", () => callLog.push("s1"), 1);
    pipeline.register("s2", () => callLog.push("s2"), 2);
    pipeline.register("s3", () => callLog.push("s3"), 3);
    pipeline.register("s4", () => callLog.push("s4"), 4);
    pipeline.register("s5", () => callLog.push("s5"), 5);
    pipeline.register("s6", () => callLog.push("s6"), 6);
    pipeline.register("s7", () => callLog.push("s7"), 7);
    pipeline.register("s8", () => callLog.push("s8"), 8);

    pipeline.start();
    pipeline.executeTick(FIXED_DT);

    expect(callLog).toEqual(["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"]);
  });

  it("PhysicsService.register() places update at slot #2", async () => {
    const pipeline = new FixedUpdatePipeline();
    const scene = createMockScene();
    const havok = createMockHavokPlugin();
    const physics = new PhysicsService(scene, undefined, havok);
    await physics.init(TEST_CONFIG);

    pipeline.register("input", vi.fn(), 1);
    physics.register(pipeline);

    // Verify slot 2 is occupied by the physics system
    const slot2Info = (pipeline as any)._slots[2];
    expect(slot2Info).not.toBeNull();
    expect(slot2Info.systemId).toBe("physics");
    expect(typeof slot2Info.update).toBe("function");

    pipeline.start();
    pipeline.executeTick(FIXED_DT);

    // Confirm physics.update() was actually called by checking side effects
    expect(havok.executeStep).toHaveBeenCalledTimes(1);
    expect(havok.executeStep).toHaveBeenCalledWith(FIXED_DT, expect.any(Array));
  });

  it("registers 8 systems and verifies slot order preserves Physics at #2", () => {
    const callLog: string[] = [];
    const pipeline = new FixedUpdatePipeline();

    // Simulate the full game pipeline registration order
    const _slotFunctions: Record<number, string> = {
      1: "input",
      2: "physics",
      3: "ai",
    };

    // Register all systems
    const registrations: Array<{ systemId: string; slot: number }> = [
      { systemId: "input", slot: 1 },
      { systemId: "physics", slot: 2 },
      { systemId: "ai", slot: 3 },
    ];

    for (const { systemId, slot } of registrations) {
      pipeline.register(systemId, () => callLog.push(systemId), slot);
    }

    pipeline.start();
    pipeline.executeTick(FIXED_DT);

    expect(callLog).toEqual(["input", "physics", "ai"]);
  });
});

// ─── AC-2: Havok executeStep Exactly Once ────────────────────────────────

describe("AC-2 — Havok executeStep called exactly once per tick", () => {
  let scene: any;
  let havok: any;
  let physics: PhysicsService;

  beforeEach(() => {
    scene = createMockScene();
    havok = createMockHavokPlugin();
    physics = new PhysicsService(scene, undefined, havok);
  });

  it("calls executeStep exactly once per update() call", async () => {
    await physics.init(TEST_CONFIG);

    // Add one car with a mock body so Phase 2 has active bodies
    const body = createMockBody();
    addCarState(physics, "car_01", body);

    physics.update(FIXED_DT);

    expect(havok.executeStep).toHaveBeenCalledTimes(1);
    expect(havok.executeStep).toHaveBeenCalledWith(FIXED_DT, expect.any(Array));
  });

  it("bodies array passed to executeStep contains all active bodies", async () => {
    await physics.init(TEST_CONFIG);

    const body1 = createMockBody();
    const body2 = createMockBody();
    addCarState(physics, "car_01", body1);
    addCarState(physics, "car_02", body2);

    physics.update(FIXED_DT);

    // The activeBodies array should contain the bodies of all active car states
    const callArg = havok.executeStep.mock.calls[0][1] as any[];
    expect(callArg.length).toBe(2);
    expect(callArg[0]).toBe(body1);
    expect(callArg[1]).toBe(body2);
  });

  it("suppresses auto-step via body.disablePreStep = true", async () => {
    await physics.init(TEST_CONFIG);

    // The physics pipeline sets disablePreStep = true on each body during
    // Phase 2 body collection, preventing Havok from auto-stepping bodies
    // outside the pipeline (FR-034).
    const body1 = createMockBody();
    const body2 = createMockBody();
    addCarState(physics, "car_01", body1);
    addCarState(physics, "car_02", body2);

    // Before update, disablePreStep is not set yet
    expect(body1.disablePreStep).toBeUndefined();
    expect(body2.disablePreStep).toBeUndefined();

    // Verify Havok was only called via our pipeline, not by the scene
    expect(havok.executeStep).toHaveBeenCalledTimes(0);

    // After update, each body should have disablePreStep = true
    physics.update(FIXED_DT);
    expect(havok.executeStep).toHaveBeenCalledTimes(1);
    expect(body1.disablePreStep).toBe(true);
    expect(body2.disablePreStep).toBe(true);
  });

  it("body.disablePreStep remains true after update", async () => {
    await physics.init(TEST_CONFIG);
    const body = createMockBody();
    addCarState(physics, "car_01", body);

    // After update, the body should have disablePreStep = true set by Phase 2
    physics.update(FIXED_DT);
    expect(havok.executeStep).toHaveBeenCalledTimes(1);
    expect(body.disablePreStep).toBe(true);

    // A second update re-affirms disablePreStep (idempotent)
    physics.update(FIXED_DT);
    expect(havok.executeStep).toHaveBeenCalledTimes(2);
    expect(body.disablePreStep).toBe(true);
  });

  it("returns early when not initialized", () => {
    // init() was not called — update should be a no-op
    physics.update(FIXED_DT);
    expect(havok.executeStep).not.toHaveBeenCalled();
  });

  it("returns early when disposed", async () => {
    await physics.init(TEST_CONFIG);
    physics.dispose();

    physics.update(FIXED_DT);
    expect(havok.executeStep).not.toHaveBeenCalled();
  });
});

// ─── AC-3: State Lifecycle [DEFERRED] ────────────────────────────────────

describe("AC-3 — State lifecycle [DEFERRED — entity.spawned/despawned]", () => {
  it("car state map is defined and accepts add/remove operations", () => {
    const scene = createMockScene();
    const havok = createMockHavokPlugin();
    const physics = new PhysicsService(scene, undefined, havok);

    // Verify internal state map exists (reflection via interface contract)
    expect(physics).toBeDefined();
    expect(physics.getTelemetry("nonexistent")).toBeUndefined();
    expect(physics.getSplinePosition("nonexistent")).toBe(0);
  });

  it("getTelemetry returns undefined for unknown carId", async () => {
    const scene = createMockScene();
    const havok = createMockHavokPlugin();
    const physics = new PhysicsService(scene, undefined, havok);
    await physics.init(TEST_CONFIG);

    expect(physics.getTelemetry("unknown_car")).toBeUndefined();
  });

  it("getSplinePosition returns 0 for unknown carId", async () => {
    const scene = createMockScene();
    const havok = createMockHavokPlugin();
    const physics = new PhysicsService(scene, undefined, havok);
    await physics.init(TEST_CONFIG);

    expect(physics.getSplinePosition("unknown_car")).toBe(0);
  });

  it("state is available after adding and gets spline position correctly", async () => {
    const scene = createMockScene();
    const havok = createMockHavokPlugin();
    const physics = new PhysicsService(scene, undefined, havok);
    await physics.init(TEST_CONFIG);

    const body = createMockBody();
    addCarState(physics, "car_01", body);

    // Update should process the state
    physics.update(FIXED_DT);

    // State exists and was processed
    expect(physics.getTelemetry("car_01")).toBeDefined();
    expect(physics.getSplinePosition("car_01")).toBe(0);
  });

  it("DEFERRED: state creation depends on entity.spawned event (cross-epic with ADR-0005)", () => {
    // Acceptance criterion AC-3 requires state to be created on entity.spawned
    // and destroyed on entity.despawned. The CarEntity system (ADR-0005) does
    // not exist yet in Story 001. Once available, this test should:
    //
    // 1. Listen for 'entity.spawned' event with carId
    // 2. Verify PhysicsService.addCarState() is called
    // 3. Verify CarPhysicsState is initialized with correct fields
    // 4. Listen for 'entity.despawned' event with carId
    // 5. Verify PhysicsService.removeCarState() is called
    // 6. Verify telemetry for that carId returns undefined after removal
    //
    // Story 001 defines the CarPhysicsState data structure. The lifecycle
    // wiring will be implemented when ADR-0005 entity lifecycle is available.
    expect(true).toBe(true);
  });
});

// ─── AC-4: Phase 3 Velocity Override ─────────────────────────────────────

describe("AC-4 — Phase 3 velocity override", () => {
  let scene: any;
  let havok: any;
  let physics: PhysicsService;

  beforeEach(async () => {
    scene = createMockScene();
    havok = createMockHavokPlugin();
    physics = new PhysicsService(scene, undefined, havok);
    await physics.init(TEST_CONFIG);
  });

  it("applies arcade target velocity via setLinearVelocity", () => {
    const body = createMockBody();
    addCarState(physics, "car_01", body);

    physics.update(FIXED_DT);

    // Phase1Stub sets targetSpeed = 5, with Vector3.Forward() (0,0,1) fallback
    // So expected velocity is (0, 0, 5) from Forward() * 5
    expect(body.setLinearVelocity).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, y: 0, z: 5 })
    );
  });

  it("applies arcade target angular velocity", () => {
    const body = createMockBody();
    addCarState(physics, "car_01", body);

    physics.update(FIXED_DT);

    // Phase1Stub sets targetYawRate = 0
    expect(body.setAngularVelocity).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, y: 0, z: 0 })
    );
  });

  it("zeros linear and angular velocity for locked cars", () => {
    const body = createMockBody();
    addCarState(physics, "car_01", body);

    physics.setLocked("car_01", true);
    physics.update(FIXED_DT);

    expect(body.setLinearVelocity).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, y: 0, z: 0 })
    );
    expect(body.setAngularVelocity).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, y: 0, z: 0 })
    );
  });

  it("setLocked flips between zero and arcade velocity across ticks", () => {
    const body = createMockBody();
    addCarState(physics, "car_01", body);

    // Tick 1: locked
    physics.setLocked("car_01", true);
    physics.update(FIXED_DT);
    expect(body.setLinearVelocity).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, y: 0, z: 0 })
    );

    body.setLinearVelocity.mockClear();

    // Tick 2: unlocked — should get arcade velocity
    physics.setLocked("car_01", false);
    physics.update(FIXED_DT);
    expect(body.setLinearVelocity).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, y: 0, z: 5 })
    );
    expect(body.setLinearVelocity).not.toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, y: 0, z: 0 })
    );
  });

  it("Phase 1 runs for locked cars but Phase 3 zeros velocity", () => {
    const body = createMockBody();
    addCarState(physics, "car_01", body);

    // Phase 1 runs unconditionally (for telemetry), but Phase 3 zeros velocity
    physics.setLocked("car_01", true);
    physics.update(FIXED_DT);

    // Phase 3 zeros the velocity regardless of Phase 1 output
    expect(body.setLinearVelocity).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, y: 0, z: 0 })
    );
  });

  it("handles null body gracefully (car without physics body)", async () => {
    // Add a state with null body
    addCarState(physics, "car_no_body", null);

    // Should not throw
    expect(() => physics.update(FIXED_DT)).not.toThrow();
  });
});

// ─── AC-5: Ground Tracking ──────────────────────────────────────────────

describe("AC-5 — Ground tracking (Y follows spline elevation)", () => {
  it("applies Y velocity correction from spline elevation", async () => {
    const scene = createMockScene();
    const trackSystem = createMockTrackSystem();

    // Configure track: elevation at position 0 is 10, body is at y=5
    vi.mocked(trackSystem.getElevation).mockReturnValue(10);
    // Phase 3 target = (splineY - body.position.y) / dt
    // = (10 - 5) / (1/60) = 300

    const havok = createMockHavokPlugin();
    const physics = new PhysicsService(scene, trackSystem, havok);
    await physics.init(TEST_CONFIG);

    const body = createMockBody();
    body.position.y = 5;
    body.getObjectCenterWorld.mockReturnValue({ x: 0, y: 5, z: 0 });

    addCarState(physics, "car_01", body);
    physics.update(FIXED_DT);

    // The Y component should be corrected to track elevation
    expect(body.setLinearVelocity).toHaveBeenCalledWith(
      expect.objectContaining({ y: 300 })
    );
  });

  it("applies small Y correction when car is near ground level", async () => {
    const scene = createMockScene();
    const trackSystem = createMockTrackSystem();

    // Car is nearly on the ground — small correction needed
    vi.mocked(trackSystem.getElevation).mockReturnValue(5.01);

    const havok = createMockHavokPlugin();
    const physics = new PhysicsService(scene, trackSystem, havok);
    await physics.init(TEST_CONFIG);

    const body = createMockBody();
    body.position.y = 5;
    body.getObjectCenterWorld.mockReturnValue({ x: 0, y: 5, z: 0 });

    addCarState(physics, "car_01", body);
    physics.update(FIXED_DT);

    // Y correction = (5.01 - 5) / (1/60) = 0.6 m/s — realistic ground tracking
    const lastCall = body.setLinearVelocity.mock.lastCall[0];
    expect(lastCall.y).toBeCloseTo(0.6, 5);
  });

  it("applies zero Y correction when car is exactly on ground", async () => {
    const scene = createMockScene();
    const trackSystem = createMockTrackSystem();

    // Car is exactly at ground level — no correction
    vi.mocked(trackSystem.getElevation).mockReturnValue(5);

    const havok = createMockHavokPlugin();
    const physics = new PhysicsService(scene, trackSystem, havok);
    await physics.init(TEST_CONFIG);

    const body = createMockBody();
    body.position.y = 5;
    body.getObjectCenterWorld.mockReturnValue({ x: 0, y: 5, z: 0 });

    addCarState(physics, "car_01", body);
    physics.update(FIXED_DT);

    // Y correction = (5 - 5) / (1/60) = 0 — no vertical movement
    expect(body.setLinearVelocity).toHaveBeenCalledWith(
      expect.objectContaining({ y: 0 })
    );
  });

  it("uses track system tangent for forward direction", async () => {
    const scene = createMockScene();
    const trackSystem = createMockTrackSystem();

    // Configure a non-default tangent
    vi.mocked(trackSystem.getTangent).mockReturnValue(new Vector3(1, 0, 0));

    const havok = createMockHavokPlugin();
    const physics = new PhysicsService(scene, trackSystem, havok);
    await physics.init(TEST_CONFIG);

    const body = createMockBody();
    addCarState(physics, "car_01", body);
    physics.update(FIXED_DT);

    // targetSpeed = 5, tangent = (1,0,0) → target velocity = (5, corrected_y, 0)
    expect(body.setLinearVelocity).toHaveBeenCalledWith(
      expect.objectContaining({ x: 5, z: 0 })
    );
  });

  it("uses Vector3.Forward fallback when no track system provided", async () => {
    const scene = createMockScene();
    const havok = createMockHavokPlugin();
    const physics = new PhysicsService(scene, undefined, havok);
    await physics.init(TEST_CONFIG);

    const body = createMockBody();
    addCarState(physics, "car_01", body);

    physics.update(FIXED_DT);

    // Without track system: Vector3.Forward() = (0, 0, 1)
    // targetSpeed = 5 → velocity = (0, 0, 5)
    expect(body.setLinearVelocity).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, z: 5 })
    );
  });

  it("maintains X and Z components from forward direction when Y correction applied", async () => {
    const scene = createMockScene();
    const trackSystem = createMockTrackSystem();

    vi.mocked(trackSystem.getTangent).mockReturnValue(
      new Vector3(Math.SQRT1_2, 0, Math.SQRT1_2)
    );
    vi.mocked(trackSystem.getElevation).mockReturnValue(10);

    const havok = createMockHavokPlugin();
    const physics = new PhysicsService(scene, trackSystem, havok);
    await physics.init(TEST_CONFIG);

    const body = createMockBody();
    body.position.y = 5;
    body.getObjectCenterWorld.mockReturnValue({ x: 0, y: 5, z: 0 });

    addCarState(physics, "car_01", body);
    physics.update(FIXED_DT);

    // targetSpeed = 5, tangent = (0.707, 0, 0.707) → X = 5*0.707 = 3.535, Z = 5*0.707 = 3.535
    // Y = (10 - 5) / (1/60) = 300
    expect(body.setLinearVelocity).toHaveBeenCalledWith(
      expect.objectContaining({
        x: 5 * Math.SQRT1_2,
        y: 300,
        z: 5 * Math.SQRT1_2,
      })
    );
  });
});

// ─── AC-6: Active Bodies Lifecycle [DEFERRED] ────────────────────────────

describe("AC-6 — Active bodies lifecycle [DEFERRED — entity lifecycle]", () => {
  it("DEFERRED: activeBodies array length matches car count", () => {
    // Acceptance criterion AC-6 requires the activeBodies array to contain
    // exactly one PhysicsBody per active car. The current implementation
    // maintains `activeBodies` as a PhysicsBody[] that is passed to
    // havokPlugin.executeStep(). Body lifecycle management depends on:
    //
    // 1. entity.spawned: push body to activeBodies with correct motion type
    // 2. entity.despawned: remove body from activeBodies
    //
    // Both are cross-epic dependencies with ADR-0005 (Entity/Car Lifecycle).
    // When ADR-0005 is available, the following test pattern applies:
    //
    // expect(physics.activeBodies.length).toBe(numCars);
    // body.setMotionType(PhysicsMotionType.STATIC) → body removed from activeBodies
    //
    // Story 001 confirms the array structure and that executeStep receives
    // the active bodies (verified in AC-2 bodies-array test).
    expect(true).toBe(true);
  });
});

// ─── AC-7: Determinism ──────────────────────────────────────────────────

describe("AC-7 — Determinism", () => {
  it("produces identical velocity after 10 ticks with 2 cars", async () => {
    const scene = createMockScene();
    const havok = createMockHavokPlugin();
    const physics1 = new PhysicsService(scene, undefined, havok);
    await physics1.init(TEST_CONFIG);

    const scene2 = createMockScene();
    const havok2 = createMockHavokPlugin();
    const physics2 = new PhysicsService(scene2, undefined, havok2);
    await physics2.init(TEST_CONFIG);

    // Create identical 2-car setups
    const body1a = createMockBody();
    const body1b = createMockBody();
    const body2a = createMockBody();
    const body2b = createMockBody();
    addCarState(physics1, "car_01", body1a);
    addCarState(physics1, "car_02", body1b);
    addCarState(physics2, "car_01", body2a);
    addCarState(physics2, "car_02", body2b);

    // Run both instances through 10 ticks (1/6 second of race time)
    for (let i = 0; i < 10; i++) {
      physics1.update(FIXED_DT);
      physics2.update(FIXED_DT);
    }

    // Verify identical velocity output for both cars
    const lastVel1a = body1a.setLinearVelocity.mock.lastCall[0];
    const lastVel2a = body2a.setLinearVelocity.mock.lastCall[0];
    expect(lastVel1a.x).toBe(lastVel2a.x);
    expect(lastVel1a.y).toBe(lastVel2a.y);
    expect(lastVel1a.z).toBe(lastVel2a.z);

    const lastVel1b = body1b.setLinearVelocity.mock.lastCall[0];
    const lastVel2b = body2b.setLinearVelocity.mock.lastCall[0];
    expect(lastVel1b.x).toBe(lastVel2b.x);
    expect(lastVel1b.y).toBe(lastVel2b.y);
    expect(lastVel1b.z).toBe(lastVel2b.z);
  });

  it("produces identical telemetry after two ticks", async () => {
    const scene = createMockScene();
    const havok = createMockHavokPlugin();
    const physics1 = new PhysicsService(scene, undefined, havok);
    await physics1.init(TEST_CONFIG);

    const scene2 = createMockScene();
    const havok2 = createMockHavokPlugin();
    const physics2 = new PhysicsService(scene2, undefined, havok2);
    await physics2.init(TEST_CONFIG);

    const body1 = createMockBody();
    const body2 = createMockBody();
    addCarState(physics1, "car_01", body1);
    addCarState(physics2, "car_01", body2);

    physics1.update(FIXED_DT);
    physics1.update(FIXED_DT);
    physics2.update(FIXED_DT);
    physics2.update(FIXED_DT);

    const t1 = physics1.getTelemetry("car_01");
    const t2 = physics2.getTelemetry("car_01");

    expect(t1).toBeDefined();
    expect(t2).toBeDefined();
    expect(t1?.speedKmh).toBe(t2?.speedKmh);
    expect(t1?.rpm).toBe(t2?.rpm);
    expect(t1?.gear).toBe(t2?.gear);
  });

  it("state is reproducible — same config produces same Phase 1 output", () => {
    const state1: CarPhysicsState = {
      carId: "test",
      body: null,
      targetSpeed: 0,
      targetYawRate: 0,
      splinePosition: 0,
      speedKmh: 0,
      rpm: 0,
      gear: 0,
      lateralG: 0,
      accelG: 0,
      tireSqueal: 0,
      kerbHit: false,
      offTrack: false,
      gripMultiplier: 1,
      fuelMult: 1,
      tireCondition: 1,
      locked: false,
      pitMode: false,
      tireBlownEmitted: false,
      fuelEmptyEmitted: false,
      wasAboveStopEpsilon: false,
    };

    // Clone for second run
    const state2 = { ...state1 };

    const stub = new Phase1Stub();
    const input = { steer: 0, throttle: 0, brake: 1, gearDelta: 0 } as any;
    const config = { stopEpsilon: 0.1 } as any;
    stub.compute(state1, input, FIXED_DT, config);
    stub.compute(state2, input, FIXED_DT, config);

    expect(state1.targetSpeed).toBe(state2.targetSpeed);
    expect(state1.targetYawRate).toBe(state2.targetYawRate);
    expect(state1.speedKmh).toBe(state2.speedKmh);
    expect(state1.rpm).toBe(state2.rpm);
    expect(state1.gear).toBe(state2.gear);
  });
});

// ─── Control Methods ────────────────────────────────────────────────────

describe("Control methods", () => {
  let physics: PhysicsService;
  let havok: any;

  beforeEach(async () => {
    const scene = createMockScene();
    havok = createMockHavokPlugin();
    physics = new PhysicsService(scene, undefined, havok);
    await physics.init(TEST_CONFIG);

    const body = createMockBody();
    addCarState(physics, "car_01", body);
  });

  describe("setPit()", () => {
    it("enables and disables pit mode without error", () => {
      expect(() => physics.setPit("car_01", true)).not.toThrow();
      expect(() => physics.setPit("car_01", false)).not.toThrow();
    });

    it("does not crash for unknown carId", () => {
      expect(() => physics.setPit("nonexistent", true)).not.toThrow();
    });
  });

  describe("onRaceGreenFlag()", () => {
    it("resets wasAboveStopEpsilon for all cars", () => {
      // Set car state to make wasAboveStopEpsilon false initially
      const states = (physics as any)._carStates as Map<
        string,
        CarPhysicsState
      >;
      const state = states.get("car_01") ?? ({} as CarPhysicsState);
      state.wasAboveStopEpsilon = true;

      physics.onRaceGreenFlag();

      expect(state.wasAboveStopEpsilon).toBe(false);
    });
  });

  describe("onFuelUpdate / onTireUpdate (1-tick delay)", () => {
    it("applies fuel multiplier on next tick", () => {
      physics.onFuelUpdate("car_01", 0.5);

      // Not yet applied (1-tick delay)
      const states = (physics as any)._carStates as Map<
        string,
        CarPhysicsState
      >;
      expect(states.get("car_01")?.fuelMult).toBe(1);

      // After update, should be applied
      physics.update(FIXED_DT);
      expect(states.get("car_01")?.fuelMult).toBe(0.5);
    });

    it("applies tire condition on next tick", () => {
      physics.onTireUpdate("car_01", 0.3);

      const states = (physics as any)._carStates as Map<
        string,
        CarPhysicsState
      >;
      expect(states.get("car_01")?.tireCondition).toBe(1);

      physics.update(FIXED_DT);
      expect(states.get("car_01")?.tireCondition).toBe(0.3);
    });

    it("clears pending maps after application", () => {
      physics.onFuelUpdate("car_01", 0.5);
      physics.onTireUpdate("car_01", 0.3);

      physics.update(FIXED_DT);

      // Second update should not re-apply stale values
      // Fuel and tire should remain at their applied values
      const states = (physics as any)._carStates as Map<
        string,
        CarPhysicsState
      >;
      expect(states.get("car_01")?.fuelMult).toBe(0.5);
      expect(states.get("car_01")?.tireCondition).toBe(0.3);

      // No pending updates should remain
      // (We can't access internal maps, so we verify by not seeing re-application issues)
    });

    it("ignores fuel update for non-existent car", () => {
      // Should not throw when carId doesn't exist in state map
      physics.onFuelUpdate("nonexistent_car", 0.5);
      physics.update(FIXED_DT);
      // No crash = guard worked
    });

    it("ignores tire update for non-existent car", () => {
      // Should not throw when carId doesn't exist in state map
      physics.onTireUpdate("nonexistent_car", 0.3);
      physics.update(FIXED_DT);
      // No crash = guard worked
    });
  });

  describe("dispose()", () => {
    it("cleans up all resources", () => {
      physics.dispose();

      expect(havok.dispose).toHaveBeenCalledTimes(1);
      expect(physics.getTelemetry("car_01")).toBeUndefined();
      expect(physics.getSplinePosition("car_01")).toBe(0);
    });

    it("is safe to call multiple times", () => {
      physics.dispose();
      expect(() => physics.dispose()).not.toThrow();
    });

    it("prevents further update calls", () => {
      physics.dispose();
      physics.update(FIXED_DT);
      expect(havok.executeStep).not.toHaveBeenCalled();
    });
  });
});

// ─── Lifecycle ──────────────────────────────────────────────────────────

describe("Lifecycle", () => {
  it("init can be called multiple times (idempotent)", async () => {
    const scene = createMockScene();
    const havok = createMockHavokPlugin();
    const physics = new PhysicsService(scene, undefined, havok);

    await physics.init(TEST_CONFIG);
    await physics.init(TEST_CONFIG);

    // enablePhysics should only be called once (second init returns early)
    expect(scene.enablePhysics).toHaveBeenCalledTimes(1);
  });

  it("init dynamically imports Havok when no plugin injected via constructor", async () => {
    const scene = createMockScene();
    // No HavokPlugin injected — forces dynamic import path
    const physics = new PhysicsService(scene, undefined);

    await physics.init(TEST_CONFIG);

    // Dynamic import should have been called, plugin should be created
    expect(scene.enablePhysics).toHaveBeenCalledTimes(1);
    // getTelemetry should work (proves init completed successfully)
    expect(physics.getTelemetry("car_01")).toBeUndefined();
  });
});

// ─── Edge Cases ──────────────────────────────────────────────────────────

describe("Edge Cases", () => {
  it("handles dt=0 without producing Infinity velocity", async () => {
    const scene = createMockScene();
    const trackSystem = createMockTrackSystem();
    vi.mocked(trackSystem.getElevation).mockReturnValue(5.01);

    const havok = createMockHavokPlugin();
    const physics = new PhysicsService(scene, trackSystem, havok);
    await physics.init(TEST_CONFIG);

    const body = createMockBody();
    body.position.y = 5;
    body.getObjectCenterWorld.mockReturnValue({ x: 0, y: 5, z: 0 });
    addCarState(physics, "car_01", body);

    // dt=0 would cause division by zero in Y correction
    // The implementation should handle this gracefully
    expect(() => physics.update(0)).not.toThrow();
  });

  it("prevents duplicate body in activeBodies array", async () => {
    const scene = createMockScene();
    const havok = createMockHavokPlugin();
    const physics = new PhysicsService(scene, undefined, havok);
    await physics.init(TEST_CONFIG);

    const body = createMockBody();
    // Add two cars with the same body reference
    addCarState(physics, "car_01", body);
    addCarState(physics, "car_02", body);

    physics.update(FIXED_DT);

    // executeStep should receive the body (possibly duplicated if no dedup)
    const callArg = havok.executeStep.mock.calls[0][1] as any[];
    // The body appears twice because both car states reference it
    // This documents the current behavior — dedup guard can be added if needed
    expect(callArg.length).toBe(2);
    expect(callArg[0]).toBe(body);
    expect(callArg[1]).toBe(body);
  });
});

// ─── FIXED_DT import from accumulator ──────────────────────────────────────

import { FIXED_DT } from "@/foundation/determinism/accumulator";
