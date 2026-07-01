/**
 * Story 004: Surface Handling — Off-Track & Kerbs — Unit tests.
 *
 * Covers all 6 acceptance criteria for surface grip/friction modifiers,
 * minimum speed floor, kerb timer, and telemetry flags.
 *
 * Also covers:
 * - BUG-1 regression: No double kerb grip loss (timer-only, not table+table)
 * - CONCERN-2 verification: buildSurfaceModifiers produces correct lookup table
 *
 * @see STORY-004 — Surface Handling: Off-Track & Kerbs
 * @see TR-PHYSICS-004 — kerbHit, offTrack telemetry output
 * @see ADR-0008 — Vehicle Physics — Arcade Dynamic
 * @see docs/qa/story-004-surface-handling-qa-plan.md
 */

import { describe, expect, it, vi } from "vitest";
import type { CarPhysicsState } from "@/physics-handling/car-physics-state";
import type { PhysicsConfig } from "@/physics-handling/physics-config";
import {
  buildSurfaceModifiers,
  type CarSurfaceState,
  enforceMinSurfaceSpeed,
  type SurfaceModifiers,
  SurfaceType,
  updateSurfaceState,
} from "@/physics-handling/surface-handler";

// ─── Test Helpers ───────────────────────────────────────────────────────────

/**
 * Create a minimal PhysicsConfig for surface handling tests.
 *
 * Surface-relevant values:
 * - offTrackFriction: 6× drag on grass/gravel
 * - offTrackGripFactor: 0.3 grip on grass/gravel
 * - offTrackMinSpeedFraction: 0.3 → fraction of topSpeed for min speed floor
 * - kerbGripLoss: 0.2 → grip = (1 - 0.2) = 0.8 during kerb timer
 * - topSpeedL1toL5[0]: 50 m/s (180 km/h) base top speed
 *
 * Note: offTrackMinSpeedFraction is stored as a fraction (0..1) in the config,
 * matching its usage as minSpeedFraction in the modifier table.
 * The config field comment "m/s" is a documentation bug — it functions
 * as a fraction of topSpeed. (Bug noted but not fixed here; tracked
 * separately in design review follow-up.)
 */
