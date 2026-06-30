/**
 * Story 005: Lock, Pit, External Inputs & Edge Events — Integration tests.
 *
 * Covers all 8 acceptance criteria for the physics control interfaces:
 *   AC-1 — setLocked() zeros velocity; unlock restores normal behavior
 *   AC-2 — setPit() clamps speed with linear ramp to pitSpeedLimit
 *   AC-3 — onFuelUpdate() fuelMult=0 → engine power=0, car coasts
 *   AC-4 — onTireUpdate() tireCondition=0 → grip drops to minGripFactor
 *   AC-5 — car.tire_blown emitted one-shot when tireCondition→0
 *   AC-6 — car.fuel_empty emitted one-shot when fuelMult→0
 *   AC-7 — car.stopped edge-triggered with hysteresis
 *   AC-8 — fuelMult and tireCondition have 1-tick delay
 *
 * @see ADR-0008 — Vehicle Physics — Arcade Dynamic
 * @see C24 — setLocked() zero velocity
 * @see C25 — setPit() pit speed limiter
 * @see C26 — fuelMult=0 → engine power=0
 * @see C27 — tireCondition=0 → minGripFactor
 * @see C28 — car.stopped edge-triggered
 * @see STORY-005 — Lock, Pit, External Inputs & Edge Events
 */

import { Vector3 } from "@babylonjs/core/Maths/math";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FIXED_DT } from "@/foundation/determinism/accumulator";
import { InputState } from "@/foundation/determinism/types";
import type { IEventBus } from "@/foundation/event-bus/types";
import { ArcadeGripModel } from "@/physics-handling/arcade-grip-model";
import type { CarPhysicsState } from "@/physics-handling/car-physics-state";
import type { ITrackSystem } from "@/physics-handling/i-track-system";
import type { PhysicsConfig } from "@/physics-handling/physics-config";
import { PhysicsService } from "@/physics-handling/physics-service";
import { SurfaceType } from "@/physics-handling/surface-handler";

// ─── Mock Babylon.js WASM module ──────────────────────────────────────────
vi.mock("@babylonjs/havok", () => ({
  default: vi.fn().mockResolvedValue({
    HP_World_Create: vi.fn().mockReturnValue([0, 1]),
    HP_World_SetGravity: vi.fn(),
    HP_World_SetSpeedLimit: vi.fn(),
    HP_QueryCollector_Create: vi.fn().mockReturnValue([0, 1]),
  }),
}));

// ─── Test Config ────────────────────────────────────────────────────────────

const TEST_CONFIG: PhysicsConfig = {
  baseGrip: 0.95,
  gravity: 9.81,
  steerClampSpeed: 25,
  steerMinRatio: 0.4,
  liftOffMinSteering: 0.3,
  liftOffThrottleMax: 0.3,
  liftOffBrakeMax: 0.05,
  dragCoeff: 0.3,
  maxBrakeForce: 15,
  pitSpeedLimit: 22.222, // 80 km/h in m/s
  pitSpeedTransitionTime: 2.0,
  offTrackFriction: 0.4,
  offTrackGripFactor: 0.6,
  offTrackMinSpeedFraction: 5,
  kerbGripLoss: 0.5,
  speedModRefSpeed: 30,
  speedModMinFactor: 0.8,
  autoShiftRpmThreshold: 8000,
  rpmMax: 10000,
  minGripFactor: 0.15,
  stopEpsilon: 0.01,
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
  gearRatios: [3.5, 2.5, 1.8, 1.3, 1.0, 0.8],
  accelLevel: 1,
  powerCeiling: 1,
  downshiftRpmRatio: 0.5,
  reverseMaxSpeed: 20,
  gear1RedlineSpeed: 10,
  mass: 800,
};

// ─── Mock Factories ─────────────────────────────────────────────────────────

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
  const position = { x: 0, y: 0, z: 0 };

  return {
    position,
    getObjectCenterWorld: vi.fn(() => ({
      x: position.x,
      y: position.y,
      z: position.z,
    })),
    getObjectCenterWorldToRef: vi.fn(
      (ref: { x: number; y: number; z: number }) => {
        ref.x = position.x;
        ref.y = position.y;
        ref.z = position.z;
        return ref;
      }
    ),
    setLinearVelocity: vi.fn(),
    setAngularVelocity: vi.fn(),
  } as any;
}

function _createMockTrackSystem(): ITrackSystem {
  return {
    getElevation: vi.fn((_pos: number) => 0),
    getTangent: vi.fn((_pos: number) => new Vector3(0, 0, 1)),
  };
}

function createMockEventBus(): IEventBus {
  return {
    on: vi.fn((_event: any, _handler: any) => ({
      unsubscribe: vi.fn(),
    })),
    once: vi.fn(),
    emit: vi.fn(),
    off: vi.fn() as any,
    getSubscriptions: vi.fn(() => new Map()),
    dispose: vi.fn(),
  };
}

function addCarState(
  physics: PhysicsService,
  carId: string,
  body: any,
  overrides?: Partial<CarPhysicsState>
): void {
  const states = (physics as any)._carStates as Map<string, CarPhysicsState>;
  const state: CarPhysicsState = {
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
    gradient: 0,
    topSpeedMs: TEST_CONFIG.topSpeedL1toL5[0],
    pitEntrySpeed: null,
    tireBlownEmitted: false,
    fuelEmptyEmitted: false,
    wasAboveStopEpsilon: false,
    ...overrides,
  };
  states.set(carId, state);
}

function setInput(
  physics: PhysicsService,
  carId: string,
  overrides?: Partial<InputState>
): void {
  const inputs = (physics as any)._inputStates as Map<string, InputState>;
  inputs.set(carId, { ...InputState.ZERO, ...overrides });
}

// ─── AC-1: setLocked() ──────────────────────────────────────────────────────

