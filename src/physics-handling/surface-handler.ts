/**
 * Surface handling — off-track (grass/gravel) and kerb grip modifiers.
 *
 * Provides pure functions for managing per-car surface state, computing
 * grip overrides, friction multipliers, minimum speed floors, and
 * telemetry flags (offTrack, kerbHit).
 *
 * All surface modifier values come from PhysicsConfig — never hardcoded.
 *
 * **Integration point**: Called from PhysicsService.update() during Phase 1
 * for each car, before ArcadeGripModel.compute().
 *
 * @see STORY-004 — Surface Handling: Off-Track & Kerbs
 * @see TR-PHYSICS-004 — kerbHit, offTrack telemetry output
 * @see ADR-0008 — Vehicle Physics — Arcade Dynamic
 * @see C59 — Track spline carries per-segment gripSurface metadata
 */

import type { CarPhysicsState, PhysicsConfig } from "./types";

// ─── Surface Type ────────────────────────────────────────────────────────────

/**
 * Surface type determined by track spline segment metadata.
 *
 * Queried by the car's splinePosition from the track system's per-segment
 * gripSurface metadata (C59). The surface type drives grip modifiers,
 * friction multipliers, and telemetry flags.
 */
export enum SurfaceType {
  /** Normal racing surface — full grip, standard friction. */
  Tarmac = "tarmac",
  /** Kerb (rumble strip) — brief grip loss via timer, standard friction. */
  Kerb = "kerb",
  /** Grass run-off area — reduced grip, high friction, minimum speed floor. */
  Grass = "grass",
  /** Gravel run-off area — same modifiers as grass. */
  Gravel = "gravel",
}

// ─── Surface Modifiers ───────────────────────────────────────────────────────

/**
 * Per-surface modifier values applied to grip, friction, and minimum speed.
 *
 * All values are multipliers or fractions — multiplied by base physics
 * values (gripMax, dragCoeff, topSpeed) during Phase 1 computation.
 *
 * @see SURFACE_MODIFIERS — Lookup table indexed by SurfaceType
 */
export interface SurfaceModifiers {
  /** Grip factor: multiplied by gripMax (0..1). 1.0 = full grip. */
  readonly gripFactor: number;
  /** Friction multiplier: multiplied by dragCoeff. 1.0 = standard drag. */
  readonly frictionMultiplier: number;
  /** Minimum speed fraction of topSpeed (0..1). 0 = no floor. */
  readonly minSpeedFraction: number;
}

// ─── Per-Car Surface State ───────────────────────────────────────────────────

/**
 * Per-car mutable surface state, updated each tick.
 *
 * Tracks the current surface, computed grip override (including kerb
 * timer effects), and the kerb 2-tick recovery timer.
 *
 * @example
 * ```typescript
 * const surfaceState: CarSurfaceState = {
 *   currentSurface: SurfaceType.Tarmac,
 *   gripOverride: 1.0,
 *   kerbTimer: 0,
 * };
 * ```
 */
export interface CarSurfaceState {
  /** Current surface type (updated each tick from track spline). */
  currentSurface: SurfaceType;
  /**
   * Computed grip override multiplier (0..1).
   * 1.0 = no override (tarmac). Applied multiplicatively to gripMax.
   * Reflects both surface grip factor AND kerb grip loss when timer active.
   */
  gripOverride: number;
  /**
   * Ticks remaining of kerb grip loss (0 = no active kerb effect).
   * Starts at 2 on kerb entry, decrements each tick regardless of surface.
   * Car recovers full grip on tick 3 even if still on kerb (timer-based).
   */
  kerbTimer: number;
  /**
   * Whether the car was on a kerb on the previous tick.
   * Used to detect kerb entry (transition from non-kerb to kerb).
   * Prevents timer re-trigger while remaining on the same kerb segment.
   */
  wasOnKerb: boolean;
}

// ─── Surface Modifier Lookup Table ──────────────────────────────────────────

/**
 * Surface modifier lookup table — maps each SurfaceType to its grip,
 * friction, and minimum speed modifiers.
 *
 * All values are data-driven from PhysicsConfig at construction time,
 * then cached in this object. The table is rebuilt when the config changes
 * (e.g., difficulty scaling) via buildSurfaceModifiers().
 *
 * @see ADR-0008 — Surface-dependent grip modifiers
 */