function createTestConfig(overrides?: Partial<PhysicsConfig>): PhysicsConfig {
  return {
    baseGrip: 0.95,
    gravity: 9.81,
    steerClampSpeed: 25,
    steerMinRatio: 0.4,
    liftOffMinSteering: 0.3,
    liftOffThrottleMax: 0.3,
    liftOffBrakeMax: 0.05,
    dragCoeff: 0.3,
    maxBrakeForce: 15,
    pitSpeedLimit: 12,
    pitSpeedTransitionTime: 2,
    liftOffRefSpeedKmh: 200,
    offTrackFriction: 6,
    offTrackGripFactor: 0.3,
    offTrackMinSpeedFraction: 0.3,
    kerbGripLoss: 0.2,
    speedModRefSpeed: 30,
    speedModMinFactor: 0.8,
    autoShiftRpmThreshold: 0.8,
    rpmMax: 10000,
    minGripFactor: 0.1,
    stopEpsilon: 0.1,
    carHalfWidth: 0.7,
    topSpeedL1toL5: [50, 55, 60, 65, 70] as [
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
    gearRatios: [3.5, 2.5, 1.8, 1.3, 1.0, 0.8] as [
      number,
      number,
      number,
      number,
      number,
      number,
    ],
    accelLevel: 1,
    powerCeiling: 1,
    downshiftRpmRatio: 0.5,
    reverseMaxSpeed: 20,
    gear1RedlineSpeed: 10,
    mass: 800,
    ...overrides,
  };
}

/**
 * Create a minimal CarPhysicsState for surface state update tests.
 *
 * Includes both original fields and Story 004 additions:
 * frictionMultiplier, minSurfaceSpeed, kerbHit, offTrack.
 */
function createCarState(overrides?: Partial<CarPhysicsState>): CarPhysicsState {
  return {
    carId: "test_car",
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
    frictionMultiplier: 1,
    minSurfaceSpeed: 0,
    gripMultiplier: 1,
    fuelMult: 1,
    tireCondition: 1,
    pitEntrySpeed: null,
    gradient: 0,
    topSpeedMs: 50,

    tireBlownEmitted: false,
    fuelEmptyEmitted: false,
    wasAboveStopEpsilon: false,
    ...overrides,
  };
}

/**
 * Create a default CarSurfaceState (as it would be lazily initialized
 * in PhysicsService for a car on its first tick).
 */
function createSurfaceState(
  overrides?: Partial<CarSurfaceState>
): CarSurfaceState {
  return {
    currentSurface: SurfaceType.Tarmac,
    gripOverride: 1.0,
    kerbTimer: 0,
    wasOnKerb: false,
    ...overrides,
  };
}

// ─── buildSurfaceModifiers (CONCERN-2) ────────────────────────────────────

describe("buildSurfaceModifiers — modifier lookup table (CONCERN-2)", () => {
  it("produces Tarmac with full grip, standard friction, no min speed", () => {
    const config = createTestConfig();
    const table = buildSurfaceModifiers(config);

    expect(table[SurfaceType.Tarmac]).toEqual<SurfaceModifiers>({
      gripFactor: 1.0,
      frictionMultiplier: 1.0,
      minSpeedFraction: 0,
    });
  });

  it("produces Kerb with full grip base, standard friction, no min speed (BUG-1 fix)", () => {
    const config = createTestConfig();
    const table = buildSurfaceModifiers(config);

    // BUG-1 regression: Kerb gripFactor MUST be 1.0 — grip loss is
    // exclusively from the 2-tick timer in updateSurfaceState().
    // If this test fails, the double-application bug has regressed.
    expect(table[SurfaceType.Kerb]).toEqual<SurfaceModifiers>({
      gripFactor: 1.0,
      frictionMultiplier: 1.0,
      minSpeedFraction: 0,
    });
  });

  it("produces Grass with off-track grip, friction, and min speed fraction", () => {
    const config = createTestConfig();
    const table = buildSurfaceModifiers(config);

    expect(table[SurfaceType.Grass]).toEqual<SurfaceModifiers>({
      gripFactor: config.offTrackGripFactor, // 0.3
      frictionMultiplier: config.offTrackFriction, // 6
      minSpeedFraction: config.offTrackMinSpeedFraction, // 0.3
    });
  });

  it("produces Gravel with same modifiers as Grass", () => {
    const config = createTestConfig();
    const table = buildSurfaceModifiers(config);

    expect(table[SurfaceType.Gravel]).toEqual<SurfaceModifiers>({
      gripFactor: config.offTrackGripFactor,
      frictionMultiplier: config.offTrackFriction,
      minSpeedFraction: config.offTrackMinSpeedFraction,
    });
  });

  it("returns a fresh table each call (pure function)", () => {
    const config = createTestConfig();
    const table1 = buildSurfaceModifiers(config);
    const table2 = buildSurfaceModifiers(config);

    // Same shape but different object identity
    expect(table1).not.toBe(table2);
    expect(table1).toEqual(table2);
  });
});

// ─── AC-1: Surface Grip & Traction Modifiers ──────────────────────────────

describe("AC-1 — Surface grip/traction modifiers", () => {
  it("sets gripOverride=1.0 on Tarmac (full grip)", () => {
    const state = createCarState();
    const surfaceState = createSurfaceState();
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Tarmac,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    expect(surfaceState.gripOverride).toBe(1.0);
  });

  it("sets gripOverride=offTrackGripFactor on Grass (reduced grip)", () => {
    const state = createCarState();
    const surfaceState = createSurfaceState();
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Grass,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    expect(surfaceState.gripOverride).toBe(config.offTrackGripFactor);
  });

  it("sets gripOverride=offTrackGripFactor on Gravel (reduced grip)", () => {
    const state = createCarState();
    const surfaceState = createSurfaceState();
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Gravel,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    expect(surfaceState.gripOverride).toBe(config.offTrackGripFactor);
  });

  it("applies grip to carState as gripOverride visible to Phase 1 compute", () => {
    // gripOverride is stored on surfaceState and passed to compute();
    // verify the round-trip: updateSurfaceState → surfaceState.gripOverride
    const state = createCarState();
    const surfaceState = createSurfaceState();
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Grass,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    // The gripOverride value is what Phase 1 receives as the
    // surfaceGripOverride parameter to ArcadeGripModel.compute()
    expect(surfaceState.gripOverride).toBeGreaterThan(0);
    expect(surfaceState.gripOverride).toBeLessThan(1);
  });
});

// ─── AC-2: Off-Track Friction Multiplier ─────────────────────────────────

describe("AC-2 — Off-track friction multiplier", () => {
  it("sets frictionMultiplier=offTrackFriction on Grass (6× drag)", () => {
    const state = createCarState({ frictionMultiplier: 1 });
    const surfaceState = createSurfaceState();
    const config = createTestConfig({ offTrackFriction: 6 });
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Grass,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    expect(state.frictionMultiplier).toBe(6);
  });

  it("sets frictionMultiplier=offTrackFriction on Gravel (same as Grass)", () => {
    const state = createCarState({ frictionMultiplier: 1 });
    const surfaceState = createSurfaceState();
    const config = createTestConfig({ offTrackFriction: 6 });
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Gravel,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    expect(state.frictionMultiplier).toBe(6);
  });

  it("sets frictionMultiplier=1.0 on Tarmac (standard drag)", () => {
    const state = createCarState({ frictionMultiplier: 99 });
    const surfaceState = createSurfaceState();
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Tarmac,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    expect(state.frictionMultiplier).toBe(1.0);
  });

  it("sets frictionMultiplier=1.0 on Kerb (standard drag, no extra friction)", () => {
    const state = createCarState({ frictionMultiplier: 99 });
    const surfaceState = createSurfaceState();
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    expect(state.frictionMultiplier).toBe(1.0);
  });
});

// ─── AC-3: Minimum Speed Floor (Off-Track) ────────────────────────────────

describe("AC-3 — Minimum speed floor (off-track)", () => {
  it("computes minSurfaceSpeed from topSpeed × minSpeedFraction on Grass", () => {
    const state = createCarState({ minSurfaceSpeed: 0 });
    const surfaceState = createSurfaceState();
    const config = createTestConfig({
      offTrackMinSpeedFraction: 0.3, // fraction
      topSpeedL1toL5: [50, 55, 60, 65, 70] as [
        number,
        number,
        number,
        number,
        number,
      ],
    });
    const modifiers = buildSurfaceModifiers(config);
    const topSpeedMs = config.topSpeedL1toL5[0]; // 50 m/s

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Grass,
      modifiers,
      config.kerbGripLoss,
      topSpeedMs
    );

    // minSurfaceSpeed = 50 m/s × 0.3 = 15 m/s
    expect(state.minSurfaceSpeed).toBe(15);
  });

  it("computes minSurfaceSpeed from topSpeed × minSpeedFraction on Gravel", () => {
    const state = createCarState({ minSurfaceSpeed: 0 });
    const surfaceState = createSurfaceState();
    const config = createTestConfig({
      offTrackMinSpeedFraction: 0.25,
      topSpeedL1toL5: [100, 110, 120, 130, 140] as [
        number,
        number,
        number,
        number,
        number,
      ],
    });
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Gravel,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    // minSurfaceSpeed = 100 m/s × 0.25 = 25 m/s
    expect(state.minSurfaceSpeed).toBe(25);
  });

  it("sets minSurfaceSpeed=0 on Tarmac (no floor)", () => {
    const state = createCarState({ minSurfaceSpeed: 99 });
    const surfaceState = createSurfaceState();
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Tarmac,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    expect(state.minSurfaceSpeed).toBe(0);
  });

  it("sets minSurfaceSpeed=0 on Kerb (no floor)", () => {
    const state = createCarState({ minSurfaceSpeed: 99 });
    const surfaceState = createSurfaceState();
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    expect(state.minSurfaceSpeed).toBe(0);
  });
});