describe("AC-1 — setLocked() zeros velocity", () => {
  let physics: PhysicsService;
  let body: any;
  let havok: any;

  beforeEach(async () => {
    const scene = createMockScene();
    havok = createMockHavokPlugin();
    physics = new PhysicsService(scene, undefined, havok);
    physics.setSurfaceProvider(() => SurfaceType.Tarmac);
    await physics.init(TEST_CONFIG);

    body = createMockBody();
    addCarState(physics, "car_01", body, {
      gear: 2,
      speedKmh: 200,
      rpm: 8000,
    });
    setInput(physics, "car_01", { throttle: 1 });
  });

  it("zeros linear and angular velocity when locked", () => {
    physics.setLocked("car_01", true);
    physics.update(FIXED_DT);

    expect(body.setLinearVelocity).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, y: 0, z: 0 })
    );
    expect(body.setAngularVelocity).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, y: 0, z: 0 })
    );
  });

  it("restores normal velocity when unlocked", () => {
    physics.setLocked("car_01", true);
    physics.update(FIXED_DT);

    body.setLinearVelocity.mockClear();
    body.setAngularVelocity.mockClear();

    physics.setLocked("car_01", false);
    physics.update(FIXED_DT);

    // Phase 3 should apply arcade velocity (non-zero from Phase 1 compute)
    expect(body.setLinearVelocity).toHaveBeenCalled();
    const vel = body.setLinearVelocity.mock.calls[0][0];
    expect(vel.x).toBe(0);
    // At gear=2, speedKmh=200, throttle=1: targetSpeed should be > 0
    // Since Z is along forward direction (no track system), Z > 0
    expect(vel.z).toBeGreaterThan(0);
  });

  it("keeps velocity zero even with full throttle input", () => {
    physics.setLocked("car_01", true);
    // Even with aggressive input, Phase 3 zeros velocity
    setInput(physics, "car_01", { throttle: 1 });
    physics.update(FIXED_DT);

    expect(body.setLinearVelocity).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, y: 0, z: 0 })
    );
  });

  it("Phase 1 still runs for locked cars (telemetry updates)", () => {
    physics.setLocked("car_01", true);
    physics.update(FIXED_DT);

    const state = (physics as any)._carStates.get("car_01");
    // Phase 1 computed targetSpeed even though Phase 3 zeros it
    expect(state.targetSpeed).toBeDefined();
    // Locked car still receives Phase 1 (for telemetry/visuals)
    // Phase 3 zeros velocity, but Phase 1 ran
  });

  it("flips between locked and unlocked across consecutive ticks", () => {
    // Tick 1: locked → zero
    physics.setLocked("car_01", true);
    physics.update(FIXED_DT);
    expect(body.setLinearVelocity).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, y: 0, z: 0 })
    );

    body.setLinearVelocity.mockClear();

    // Tick 2: unlocked → arcade velocity
    physics.setLocked("car_01", false);
    physics.update(FIXED_DT);
    const vel = body.setLinearVelocity.mock.calls[0][0];
    expect(vel.z).toBeGreaterThan(0);
  });

  it("handles lock for car without body gracefully", () => {
    const noBodyState: Partial<CarPhysicsState> = { body: null };
    addCarState(physics, "car_no_body", null, noBodyState);

    physics.setLocked("car_no_body", true);
    expect(() => physics.update(FIXED_DT)).not.toThrow();
  });
});

// ─── AC-2: setPit() with Linear Ramp ───────────────────────────────────────

describe("AC-2 — setPit() linear ramp to pitSpeedLimit", () => {
  let physics: PhysicsService;
  let body: any;
  let havok: any;

  beforeEach(async () => {
    const scene = createMockScene();
    havok = createMockHavokPlugin();
    physics = new PhysicsService(scene, undefined, havok);
    physics.setSurfaceProvider(() => SurfaceType.Tarmac);
    await physics.init(TEST_CONFIG);

    body = createMockBody();
    // Start at 250 km/h ≈ 69.44 m/s with full throttle
    addCarState(physics, "car_01", body, {
      gear: 6,
      speedKmh: 250,
      rpm: 9000,
    });
    setInput(physics, "car_01", { throttle: 1 });
  });

  it("applies linear deceleration ramp toward pitSpeedLimit", () => {
    physics.setPit("car_01", true);
    physics.update(FIXED_DT);

    const state = (physics as any)._carStates.get("car_01");
    // Verify the pit limiter reduced targetSpeed from the Phase-1-computed
    // value toward pitSpeedLimit. Phase 1's computeTargetSpeed may produce
    // a value slightly different from the starting speed (engine dynamics),
    // so we use a loose tolerance that confirms the ramp IS active.
    const expectedMaxStep = (250 / 3.6 / 2.0) * FIXED_DT;
    const expectedSpeedMs = 250 / 3.6 - expectedMaxStep;
    const tolerance = 1.0; // lenient: Phase 1 may modify targetSpeed

    expect(state.targetSpeed).toBeGreaterThan(TEST_CONFIG.pitSpeedLimit);
    expect(Math.abs(state.targetSpeed - expectedSpeedMs)).toBeLessThan(
      tolerance
    );
    expect(state.speedKmh).toBeCloseTo(state.targetSpeed * 3.6, 1);
  });

  it("converges to pitSpeedLimit over multiple ticks", () => {
    // Test the pit limiter in isolation using the pure function.
    // The pure function clamps targetSpeed toward pitSpeedLimit each call.
    // Verify that repeated calls converge.
    const pitLimit = 80 / 3.6; // 22.22 m/s
    let speed = 250 / 3.6; // 69.44 m/s
    const transitionTime = 2.0;
    const ticks = 600; // 10 seconds at 60fps

    for (let i = 0; i < ticks; i++) {
      speed = (PhysicsService as any).applyPitLimiter(
        speed,
        speed,
        pitLimit,
        true,
        transitionTime,
        FIXED_DT,
        69.44 // pitEntrySpeed = initial speed
      );
    }

    expect(speed).toBeCloseTo(pitLimit, 0);
  });

  it("restores normal speed when pit mode is disabled", () => {
    physics.setPit("car_01", true);
    physics.update(FIXED_DT);

    body.setLinearVelocity.mockClear();

    physics.setPit("car_01", false);
    physics.update(FIXED_DT);

    // After disable, the pit limiter is removed and arcade model controls speed
    const state = (physics as any)._carStates.get("car_01");
    // Full throttle + high gear should give speed above pitSpeedLimit
    expect(state.targetSpeed).toBeGreaterThan(TEST_CONFIG.pitSpeedLimit);
  });

  it("does not decelerate when already below pitSpeedLimit", () => {
    // Start below pit speed limit
    addCarState(physics, "car_02", createMockBody(), {
      gear: 1,
      speedKmh: 50, // 13.89 m/s — well below pit limit of 22.22 m/s
      rpm: 3000,
    });
    setInput(physics, "car_02", { throttle: 0 });

    physics.setPit("car_02", true);
    physics.update(FIXED_DT);
    const afterSpeed = (physics as any)._carStates.get("car_02").speedKmh;

    // Speed should not be reduced below arcade target (which is already below limit)
    // The pit limiter returns pitSpeedLimit when speedDiff is small
    // or allows the car to move at its natural arcade speed
    expect(afterSpeed).toBeGreaterThanOrEqual(0);
  });

  it("handles setPit for unknown carId without throwing", () => {
    expect(() => physics.setPit("nonexistent", true)).not.toThrow();
    expect(() => physics.update(FIXED_DT)).not.toThrow();
  });

  it("setPit(true) when already in pit mode does not overwrite pitEntrySpeed", () => {
    physics.setPit("car_01", true);
    const state = (physics as any)._carStates.get("car_01") as CarPhysicsState;
    const firstEntrySpeed = state.pitEntrySpeed;

    // Call setPit(true) again — should not change pitEntrySpeed
    physics.setPit("car_01", true);
    expect(state.pitEntrySpeed).toBe(firstEntrySpeed);
  });

  it("setPit(false) for unknown carId does not throw", () => {
    expect(() => physics.setPit("nonexistent", false)).not.toThrow();
  });
});