export function buildSurfaceModifiers(
  config: PhysicsConfig
): Record<SurfaceType, SurfaceModifiers> {
  return {
    [SurfaceType.Tarmac]: {
      gripFactor: 1.0,
      frictionMultiplier: 1.0,
      minSpeedFraction: 0,
    },
    [SurfaceType.Kerb]: {
      // Kerb gripFactor is 1.0 — kerb grip loss is exclusively managed
      // by the 2-tick timer in updateSurfaceState(), not the modifier table.
      // Timer applies *= (1 - kerbGripLoss) for exactly 2 ticks.
      // @see BUG-1 — physics specialist review: double application fix
      gripFactor: 1.0,
      frictionMultiplier: 1.0,
      minSpeedFraction: 0,
    },
    [SurfaceType.Grass]: {
      gripFactor: config.offTrackGripFactor,
      frictionMultiplier: config.offTrackFriction,
      minSpeedFraction: config.offTrackMinSpeedFraction,
    },
    [SurfaceType.Gravel]: {
      gripFactor: config.offTrackGripFactor,
      frictionMultiplier: config.offTrackFriction,
      minSpeedFraction: config.offTrackMinSpeedFraction,
    },
  };
}

// ─── Surface State Update ────────────────────────────────────────────────────

/**
 * Update per-car surface state for one physics tick.
 *
 * Called during Phase 1 for each car, before ArcadeGripModel.compute().
 * Mutates both `surfaceState` (surface tracking, kerb timer) and
 * `carState` (friction multiplier, minimum speed, telemetry flags).
 *
 * **Kerb timer behavior** (AC-4, AC-5):
 * - On kerb entry (currentSurface === Kerb && kerbTimer === 0): timer set to 2
 * - Each tick while timer > 0: decrement by 1
 * - Grip loss applies for duration of timer (2 ticks), then recovers on tick 3
 * - Timer-based, not hold-based: car recovers even if still on kerb
 *
 * **Telemetry flags** (AC-5, AC-6):
 * - kerbHit = true while kerbTimer > 0 (2 ticks after kerb entry)
 * - offTrack = true when surface is Grass or Gravel
 *
 * @param carState - Per-car physics state (mutated: frictionMultiplier,
 *                   minSurfaceSpeed, kerbHit, offTrack)
 * @param surfaceState - Per-car surface state (mutated: currentSurface,
 *                        gripOverride, kerbTimer)
 * @param surfaceType - Surface type for this tick (from track spline query)
 * @param modifiers - Pre-built surface modifier lookup table (built once
 *                     by PhysicsService.init() via buildSurfaceModifiers())
 * @param kerbGripLoss - Kerb grip loss factor from PhysicsConfig (0..1)
 * @param topSpeed - Car's theoretical top speed in m/s (used for min speed floor)
 *
 * **Performance note**: Accepts a pre-built modifiers table rather than
 * rebuilding it per tick. The table is built once by PhysicsService.init()
 * via buildSurfaceModifiers(config) and cached as _surfaceModifiers.
 *
 * @see AC-4 — Kerb 2-tick timer
 * @see AC-5 — kerbHit telemetry flag
 * @see AC-6 — offTrack telemetry flag
 * @see CONCERN-2 — physics specialist review: pre-built modifiers table
 */
