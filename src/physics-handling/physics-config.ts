/**
 * Physics configuration — all tuning knobs for the arcade model.
 *
 * Loaded from ConfigManager (physics.* namespace) at init time.
 * All values are data-driven — never hardcoded in gameplay code.
 *
 * @see ADR-0008 — PhysicsConfig interface definition
 * @see C-F3 (technical-preferences.md) — Hardcoded gameplay values forbidden
 */

/**
 * Physics configuration interface.
 *
 * Contains grip parameters, steering limits, drag/brake coefficients,
 * pit limiter, off-track penalties, kerb effects, speed modulation,
 * gearbox parameters, and per-level performance tables.
 *
 * @example
 * ```typescript
 * const config: PhysicsConfig = {
 *   baseGrip: 0.95,
 *   steerClampSpeed: 25,
 *   steerMinRatio: 0.4,
 *   // ... all 19 fields
 * };
 * await physicsService.init(config);
 * ```
 */
export interface PhysicsConfig {
  // ─── Grip ──────────────────────────────────────────────────────────

  /** Base grip coefficient — primary feel knob. */
  readonly baseGrip: number;

  // ─── Physics Constants ─────────────────────────────────────────────

  /** Gravity acceleration in m/s² (positive = downward). */
  readonly gravity: number;

  // ─── Steering ──────────────────────────────────────────────────────

  /** Speed (m/s) at which steering is fully clamped to steerMinRatio. */
  readonly steerClampSpeed: number;
  /** Minimum steering ratio at high speed (0..1). */
  readonly steerMinRatio: number;

  // ─── Lift-Off Oversteer ────────────────────────────────────────────

  /** Minimum steering input magnitude to trigger lift-off oversteer. */
  readonly liftOffMinSteering: number;
  /** Throttle threshold below which lift-off oversteer activates. */
  readonly liftOffThrottleMax: number;
  /** Brake threshold below which lift-off oversteer activates. */
  readonly liftOffBrakeMax: number;

  // ─── Drag & Braking ────────────────────────────────────────────────

  /** Aerodynamic drag coefficient (applied as deceleration opposing velocity). */
  readonly dragCoeff: number;
  /** Maximum braking force (deceleration per tick). */
  readonly maxBrakeForce: number;

  // ─── Pit Limiter ───────────────────────────────────────────────────

  /** Maximum speed in pit lane (m/s). */
  readonly pitSpeedLimit: number;

  // ─── Off-Track ─────────────────────────────────────────────────────

  /** Friction multiplier when off-track. */
  readonly offTrackFriction: number;
  /** Grip multiplier when off-track (0..1). */
  readonly offTrackGripFactor: number;
  /** Minimum speed fraction of topSpeed when off-track (0..1, e.g. 0.3 = 30%). */
  readonly offTrackMinSpeedFraction: number;

  // ─── Kerb ──────────────────────────────────────────────────────────

  /** Grip loss factor when on a kerb (0..1, lower = more loss). */
  readonly kerbGripLoss: number;

  // ─── Speed Modulation ──────────────────────────────────────────────

  /** Reference speed for speed-dependent grip modulation (m/s). */
  readonly speedModRefSpeed: number;
  /** Minimum grip factor at zero speed (speedMod saturates here). */
  readonly speedModMinFactor: number;

  // ─── Gearbox ───────────────────────────────────────────────────────

  /** RPM threshold for automatic upshift. */
  readonly autoShiftRpmThreshold: number;
  /** Maximum engine RPM. */
  readonly rpmMax: number;
  /** 6 forward gear ratios (G1 through G6). */
  readonly gearRatios: number[];
  /** Acceleration level (1–5) for torque curve multiplier. */
  readonly accelLevel: number;
  /** RPM ratio for downshift threshold (fraction of upshift threshold). */
  readonly downshiftRpmRatio: number;
  /** Maximum reverse speed (m/s). */
  readonly reverseMaxSpeed: number;
  /** Speed (m/s) at which 1st gear reaches rpmMax — determines RPM scaling. */
  readonly gear1RedlineSpeed: number;

  // ─── Engine Power ──────────────────────────────────────────────────

  /** Maximum power output multiplier. */
  readonly powerCeiling: number;
  /** Car mass in kg (used for gradient force and coast deceleration). */
  readonly mass: number;

  // ─── Misc ──────────────────────────────────────────────────────────

  /** Minimum effective grip factor (floor, prevents zero-grip ice). */
  readonly minGripFactor: number;
  /** Speed below which the car is considered stopped (m/s). */
  readonly stopEpsilon: number;
  /** Half-width of the car chassis (used for track boundary checks). */
  readonly carHalfWidth: number;

  // ─── Per-Level Stats ───────────────────────────────────────────────

  /** Top speed (m/s) per level 1–5. */
  readonly topSpeedL1toL5: [number, number, number, number, number];
  /** Acceleration factor per level 1–5. */
  readonly accelerationL1toL5: [number, number, number, number, number];
  /** Cornering stat per level 1–5 (feeds cornerStat formula). */
  readonly corneringL1toL5: [number, number, number, number, number];
}