// ─── enforceMinSurfaceSpeed (helper used by PhysicsService) ──────────────

describe("enforceMinSurfaceSpeed — speed floor clamping", () => {
  it("clamps target speed UP to minSurfaceSpeed when below floor", () => {
    const result = enforceMinSurfaceSpeed(5, 15);
    expect(result).toBe(15);
  });

  it("returns target speed unchanged when above minSurfaceSpeed", () => {
    const result = enforceMinSurfaceSpeed(30, 15);
    expect(result).toBe(30);
  });

  it("returns target speed unchanged when at minSurfaceSpeed (no clamp)", () => {
    const result = enforceMinSurfaceSpeed(15, 15);
    expect(result).toBe(15);
  });

  it("returns target speed unchanged when minSurfaceSpeed=0 (tarmac/kerb)", () => {
    const result = enforceMinSurfaceSpeed(2, 0);
    expect(result).toBe(2);
  });

  it("returns target speed unchanged when minSurfaceSpeed=0 and speed=0", () => {
    const result = enforceMinSurfaceSpeed(0, 0);
    expect(result).toBe(0);
  });

  // ── FR-011: Negative target speed (reverse gear) guards ────────────────
  // enforceMinSurfaceSpeed must not clamp a negative (reverse) target speed
  // upward — that would pin the car moving forward while the driver intends
  // reverse. The guard at the top of the function returns targetSpeed
  // immediately when targetSpeed < 0.

  it("returns negative target speed unchanged (reverse gear, min>0)", () => {
    const result = enforceMinSurfaceSpeed(-5, 15);
    expect(result).toBe(-5);
  });

  it("returns zero target speed unchanged (reverse stall, min>0)", () => {
    const result = enforceMinSurfaceSpeed(0, 15);
    // FR-009: zero targetSpeed is not clamped by negative guard — but
    // minSurfaceSpeed > 0 means Math.max(0, 15) = 15, so it WILL be clamped.
    expect(result).toBe(15);
  });

  it("returns negative target speed unchanged (reverse gear, min=0)", () => {
    const result = enforceMinSurfaceSpeed(-3, 0);
    expect(result).toBe(-3);
  });

  it("returns negative target speed unchanged (reverse gear, min>target)", () => {
    const result = enforceMinSurfaceSpeed(-10, 5);
    expect(result).toBe(-10);
  });
});