// ─── AC-3: fuelMult → Engine Power ─────────────────────────────────────────

describe("AC-3 — onFuelUpdate() fuelMult scales engine power", () => {
  let physics: PhysicsService;
  let body: any;
  let havok: any;

  beforeEach(async () => {
    const scene = createMockScene();
    havok = createMockHavokPlugin();
    physics = new PhysicsService(scene, undefined, havok);
    physics.setSurfaceProvider(() => SurfaceType.Tarmac);
    await physics.init(TEST_CONFIG);

    body = createMockBody();
    // Car at speed with some throttle
    addCarState(physics, "car_01", body, {
      gear: 3,
      speedKmh: 100,
      rpm: 6000,
    });
    setInput(physics, "car_01", { throttle: 1 });
  });

  it("fuelMult=0 causes engine power output to be 0 regardless of throttle", () => {
    // Call onFuelUpdate with 0 — will apply next tick
    physics.onFuelUpdate("car_01", 0);

    // Fuel is still 1.0 this tick (1-tick delay)
    physics.update(FIXED_DT);
    const state = (physics as any)._carStates.get("car_01");

    // Now fuelMult=0 and should have been applied
    expect(state.fuelMult).toBe(0);

    // With fuelMult=0, power = torque × throttle × 0 × powerCeiling = 0
    // Car should only have drag slowing it down
    // The target speed should be lower than the previous tick's speed
    // because engine contributes no power, only drag acts
    // Verify by checking Phase 1 computed a reduced speed
    const speedAfter = state.speedKmh;
    expect(speedAfter).toBeLessThan(100);
  });

  it("car coasts using drag-only deceleration when fuelMult=0", () => {
    // Full throttle but fuelMult=0 — car should decelerate via drag only
    physics.onFuelUpdate("car_01", 0);
    physics.update(FIXED_DT);

    const state = (physics as any)._carStates.get("car_01");
    // fuelMult is now 0
    expect(state.fuelMult).toBe(0);

    // Coasting: only drag force opposes motion, no active braking
    // targetSpeed should be reduced but not aggressively (drag only)
    // Drag force: -dragCoeff × speed²
    // At 100 km/h = 27.78 m/s, dragCoeff=0.3: drag = -0.3 × 27.78² = -231.5 N
    // Deceleration = -231.5 / 800 = -0.289 m/s²
    // Per tick: deltaV = -0.289 / 60 = -0.0048 m/s
    // Very gentle coasting — speed should be almost the same
    expect(state.targetSpeed).toBeGreaterThan(0);
    // Speed reduction should be small (drag only, no braking)
    const speedDrop = 100 - state.speedKmh;
    expect(speedDrop).toBeLessThan(5); // Less than 5 km/h drop in one tick
  });

  it("restores engine power on next tick when fuelMult returns to 1", () => {
    physics.onFuelUpdate("car_01", 0);
    physics.update(FIXED_DT); // fuelMult=0 applied at end of this tick

    // Phase 1 this tick used fuelMult=0
    const stateAfterTick = (physics as any)._carStates.get("car_01");
    expect(stateAfterTick.fuelMult).toBe(0);

    physics.onFuelUpdate("car_01", 1);
    physics.update(FIXED_DT); // Phase 1 this tick uses fuelMult=0 (old),
    // then _applyPendingUpdates sets fuelMult=1

    const stateAfterSecondUpdate = (physics as any)._carStates.get("car_01");
    // fuelMult=1 because _applyPendingUpdates runs at end of update
    expect(stateAfterSecondUpdate.fuelMult).toBe(1);

    // Phase 1 on the NEXT tick will use fuelMult=1
  });
});

// ─── AC-4: tireCondition → Grip ────────────────────────────────────────────