export function updateSurfaceState(
  carState: CarPhysicsState,
  surfaceState: CarSurfaceState,
  surfaceType: SurfaceType,
  modifiers: Record<SurfaceType, SurfaceModifiers>,
  kerbGripLoss: number,
  topSpeed: number
): void {
  // Look up modifiers for the current surface type
  const mods =
    modifiers[surfaceType] ??
    (() => {
      console.warn(
        `[SurfaceHandler] Unknown surface type "${String(surfaceType)}", falling back to Tarmac`
      );
      return modifiers[SurfaceType.Tarmac];
    })();

  // Update current surface
  surfaceState.currentSurface = surfaceType;

  // ── Kerb Timer Management ────────────────────────────────────────────
  // Timer-based: starts at 2 on kerb ENTRY (transition from non-kerb to kerb),
  // decrements each tick regardless of current surface. Car recovers on tick 3
  // even if still on kerb. Once timer expires, no re-trigger while remaining
  // on the same kerb — re-entry (leaving and coming back) restarts the timer.
  const isOnKerb = surfaceType === SurfaceType.Kerb;
  if (isOnKerb && !surfaceState.wasOnKerb && surfaceState.kerbTimer === 0) {
    // Kerb entry: start 2-tick grip loss timer
    surfaceState.kerbTimer = 2;
  } else if (surfaceState.kerbTimer > 0) {
    surfaceState.kerbTimer--;
  }
  surfaceState.wasOnKerb = isOnKerb;

  // ── Grip Override ────────────────────────────────────────────────────
  // Start with surface grip factor from modifier table.
  // Kerb has gripFactor=1.0 — grip loss is exclusively from timer below.
  // Grass/Gravel use offTrackGripFactor (default 0.3) from modifier table.
  surfaceState.gripOverride = mods.gripFactor;

  // Kerb grip loss applied via 2-tick timer (BUG-1 fix: not from modifier
  // table). When kerbTimer > 0, multiply grip by (1 - kerbGripLoss).
  if (surfaceState.kerbTimer > 0) {
    surfaceState.gripOverride *= 1 - kerbGripLoss;
  }

  // ── Friction Multiplier ──────────────────────────────────────────────
  // Applied to drag coefficient in the engine model (Phase 1 compute).
  // Tarmac/Kerb = 1.0, Grass/Gravel = offTrackFriction (default 6×).
  // See AC-2: off-track applies 6× friction multiplier.
  carState.frictionMultiplier = mods.frictionMultiplier;

  // ── Minimum Speed Floor ──────────────────────────────────────────────
  // Only active on off-track surfaces (grass/gravel). Tarmac/kerb = 0.
  // Formula: minSurfaceSpeed = topSpeed × minSpeedFraction
  // See AC-3: car never slowed below topSpeed × offTrackMinSpeedFraction on grass.
  // Clamp to 0 — negative fraction means no speed floor.
  carState.minSurfaceSpeed = Math.max(0, topSpeed * mods.minSpeedFraction);

  // ── Telemetry Flags ──────────────────────────────────────────────────
  // AC-5: kerbHit true while kerb timer active (2 ticks after kerb entry)
  carState.kerbHit = surfaceState.kerbTimer > 0;
  // AC-6: offTrack true on grass or gravel; cleared when back on tarmac/kerb
  carState.offTrack =
    surfaceType === SurfaceType.Grass || surfaceType === SurfaceType.Gravel;
}

// ─── Minimum Surface Speed Enforcement ───────────────────────────────────────

/**
 * Enforce the minimum speed floor for the current surface.
 *
 * When `minSurfaceSpeed > 0` (off-track), the car's target speed is
 * clamped to never go below this minimum. On tarmac/kerb where
 * minSurfaceSpeed = 0, the target speed is returned unchanged.
 *
 * Applied in PhysicsService.update() after ArcadeGripModel.compute()
 * returns, so the engine model's drag/speed computation is unmodified
 * and the clamp is a post-processing step.
 *
 * @param targetSpeed - Computed target speed from engine model (m/s)
 * @param minSurfaceSpeed - Minimum speed floor for current surface (m/s)
 * @returns Clamped target speed (m/s)
 *
 * @see AC-3 — Off-track minimum speed
 */
export function enforceMinSurfaceSpeed(
  targetSpeed: number,
  minSurfaceSpeed: number
): number {
  // FR-009: guard against negative or zero target speed (reverse gear).
  // When reversing, the car is intentionally moving backward, so the
  // minimum surface speed floor should not apply — it would pin the car
  // at a forward speed.
  if (minSurfaceSpeed <= 0 || targetSpeed < 0) {
    return targetSpeed;
  }
  // On tarmac/kerb, minSurfaceSpeed = 0, so no clamp.
  // On off-track surfaces (grass/gravel), clamp target speed upward.
  return Math.max(targetSpeed, minSurfaceSpeed);
}