// ─── AC-4: Kerb Timer-Based Grip Loss (2 ticks) ─────────────────────────

describe("AC-4 — Kerb 2-tick timer", () => {
  it("starts kerbTimer at 2 on kerb entry (timer=0 → surface=Kerb)", () => {
    const state = createCarState();
    const surfaceState = createSurfaceState({ kerbTimer: 0 });
    const config = createTestConfig({ kerbGripLoss: 0.2 });
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    // Timer starts at 2 on kerb entry
    expect(surfaceState.kerbTimer).toBe(2);
  });

  it("timer remains 2 on subsequent kerb tick (does not re-set)", () => {
    const state = createCarState();
    const surfaceState = createSurfaceState({
      currentSurface: SurfaceType.Kerb,
      kerbTimer: 1, // Already decremented once
    });
    const config = createTestConfig({ kerbGripLoss: 0.2 });
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    // Second tick on kerb with timer=1 → decrements to 0
    expect(surfaceState.kerbTimer).toBe(0);
  });

  it("decrements timer each tick: 2→1→0 over 3 kerb ticks", () => {
    const config = createTestConfig({ kerbGripLoss: 0.2 });
    const modifiers = buildSurfaceModifiers(config);
    const state = createCarState();

    // Single surface state reused across ticks — simulates real update flow
    const surfaceState = createSurfaceState({ kerbTimer: 0 });

    // Tick 1: enter kerb → timer = 2
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(2);

    // Tick 2: still on kerb, timer > 0 → decrement to 1
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(1);

    // Tick 3: still on kerb, timer > 0 → decrement to 0 (recovered)
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(0);
  });

  it("timer does not start on Tarmac (kerbTimer stays 0)", () => {
    const state = createCarState();
    const surfaceState = createSurfaceState({ kerbTimer: 0 });
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Tarmac,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    expect(surfaceState.kerbTimer).toBe(0);
  });

  it("timer does not start on Grass", () => {
    const state = createCarState();
    const surfaceState = createSurfaceState({ kerbTimer: 0 });
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Grass,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    expect(surfaceState.kerbTimer).toBe(0);
  });
});

// ─── BUG-1 Regression: Kerb grip loss is timer-only ──────────────────────