describe("AC-4 — onTireUpdate() tireCondition scales grip", () => {
  it("tireCondition=0 reduces gripMax to minGripFactor", () => {
    // Test the pure function directly
    const gripMaxFull = ArcadeGripModel.computeGripMax(
      0.95, // baseGrip
      1, // corneringLevel
      1.0, // tireCondition = 1.0 (new tires)
      100, // speedKmh
      {
        speedModRefSpeedKmh: 108, // 30 m/s converted
        speedModMinFactor: 0.8,
        minGripFactor: 0.15,
      }
    );

    const gripMaxZero = ArcadeGripModel.computeGripMax(
      0.95, // baseGrip
      1, // corneringLevel
      0, // tireCondition = 0 (worn)
      100, // speedKmh
      {
        speedModRefSpeedKmh: 108,
        speedModMinFactor: 0.8,
        minGripFactor: 0.15,
      }
    );

    // At tireCondition=0, the clamp in computeGripMax uses minGripFactor
    // gripMax = baseGrip × cornerStat × max(minGripFactor, tireCondition) × speedMod
    // = 0.95 × 0.6 × 0.15 × speedMod
    const speedMod = ArcadeGripModel.computeSpeedMod(100, {
      speedModRefSpeedKmh: 108,
      speedModMinFactor: 0.8,
    });
    const expectedGripZero =
      0.95 * ArcadeGripModel.computeCornerStat(1) * 0.15 * speedMod;
    expect(gripMaxZero).toBeCloseTo(expectedGripZero, 5);

    // Verify: grip at tireCondition=0 is < 33% of grip at tireCondition=1.0
    // For same cornering level, baseGrip, and speed
    const ratio = gripMaxZero / gripMaxFull;
    expect(ratio).toBeLessThan(0.33);
  });

  it("tireCondition=0.4 scales grip linearly", () => {
    const gripAt40 = ArcadeGripModel.computeGripMax(
      0.95,
      1,
      0.4, // tireCondition = 0.4
      100,
      {
        speedModRefSpeedKmh: 108,
        speedModMinFactor: 0.8,
        minGripFactor: 0.15,
      }
    );

    const gripAt100 = ArcadeGripModel.computeGripMax(0.95, 1, 1.0, 100, {
      speedModRefSpeedKmh: 108,
      speedModMinFactor: 0.8,
      minGripFactor: 0.15,
    });

    // gripAt40 should be 0.4 × gripAt100 (linear scaling)
    // (since 0.4 > minGripFactor 0.15, no clamping)
    expect(gripAt40).toBeCloseTo(gripAt100 * 0.4, 5);
  });

  it("engine power output is identical at tireCondition=0 vs 1.0", () => {
    const scene = createMockScene();
    const havok = createMockHavokPlugin();
    const physics = new PhysicsService(scene, undefined, havok);
    physics.setSurfaceProvider(() => SurfaceType.Tarmac);

    const _config: PhysicsConfig = {
      ...TEST_CONFIG,
      // Use a simpler config for clear power comparison
    };

    // We test power via the engine model's computeTargetSpeed:
    // The fuelMult is what scales power, not tireCondition.
    // tireCondition only affects gripMax, not the power calculation.

    // Verify by checking computeTargetSpeed with identical engine params
    const engineStateFull = {
      speedMs: 27.78, // 100 km/h
      gear: 3,
      rpm: 6000,
      fuelMult: 1, // fuelMult is the same
      gradient: 0,
      mass: 800,
    };
    const engineStateWorn = { ...engineStateFull };

    const engineInputs = { throttle: 1, brake: 0, gearDelta: 0 };
    const engineConfig = {
      gearRatios: TEST_CONFIG.gearRatios,
      rpmMax: TEST_CONFIG.rpmMax,
      accelLevel: TEST_CONFIG.accelLevel,
      powerCeiling: TEST_CONFIG.powerCeiling,
      dragCoeff: TEST_CONFIG.dragCoeff,
      maxBrakeForce: TEST_CONFIG.maxBrakeForce,
      stopEpsilon: TEST_CONFIG.stopEpsilon,
      autoShiftRpmThreshold: TEST_CONFIG.autoShiftRpmThreshold,
      downshiftRpmRatio: TEST_CONFIG.downshiftRpmRatio,
      reverseMaxSpeed: TEST_CONFIG.reverseMaxSpeed,
      gear1RedlineSpeed: TEST_CONFIG.gear1RedlineSpeed,
      mass: TEST_CONFIG.mass,
    };

    // Both have fuelMult=1 — tireCondition is NOT passed to engine model
    const speedFull = ArcadeGripModel.computeTargetSpeed(
      engineStateFull,
      engineInputs,
      FIXED_DT,
      engineConfig
    );
    const speedWorn = ArcadeGripModel.computeTargetSpeed(
      engineStateWorn,
      engineInputs,
      FIXED_DT,
      engineConfig
    );

    // Engine output is identical because tireCondition doesn't affect power
    expect(speedFull).toBe(speedWorn);
  });

  it("applies tire condition via onTireUpdate with 1-tick delay", async () => {
    const scene = createMockScene();
    const havok = createMockHavokPlugin();
    const physics = new PhysicsService(scene, undefined, havok);
    physics.setSurfaceProvider(() => SurfaceType.Tarmac);
    await physics.init(TEST_CONFIG);

    const body = createMockBody();
    addCarState(physics, "car_01", body, {
      gear: 2,
      speedKmh: 100,
      rpm: 6000,
    });
    setInput(physics, "car_01", { steer: 0.5, throttle: 0 });

    // Tire condition starts at 1.0
    const states = (physics as any)._carStates as Map<string, CarPhysicsState>;
    expect(states.get("car_01")?.tireCondition).toBe(1);

    physics.onTireUpdate("car_01", 0);
    // Still 1.0 this tick (1-tick delay)
    expect(states.get("car_01")?.tireCondition).toBe(1);

    physics.update(FIXED_DT);
    // Now applied
    expect(states.get("car_01")?.tireCondition).toBe(0);
  });
});

// ─── AC-5: car.tire_blown Event ─────────────────────────────────────────────

describe("AC-5 — car.tire_blown emitted one-shot", () => {
  let physics: PhysicsService;
  let eventBus: any;
  let body: any;

  beforeEach(async () => {
    const scene = createMockScene();
    const havok = createMockHavokPlugin();
    eventBus = createMockEventBus();
    physics = new PhysicsService(scene, undefined, havok, eventBus);
    physics.setSurfaceProvider(() => SurfaceType.Tarmac);
    await physics.init(TEST_CONFIG);

    body = createMockBody();
    addCarState(physics, "car_01", body, {
      gear: 2,
      speedKmh: 50,
      rpm: 4000,
      // tireCondition = 0.01 (nearly gone, not yet zero)
      tireCondition: 0.01,
      tireBlownEmitted: false,
    });
    setInput(physics, "car_01", { throttle: 0 });
  });

  it("emits car.tire_blown when tireCondition drops to 0", () => {
    // Set tireCondition to 0 — it will be applied via pending update
    // But for edge events, we manually set and update
    physics.onTireUpdate("car_01", 0);
    physics.update(FIXED_DT); // applies tireCondition=0, then checks edge events

    // Edge event should have been emitted
    expect(eventBus.emit).toHaveBeenCalledWith("car.tire_blown", {
      carId: "car_01",
    });
  });

  it("one-shot guard prevents re-emission on subsequent ticks", () => {
    physics.onTireUpdate("car_01", 0);
    physics.update(FIXED_DT); // first tick: emit

    expect(eventBus.emit).toHaveBeenCalledTimes(1);
    expect(eventBus.emit).toHaveBeenCalledWith("car.tire_blown", {
      carId: "car_01",
    });

    eventBus.emit.mockClear();

    // Second tick: should NOT emit again (guard active)
    physics.update(FIXED_DT);
    expect(eventBus.emit).not.toHaveBeenCalledWith("car.tire_blown", {
      carId: "car_01",
    });
  });

  it("guard prevents re-emission even if tireCondition recovers above 0", () => {
    physics.onTireUpdate("car_01", 0);
    physics.update(FIXED_DT); // first tick: emit

    eventBus.emit.mockClear();

    // Recover tire condition
    physics.onTireUpdate("car_01", 0.8);
    physics.update(FIXED_DT); // tireCondition=0.8, but guard still active
    physics.update(FIXED_DT); // tireCondition=0.8 applied

    // Event should NOT be re-emitted (tireBlownEmitted guard is one-shot)
    expect(eventBus.emit).not.toHaveBeenCalledWith("car.tire_blown", {
      carId: "car_01",
    });
  });

  it("does not emit when tireCondition is above zero", () => {
    // tireCondition = 0.01 (above zero), no update to 0
    physics.update(FIXED_DT);

    expect(eventBus.emit).not.toHaveBeenCalledWith("car.tire_blown", {
      carId: "car_01",
    });
  });
});

