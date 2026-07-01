/**
 * Minimal track spline query interface.
 *
 * Provides elevation and tangent queries needed by Physics Phase 3
 * ground tracking and heading derivation. Implemented by the Track
 * system (ADR-0025).
 *
 * @see ADR-0008 — Ground Tracking section
 */

import type { Vector3 } from "@babylonjs/core/Maths/math";

/**
 * Track spline query interface.
 *
 * Only exposes the methods Physics needs: elevation and tangent at a
 * given spline position. The full track system (segments, width, next)
 * lives in the Track epic (ADR-0025).
 *
 * @example
 * ```typescript
 * class MyTrack implements ITrackSystem {
 *   getElevation(pos: number): number {
 *     return this.splineSegments[Math.floor(pos)].elevation;
 *   }
 *   getTangent(pos: number): Vector3 {
 *     return this.splineSegments[Math.floor(pos)].tangent;
 *   }
 * }
 * ```
 */
export interface ITrackSystem {
  /**
   * Get the spline elevation (Y in physics world) at a position.
   *
   * @param splinePosition - Position along the track spline (0..trackLength)
   * @returns Elevation at that position in world units
   */
  getElevation(splinePosition: number): number;

  /**
   * Get the forward direction tangent at a spline position.
   *
   * Used by Phase 3 velocity override to derive the car's heading
   * from the track spline (not the car mesh). The returned vector
   * must be normalized.
   *
   * @param splinePosition - Position along the track spline (0..trackLength)
   * @returns Normalized forward direction Vector3
   */
  getTangent(splinePosition: number): Vector3;
}