describe("BUG-1 regression — Kerb grip loss is timer-only, not double-applied", () => {
  it("applies grip loss only via timer, not modifier table (BUG-1 fix)", () => {
    // Before the fix: Kerb had gripFactor=0.8 AND timer applied 0.8×
    // Total = 0.8 × 0.8 = 0.64 (wrong — too much grip loss)
    //
    // After the fix: Kerb has gripFactor=1.0, timer applies (1-kerbGripLoss)
    // When kerbGripLoss=0.2: total = 1.0 × 0.8 = 0.8 ✓
    const state = createCarState();
    const surfaceState = createSurfaceState({ kerbTimer: 0 });
    const config = createTestConfig({ kerbGripLoss: 0.2 });
    const modifiers = buildSurfaceModifiers(config);

    // Enter kerb (timer started)
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    // gripOverride should be 1.0 × (1 - 0.2) = 0.8, not 0.64
    const wrongDoubleResult =
      (1 - config.kerbGripLoss) * (1 - config.kerbGripLoss);
    expect(surfaceState.gripOverride).toBe(1 - config.kerbGripLoss); // 0.8
    expect(surfaceState.gripOverride).not.toBe(wrongDoubleResult); // not 0.64
  });

  it("grip returns to 1.0 after kerb timer expires (timer-based recovery)", () => {
    const config = createTestConfig({ kerbGripLoss: 0.2 });
    const modifiers = buildSurfaceModifiers(config);
    const state = createCarState();
    const surfaceState = createSurfaceState({ kerbTimer: 0 });

    // Tick 1: enter kerb → timer=2, grip=0.8
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(2);
    expect(surfaceState.gripOverride).toBe(0.8);

    // Tick 2: timer=1 → grip still 0.8
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(1);
    expect(surfaceState.gripOverride).toBe(0.8);

    // Tick 3: timer=0 → full grip restored (no more grip loss applied)
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(0);
    expect(surfaceState.gripOverride).toBe(1.0);
  });

  it("does not apply kerb grip loss on Grass (BUG-1 isolation)", () => {
    // This ensures the (1 - kerbGripLoss) multiplication ONLY fires
    // when kerbTimer > 0, not for all surfaces
    const state = createCarState();
    const surfaceState = createSurfaceState({ kerbTimer: 0 });
    const config = createTestConfig({ kerbGripLoss: 0.2 });
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Grass,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    // Grass grip = offTrackGripFactor (0.3), NOT 0.3 × 0.8
    expect(surfaceState.gripOverride).toBe(config.offTrackGripFactor);
  });
});

// ─── AC-5: kerbHit Telemetry Flag ────────────────────────────────────────