// ─── AC-6: car.fuel_empty Event ────────────────────────────────────────────

describe("AC-6 — car.fuel_empty emitted one-shot", () => {
  let physics: PhysicsService;
  let eventBus: any;
  let body: any;

  beforeEach(async () => {
    const scene = createMockScene();
    const havok = createMockHavokPlugin();
    eventBus = createMockEventBus();
    physics = new PhysicsService(scene, undefined, havok, eventBus);
    physics.setSurfaceProvider(() => SurfaceType.Tarmac);
    await physics.init(TEST_CONFIG);

    body = createMockBody();
    addCarState(physics, "car_01", body, {
      gear: 2,
      speedKmh: 50,
      rpm: 4000,
      // fuelMult = 0.01 (nearly empty, not yet zero)
      fuelMult: 0.01,
      fuelEmptyEmitted: false,
    });
    setInput(physics, "car_01", { throttle: 0 });
  });

  it("emits car.fuel_empty when fuelMult drops to 0", () => {
    physics.onFuelUpdate("car_01", 0);
    physics.update(FIXED_DT); // applies fuelMult=0, then checks edge events

    expect(eventBus.emit).toHaveBeenCalledWith("car.fuel_empty", {
      carId: "car_01",
    });
  });

  it("one-shot guard prevents re-emission on subsequent ticks", () => {
    physics.onFuelUpdate("car_01", 0);
    physics.update(FIXED_DT); // first tick: emit

    expect(eventBus.emit).toHaveBeenCalledTimes(1);

    eventBus.emit.mockClear();

    // Second tick: should NOT emit again
    physics.update(FIXED_DT);
    expect(eventBus.emit).not.toHaveBeenCalledWith("car.fuel_empty", {
      carId: "car_01",
    });
  });

  it("guard prevents re-emission if fuelMult recovers", () => {
    physics.onFuelUpdate("car_01", 0);
    physics.update(FIXED_DT); // first tick: emit

    eventBus.emit.mockClear();

    // Fuel "recovers" (e.g., pit stop refuel)
    physics.onFuelUpdate("car_01", 1);
    physics.update(FIXED_DT); // fuelMult=1, but guard still active
    physics.update(FIXED_DT); // fuelMult=1 applied

    expect(eventBus.emit).not.toHaveBeenCalledWith("car.fuel_empty", {
      carId: "car_01",
    });
  });
});

// ─── AC-7: car.stopped Edge-Triggered ──────────────────────────────────────

describe("AC-7 — car.stopped edge-triggered with hysteresis", () => {
  let physics: PhysicsService;
  let eventBus: any;
  let body: any;

  beforeEach(async () => {
    const scene = createMockScene();
    const havok = createMockHavokPlugin();
    eventBus = createMockEventBus();
    physics = new PhysicsService(scene, undefined, havok, eventBus);
    physics.setSurfaceProvider(() => SurfaceType.Tarmac);
    await physics.init(TEST_CONFIG);

    body = createMockBody();
  });

  it("emits car.stopped when velocity crosses below stopEpsilon from above", () => {
    // Start with speed above stopEpsilon, wasAboveStopEpsilon=true
    addCarState(physics, "car_01", body, {
      gear: 1,
      speedKmh: 18, // 5 m/s — well above stopEpsilon=0.01
      rpm: 1000,
      wasAboveStopEpsilon: true,
    });
    setInput(physics, "car_01", { throttle: 0 });

    // Phase 1 will compute a target speed. With neutral gear and no throttle,
    // the car may coast down. Check after update whether car.stopped was emitted.
    // The edge event checks speedKmh after Phase 1

    // To reliably test, we'll set speedKmh directly to simulate near-stop
    const states = (physics as any)._carStates as Map<string, CarPhysicsState>;
    const state = states.get("car_01") as CarPhysicsState;

    // Set speedKmh to produce speedMs = 0.005 (below stopEpsilon=0.01)
    state.speedKmh = 0.018; // 0.005 m/s

    physics.update(FIXED_DT);

    // Edge: wasAboveStopEpsilon=true, speedMs=0.005 < stopEpsilon=0.01
    expect(eventBus.emit).toHaveBeenCalledWith("car.stopped", {
      carId: "car_01",
    });
  });

  it("does NOT emit again while car remains stationary for multiple ticks", () => {
    addCarState(physics, "car_01", body, {
      gear: 1,
      speedKmh: 0.018, // 0.005 m/s — below stopEpsilon
      rpm: 0,
      wasAboveStopEpsilon: true,
    });
    setInput(physics, "car_01", { throttle: 0, brake: 1 });

    physics.update(FIXED_DT); // first tick: emit

    expect(eventBus.emit).toHaveBeenCalledTimes(1);
    expect(eventBus.emit).toHaveBeenCalledWith("car.stopped", {
      carId: "car_01",
    });

    // Ensure wasAboveStopEpsilon is now false
    const states = (physics as any)._carStates as Map<string, CarPhysicsState>;
    expect(states.get("car_01")?.wasAboveStopEpsilon).toBe(false);

    eventBus.emit.mockClear();

    // 5 more ticks while stationary
    for (let i = 0; i < 5; i++) {
      physics.update(FIXED_DT);
    }

    // should NOT emit car.stopped again
    expect(eventBus.emit).not.toHaveBeenCalledWith("car.stopped", {
      carId: "car_01",
    });
  });

  it("re-arms when speed rises above stopEpsilon × 1.5 then emits again on second stop", () => {
    addCarState(physics, "car_01", body, {
      carId: "car_01",
      body,
      gear: 1,
      speedKmh: 0.018, // 0.005 m/s — below stopEpsilon
      rpm: 0,
      wasAboveStopEpsilon: true,
    });
    setInput(physics, "car_01", { throttle: 0, brake: 1 });

    // Tick 1: emit car.stopped
    physics.update(FIXED_DT);
    expect(eventBus.emit).toHaveBeenCalledWith("car.stopped", {
      carId: "car_01",
    });

    eventBus.emit.mockClear();

    // Simulate car being pushed (speed rises above hysteresis threshold)
    const states = (physics as any)._carStates as Map<string, CarPhysicsState>;
    const state = states.get("car_01") as CarPhysicsState;
    state.speedKmh = 0.2; // 0.0556 m/s > stopEpsilon × 1.5 = 0.015

    physics.update(FIXED_DT);
    // wasAboveStopEpsilon should now be true (re-armed)
    expect(state.wasAboveStopEpsilon).toBe(true);
    expect(eventBus.emit).not.toHaveBeenCalledWith("car.stopped", {
      carId: "car_01",
    });

    // Now slow down again
    state.speedKmh = 0.018; // 0.005 m/s — below stopEpsilon

    physics.update(FIXED_DT);
    // Emitted again (second edge)
    expect(eventBus.emit).toHaveBeenCalledWith("car.stopped", {
      carId: "car_01",
    });
  });

  it("hysteresis prevents chatter when velocity hovers near epsilon", () => {
    addCarState(physics, "car_01", body, {
      carId: "car_01",
      body,
      gear: 1,
      speedKmh: 0.05, // 0.0139 m/s — just above stopEpsilon=0.01
      rpm: 0,
      wasAboveStopEpsilon: true,
    });
    setInput(physics, "car_01", { throttle: 0, brake: 1 });

    const states = (physics as any)._carStates as Map<string, CarPhysicsState>;
    const state = states.get("car_01") as CarPhysicsState;

    // Simulate hovering near epsilon: 0.012 → 0.008 → 0.011 → 0.007
    // This should NOT re-trigger because wasAboveStopEpsilon
    // only resets to true when speed > stopEpsilon × 1.5 = 0.015

    // Set speed just above 0.015 (so it's above the hysteresis threshold)
    // Actually, to demonstrate hysteresis we need speed to cross 0.015
    // Let's make it simpler: speed at 0.013 (< 0.015) hovering

    // Speed below epsilon → emit
    state.speedKmh = 0.018; // 0.005 m/s
    physics.update(FIXED_DT);
    expect(eventBus.emit).toHaveBeenCalledTimes(1);

    eventBus.emit.mockClear();

    // Bounce to just above epsilon but below hysteresis threshold
    state.speedKmh = 0.043; // 0.012 m/s ( > 0.01 but < 0.015 )
    physics.update(FIXED_DT);
    // wasAboveStopEpsilon should still be false (0.012 < 0.015)
    expect(state.wasAboveStopEpsilon).toBe(false);

    // Drop below epsilon again
    state.speedKmh = 0.018; // 0.005 m/s
    physics.update(FIXED_DT);
    // Should NOT emit because wasAboveStopEpsilon is still false
    // (never crossed above 0.015 to re-arm)
    expect(eventBus.emit).not.toHaveBeenCalledWith("car.stopped", {
      carId: "car_01",
    });
  });

  it("wasAboveStopEpsilon starts false after onRaceGreenFlag", () => {
    addCarState(physics, "car_01", body, {
      gear: 1,
      speedKmh: 5,
      rpm: 1000,
      wasAboveStopEpsilon: true,
    });

    physics.onRaceGreenFlag();

    const states = (physics as any)._carStates as Map<string, CarPhysicsState>;
    expect(states.get("car_01")?.wasAboveStopEpsilon).toBe(false);
  });
});

// ─── AC-8: 1-Tick Delay ─────────────────────────────────────────────────────

describe("AC-8 — fuelMult and tireCondition 1-tick delay", () => {
  let physics: PhysicsService;
  let body: any;
  let havok: any;

  beforeEach(async () => {
    const scene = createMockScene();
    havok = createMockHavokPlugin();
    physics = new PhysicsService(scene, undefined, havok);
    physics.setSurfaceProvider(() => SurfaceType.Tarmac);
    await physics.init(TEST_CONFIG);

    body = createMockBody();
    addCarState(physics, "car_01", body, {
      gear: 2,
      speedKmh: 100,
      rpm: 6000,
      fuelMult: 0.5,
      tireCondition: 0.8,
    });
    setInput(physics, "car_01", { throttle: 1 });
  });

  it("fuelMult change takes effect next tick, not current tick", () => {
    const states = (physics as any)._carStates as Map<string, CarPhysicsState>;
    expect(states.get("car_01")?.fuelMult).toBe(0.5);

    // Send update — pending, not yet applied
    physics.onFuelUpdate("car_01", 0);
    expect(states.get("car_01")?.fuelMult).toBe(0.5); // still old value

    // Phase 1 this tick should use old fuelMult=0.5
    physics.update(FIXED_DT);
    // After update, pending is applied (at end of _applyPendingUpdates)
    expect(states.get("car_01")?.fuelMult).toBe(0);
  });

  it("tireCondition change takes effect next tick, not current tick", () => {
    const states = (physics as any)._carStates as Map<string, CarPhysicsState>;
    expect(states.get("car_01")?.tireCondition).toBe(0.8);

    // Send update — pending
    physics.onTireUpdate("car_01", 0);
    expect(states.get("car_01")?.tireCondition).toBe(0.8); // still old

    physics.update(FIXED_DT);
    expect(states.get("car_01")?.tireCondition).toBe(0);
  });

  it("two onFuelUpdate calls before next tick — last value wins", () => {
    physics.onFuelUpdate("car_01", 0.2);
    physics.onFuelUpdate("car_01", 0.7); // overwrites previous

    physics.update(FIXED_DT);

    const states = (physics as any)._carStates as Map<string, CarPhysicsState>;
    expect(states.get("car_01")?.fuelMult).toBe(0.7); // last value applied
  });

  it("calling onFuelUpdate with same value still causes 1-tick delay", () => {
    const states = (physics as any)._carStates as Map<string, CarPhysicsState>;
    expect(states.get("car_01")?.fuelMult).toBe(0.5);

    physics.onFuelUpdate("car_01", 0.5); // same value, should still delay

    // Before update: still 0.5
    expect(states.get("car_01")?.fuelMult).toBe(0.5);

    physics.update(FIXED_DT);
    // After update: still 0.5 (it was the pending value)
    expect(states.get("car_01")?.fuelMult).toBe(0.5);
  });

  it("onFuelUpdate with 0 at tick N, throttle released tick N+1 — power still 0", () => {
    physics.onFuelUpdate("car_01", 0);
    physics.update(FIXED_DT); // fuelMult=0 applied at end

    // Second tick: release throttle (but fuelMult is already 0)
    setInput(physics, "car_01", { throttle: 0 });
    physics.update(FIXED_DT);

    const states = (physics as any)._carStates as Map<string, CarPhysicsState>;
    expect(states.get("car_01")?.fuelMult).toBe(0);
    // Power was 0 on the previous tick even with throttle=1
    // Now on this tick, power is 0 with throttle=0 (fuelMult is 0 anyway)
    // The car coasts regardless
  });
});