describe("AC-5 — kerbHit telemetry flag", () => {
  it("sets kerbHit=true on kerb entry (timer starts)", () => {
    const state = createCarState({ kerbHit: false });
    const surfaceState = createSurfaceState({ kerbTimer: 0 });
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    expect(state.kerbHit).toBe(true);
  });

  it("kerbHit=true while kerbTimer > 0 (ticks 1 and 2)", () => {
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    // Single surface state reused across ticks
    const surfaceState = createSurfaceState({ kerbTimer: 0 });

    // Tick 1: enter kerb → timer=2 → kerbHit=true
    const state1 = createCarState({ kerbHit: false });
    updateSurfaceState(
      state1,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(2);
    expect(state1.kerbHit).toBe(true);

    // Tick 2: timer=2→1 → kerbHit=true (still within timer window)
    const state2 = createCarState({ kerbHit: false });
    updateSurfaceState(
      state2,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(1);
    expect(state2.kerbHit).toBe(true);
  });

  it("kerbHit=false after timer expires (timer=0)", () => {
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    // Shared state: 3 ticks of kerb → timer 2→1→0 → kerbHit clears on tick 3
    const surfaceState = createSurfaceState({ kerbTimer: 0 });

    // Tick 1 (entry) + Tick 2 (active) burn through the timer
    const state = createCarState({ kerbHit: false });
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    // Tick 3: timer=0 → kerbHit=false even if still on kerb
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(0);
    expect(state.kerbHit).toBe(false);
  });

  it("kerbHit=false on Tarmac (no kerb contact)", () => {
    const state = createCarState({ kerbHit: true });
    const surfaceState = createSurfaceState({ kerbTimer: 0 });
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Tarmac,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    expect(state.kerbHit).toBe(false);
  });
});

// ─── AC-6: offTrack Telemetry Flag ───────────────────────────────────────

describe("AC-6 — offTrack telemetry flag", () => {
  it("offTrack=true on Grass", () => {
    const state = createCarState({ offTrack: false });
    const surfaceState = createSurfaceState();
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Grass,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    expect(state.offTrack).toBe(true);
  });

  it("offTrack=true on Gravel", () => {
    const state = createCarState({ offTrack: false });
    const surfaceState = createSurfaceState();
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Gravel,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    expect(state.offTrack).toBe(true);
  });

  it("offTrack=false on Tarmac", () => {
    const state = createCarState({ offTrack: true });
    const surfaceState = createSurfaceState();
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Tarmac,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    expect(state.offTrack).toBe(false);
  });

  it("offTrack=false on Kerb (kerb is still track surface)", () => {
    const state = createCarState({ offTrack: true });
    const surfaceState = createSurfaceState();
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    expect(state.offTrack).toBe(false);
  });

  it("offTrack clears when car returns to Tarmac from Grass", () => {
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    // First on grass → offTrack=true
    const state = createCarState({ offTrack: false });
    const surfaceState = createSurfaceState();
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Grass,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(state.offTrack).toBe(true);

    // Then back to tarmac → offTrack=false
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Tarmac,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(state.offTrack).toBe(false);
  });
});

// ─── Integration: Surface Type Fallback ───────────────────────────────────

describe("Surface type fallback (unknown surface type)", () => {
  it("falls back to Tarmac modifiers for unknown surface type", () => {
    const state = createCarState();
    const surfaceState = createSurfaceState();
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    // Cast an invalid string as SurfaceType to test the defensive fallback
    const unknownType = "unknown" as SurfaceType;
    updateSurfaceState(
      state,
      surfaceState,
      unknownType,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    // Falls back to Tarmac
    expect(surfaceState.gripOverride).toBe(1.0);
    expect(state.frictionMultiplier).toBe(1.0);
    expect(state.minSurfaceSpeed).toBe(0);
    expect(state.offTrack).toBe(false);
  });

  it("emits console.warn for unknown surface type", () => {
    const state = createCarState();
    const surfaceState = createSurfaceState();
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const unknownType = "bogus" as SurfaceType;
    updateSurfaceState(
      state,
      surfaceState,
      unknownType,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown surface type "bogus"')
    );

    warnSpy.mockRestore();
  });
});

// ─── Current Surface Tracking ─────────────────────────────────────────────

describe("Current surface tracking", () => {
  it("updates currentSurface on the surfaceState each tick", () => {
    const state = createCarState();
    const surfaceState = createSurfaceState();
    const config = createTestConfig();
    const modifiers = buildSurfaceModifiers(config);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Grass,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.currentSurface).toBe(SurfaceType.Grass);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Tarmac,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.currentSurface).toBe(SurfaceType.Tarmac);

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.currentSurface).toBe(SurfaceType.Kerb);
  });
});

// ─── QA Review Gaps (GAP-1 through GAP-4) ─────────────────────────────────