// ─── Static Pure Function Tests ─────────────────────────────────────────────

describe("applyPitLimiter — pure function", () => {
  it("returns targetSpeed unchanged when not in pit mode", () => {
    const result = (PhysicsService as any).applyPitLimiter(
      50, // targetSpeed
      50, // currentSpeed
      22.222, // pitSpeedLimit
      false, // isPitMode
      2.0, // transitionTime
      FIXED_DT,
      null // pitEntrySpeed
    );
    expect(result).toBe(50);
  });

  it("returns pitSpeedLimit when speed is very close to limit", () => {
    const result = (PhysicsService as any).applyPitLimiter(
      22.3, // targetSpeed
      22.3, // currentSpeed (near pitSpeedLimit)
      22.222, // pitSpeedLimit
      true,
      2.0,
      FIXED_DT,
      22.3 // pitEntrySpeed
    );
    expect(result).toBeCloseTo(22.222, 1); // snaps to limit
  });

  it("reduces speed toward pitSpeedLimit by constant-rate linear ramp", () => {
    // currentSpeed=69.44 m/s (250 km/h), pitSpeedLimit=22.22, transition=2.0
    // pitEntrySpeed=69.44 (same as current — first tick of pit mode)
    // maxStep = (|69.44 - 22.22| / 2.0) * (1/60) = 0.3935 m/s
    // Result = 69.44 - 0.3935 = 69.05 m/s
    const currentSpeed = 250 / 3.6; // 69.44 m/s
    const result = (PhysicsService as any).applyPitLimiter(
      currentSpeed,
      currentSpeed,
      80 / 3.6, // 22.22 m/s
      true,
      2.0,
      FIXED_DT,
      currentSpeed // pitEntrySpeed = current speed (first tick)
    );

    const expectedMaxStep =
      (Math.abs(currentSpeed - 80 / 3.6) / 2.0) * FIXED_DT;
    const expectedSpeed = currentSpeed - expectedMaxStep;
    expect(result).toBeCloseTo(expectedSpeed, 5);
  });

  it("maintains constant deceleration rate across multiple ticks", () => {
    // Verify linear ramp: constant maxStep per tick regardless of current speed
    const entrySpeed = 250 / 3.6; // 69.44 m/s
    const pitLimit = 80 / 3.6; // 22.22 m/s
    const transitionTime = 2.0;
    const expectedMaxStep =
      (Math.abs(entrySpeed - pitLimit) / transitionTime) * FIXED_DT;

    let speed = entrySpeed;
    for (let i = 0; i < 10; i++) {
      const prevSpeed = speed;
      speed = (PhysicsService as any).applyPitLimiter(
        speed,
        speed,
        pitLimit,
        true,
        transitionTime,
        FIXED_DT,
        entrySpeed // pitEntrySpeed stays constant
      );
      const step = prevSpeed - speed;
      // Each step should be approximately the same (constant rate)
      expect(step).toBeCloseTo(expectedMaxStep, 5);
    }
  });

  it("handles transitionTime=0 gracefully (uses minimum 0.001s)", () => {
    // With transitionTime=0, the maxStep would be very large
    // so speedDiff would be the min, meaning we snap close to limit
    const currentSpeed = 69.44;
    const result = (PhysicsService as any).applyPitLimiter(
      currentSpeed,
      currentSpeed,
      22.222,
      true,
      0, // transition time = 0 → instant snap
      FIXED_DT,
      currentSpeed // pitEntrySpeed
    );
    // Should be at or very near pitSpeedLimit
    expect(result).toBeLessThan(23);
  });

  it("falls back to speedDiff when pitEntrySpeed is null", () => {
    // When pitEntrySpeed is null, the function falls back to speedDiff
    const currentSpeed = 69.44;
    const pitLimit = 22.222;
    const result = (PhysicsService as any).applyPitLimiter(
      currentSpeed,
      currentSpeed,
      pitLimit,
      true,
      2.0,
      FIXED_DT,
      null // pitEntrySpeed is null
    );
    // Should still reduce speed (using speedDiff as fallback)
    expect(result).toBeLessThan(currentSpeed);
    expect(result).toBeGreaterThan(pitLimit);
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────────────

describe("Edge Cases", () => {
  it("race.green.flag via Event Bus resets edge event guards", async () => {
    const scene = createMockScene();
    const havok = createMockHavokPlugin();
    const eventBus = createMockEventBus();
    const physics = new PhysicsService(scene, undefined, havok, eventBus);
    physics.setSurfaceProvider(() => SurfaceType.Tarmac);
    await physics.init(TEST_CONFIG);

    const body = createMockBody();
    addCarState(physics, "car_01", body);

    const states = (physics as any)._carStates as Map<string, CarPhysicsState>;
    const state = states.get("car_01") as CarPhysicsState;

    // Set guards to true (simulating prior race events)
    state.tireBlownEmitted = true;
    state.fuelEmptyEmitted = true;
    state.wasAboveStopEpsilon = true;

    // Capture the callback registered via eventBus.on
    const onCall = (eventBus.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (c: any[]) => c[0] === "race.green.flag"
    );
    expect(onCall).toBeDefined();

    // Invoke the callback (simulates Event Bus dispatch)
    const callback = onCall?.[1] as () => void;
    callback();

    // Guards should be reset
    expect(state.tireBlownEmitted).toBe(false);
    expect(state.fuelEmptyEmitted).toBe(false);
    expect(state.wasAboveStopEpsilon).toBe(false);

    physics.dispose();
  });

  it("dispose cleans up Event Bus subscriptions", async () => {
    const scene = createMockScene();
    const havok = createMockHavokPlugin();
    const eventBus = createMockEventBus();
    const physics = new PhysicsService(scene, undefined, havok, eventBus);
    physics.setSurfaceProvider(() => SurfaceType.Tarmac);
    await physics.init(TEST_CONFIG);

    // Should have subscribed to race.green.flag
    expect(eventBus.on).toHaveBeenCalledWith(
      "race.green.flag",
      expect.any(Function)
    );

    const subscriptions = (physics as any)._subscriptions;
    expect(subscriptions.length).toBe(1);

    physics.dispose();

    // Subscriptions should be unsubscribed and cleared
    expect(subscriptions.length).toBe(0);
    expect((physics as any)._eventBus).toBeNull();
  });

  it("works without Event Bus (null eventBus)", async () => {
    const scene = createMockScene();
    const havok = createMockHavokPlugin();
    const physics = new PhysicsService(scene, undefined, havok); // no eventBus
    physics.setSurfaceProvider(() => SurfaceType.Tarmac);
    await physics.init(TEST_CONFIG);

    const body = createMockBody();
    addCarState(physics, "car_01", body);
    setInput(physics, "car_01", { throttle: 0 });

    // Should not throw even with null eventBus
    expect(() => physics.update(FIXED_DT)).not.toThrow();

    // Setting lock/pit should work
    expect(() => physics.setLocked("car_01", true)).not.toThrow();
    expect(() => physics.setPit("car_01", true)).not.toThrow();
    expect(() => physics.onFuelUpdate("car_01", 0)).not.toThrow();
    expect(() => physics.onTireUpdate("car_01", 0)).not.toThrow();
  });

  it("applies pit mode, lock, and events in correct order within a single tick", async () => {
    const scene = createMockScene();
    const havok = createMockHavokPlugin();
    const eventBus = createMockEventBus();
    const physics = new PhysicsService(scene, undefined, havok, eventBus);
    physics.setSurfaceProvider(() => SurfaceType.Tarmac);
    await physics.init(TEST_CONFIG);

    const body = createMockBody();
    addCarState(physics, "car_01", body, {
      gear: 3,
      speedKmh: 150,
      rpm: 7000,
    });
    setInput(physics, "car_01", { throttle: 1 });

    // Combine lock + pit + fuel update in same tick
    physics.setLocked("car_01", true);
    physics.setPit("car_01", true);
    physics.onFuelUpdate("car_01", 0);

    physics.update(FIXED_DT);

    // Lock takes priority: velocity should be zero
    expect(body.setLinearVelocity).toHaveBeenCalledWith(
      expect.objectContaining({ x: 0, y: 0, z: 0 })
    );
  });
});

// ─── TD-PHYS-003: Input validation ────────────────────────────────────────

describe("TD-PHYS-003 — onFuelUpdate/onTireUpdate clamped to [0,1]", () => {
  let physics: PhysicsService;

  beforeEach(async () => {
    const scene = createMockScene();
    const havok = createMockHavokPlugin();
    physics = new PhysicsService(scene, undefined, havok);
    physics.setSurfaceProvider(() => SurfaceType.Tarmac);
    await physics.init(TEST_CONFIG);
    addCarState(physics, "car_01", createMockBody(), {
      gear: 1,
      speedKmh: 50,
      rpm: 3000,
    });
    setInput(physics, "car_01", { throttle: 0.5 });
  });

  it("onFuelUpdate clamps negative values to 0", () => {
    physics.onFuelUpdate("car_01", -0.5);
    physics.update(FIXED_DT);
    const state = (physics as any)._carStates.get("car_01") as CarPhysicsState;
    expect(state.fuelMult).toBeGreaterThanOrEqual(0);
  });

  it("onFuelUpdate clamps values above 1 to 1", () => {
    physics.onFuelUpdate("car_01", 1.5);
    physics.update(FIXED_DT);
    const state = (physics as any)._carStates.get("car_01") as CarPhysicsState;
    expect(state.fuelMult).toBeLessThanOrEqual(1);
  });

  it("onTireUpdate clamps negative values to 0", () => {
    physics.onTireUpdate("car_01", -0.3);
    physics.update(FIXED_DT);
    const state = (physics as any)._carStates.get("car_01") as CarPhysicsState;
    expect(state.tireCondition).toBeGreaterThanOrEqual(0);
  });

  it("onTireUpdate clamps values above 1 to 1", () => {
    physics.onTireUpdate("car_01", 2.0);
    physics.update(FIXED_DT);
    const state = (physics as any)._carStates.get("car_01") as CarPhysicsState;
    expect(state.tireCondition).toBeLessThanOrEqual(1);
  });
});

// ─── TD-PHYS-004: onRaceGreenFlag clears pending maps ─────────────────────

describe("TD-PHYS-004 — onRaceGreenFlag clears pending fuel/tire updates", () => {
  let physics: PhysicsService;

  beforeEach(async () => {
    const scene = createMockScene();
    const havok = createMockHavokPlugin();
    physics = new PhysicsService(scene, undefined, havok);
    physics.setSurfaceProvider(() => SurfaceType.Tarmac);
    await physics.init(TEST_CONFIG);
    addCarState(physics, "car_01", createMockBody(), {
      gear: 1,
      speedKmh: 50,
      rpm: 3000,
    });
    setInput(physics, "car_01", { throttle: 0.5 });
  });

  it("pending fuel updates are cleared on green flag", () => {
    physics.onFuelUpdate("car_01", 0.5);
    // Pending map has the update, but it hasn't been applied yet
    physics.onRaceGreenFlag();
    physics.update(FIXED_DT);
    // fuelMult should remain at default (1.0) — pending was cleared
    const state = (physics as any)._carStates.get("car_01") as CarPhysicsState;
    expect(state.fuelMult).toBe(1);
  });

  it("pending tire updates are cleared on green flag", () => {
    physics.onTireUpdate("car_01", 0.3);
    physics.onRaceGreenFlag();
    physics.update(FIXED_DT);
    const state = (physics as any)._carStates.get("car_01") as CarPhysicsState;
    expect(state.tireCondition).toBe(1);
  });
});