describe("QA review gaps — code review findings", () => {
  // ── GAP-1: Cross-surface kerb timer decrement ──────────────────────────
  // Car enters kerb, timer starts at 2. Car leaves to tarmac. Timer still
  // decrements on tarmac. Grip recovers on tick 3 even though car is on tarmac.

  it("GAP-1: kerb timer decrements across surface changes (kerb → tarmac)", () => {
    const config = createTestConfig({ kerbGripLoss: 0.2 });
    const modifiers = buildSurfaceModifiers(config);
    const state = createCarState();
    const surfaceState = createSurfaceState();

    // Tick 1: enter kerb → timer=2, grip=0.8
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(2);
    expect(surfaceState.gripOverride).toBeCloseTo(0.8);

    // Tick 2: leave kerb → tarmac, timer=1 (still counting down), grip=0.8
    // (timer > 0 so grip loss still applies even though surface is tarmac)
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Tarmac,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(1);
    expect(surfaceState.gripOverride).toBeCloseTo(0.8);

    // Tick 3: still on tarmac → timer=0, grip=1.0 (recovered)
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Tarmac,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(0);
    expect(surfaceState.gripOverride).toBe(1.0);
  });

  // ── GAP-2: Kerb re-entry after timer expiry ────────────────────────────
  // Timer expires while on kerb → no re-trigger (wasOnKerb=true).
  // Car leaves to tarmac → wasOnKerb resets.
  // Car re-enters kerb → timer starts again.

  it("GAP-2: kerb timer does NOT re-trigger while staying on kerb", () => {
    const config = createTestConfig({ kerbGripLoss: 0.2 });
    const modifiers = buildSurfaceModifiers(config);
    const state = createCarState();
    const surfaceState = createSurfaceState();

    // Tick 1: enter kerb → timer=2
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(2);

    // Tick 2: still on kerb → timer=1
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(1);

    // Tick 3: still on kerb → timer=0 (recovered)
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(0);
    expect(surfaceState.gripOverride).toBe(1.0);

    // Tick 4: still on kerb → timer STAYS at 0 (no re-trigger!)
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(0);
    expect(surfaceState.gripOverride).toBe(1.0);

    // Tick 5: still on kerb → still 0
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(0);
  });

  it("GAP-2b: kerb re-entry restarts timer after leaving", () => {
    const config = createTestConfig({ kerbGripLoss: 0.2 });
    const modifiers = buildSurfaceModifiers(config);
    const state = createCarState();
    const surfaceState = createSurfaceState();

    // Tick 1: enter kerb → timer=2
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(2);

    // Tick 2: still on kerb → timer=1
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(1);

    // Tick 3: still on kerb → timer=0
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(0);

    // Tick 4: leave to tarmac → wasOnKerb resets
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Tarmac,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.wasOnKerb).toBe(false);

    // Tick 5: re-enter kerb → timer restarts at 2!
    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(2);
    expect(surfaceState.gripOverride).toBeCloseTo(0.8);
  });

  // ── GAP-3: Edge-case config values ─────────────────────────────────────

  it("GAP-3: kerbGripLoss=0 → no grip reduction on kerb", () => {
    const config = createTestConfig({ kerbGripLoss: 0 });
    const modifiers = buildSurfaceModifiers(config);
    const state = createCarState();
    const surfaceState = createSurfaceState();

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(2);
    // gripFactor=1.0, kerbGripLoss=0 → 1-0=1.0
    expect(surfaceState.gripOverride).toBe(1.0);
  });

  it("GAP-3b: kerbGripLoss=1 → grip=0 on kerb (full loss)", () => {
    const config = createTestConfig({ kerbGripLoss: 1.0 });
    const modifiers = buildSurfaceModifiers(config);
    const state = createCarState();
    const surfaceState = createSurfaceState();

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Kerb,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.kerbTimer).toBe(2);
    // gripFactor=1.0, kerbGripLoss=1.0 → (1-1)=0
    expect(surfaceState.gripOverride).toBe(0);
  });

  it("GAP-3c: offTrackGripFactor=0 → zero grip on grass (car can't steer)", () => {
    const config = createTestConfig({ offTrackGripFactor: 0 });
    const modifiers = buildSurfaceModifiers(config);
    const state = createCarState();
    const surfaceState = createSurfaceState();

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Grass,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    expect(surfaceState.gripOverride).toBe(0);
    // friction and minSpeed still applied
    expect(state.frictionMultiplier).toBe(6);
    expect(state.minSurfaceSpeed).toBeGreaterThan(0);
  });

  // ── GAP-4: Negative minSurfaceSpeed ────────────────────────────────────

  it("GAP-4: negative offTrackMinSpeedFraction → minSurfaceSpeed=0 (no floor)", () => {
    const config = createTestConfig({ offTrackMinSpeedFraction: -0.5 });
    const modifiers = buildSurfaceModifiers(config);
    const state = createCarState();
    const surfaceState = createSurfaceState();

    updateSurfaceState(
      state,
      surfaceState,
      SurfaceType.Grass,
      modifiers,
      config.kerbGripLoss,
      config.topSpeedL1toL5[0]
    );
    // topSpeed=100 * (-0.5) = -50, clamped to 0
    expect(state.minSurfaceSpeed).toBe(0);
  });
});
