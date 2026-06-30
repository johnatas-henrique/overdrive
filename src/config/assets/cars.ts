/**
 * Car manifest IDs — one per team.
 *
 * Each entry is a string key that maps to a `TrackManifest`-shaped object
 * registered via `AssetManager.registerManifest()`. The actual GLB files and
 * textures are populated by art production; these IDs are the compile-time
 * constants consumed by the preload pipeline.
 *
 * @module config/assets/cars
 */

export const CAR_MANIFEST_IDS = [
  "cars.team_alpha",
  "cars.team_beta",
  "cars.team_gamma",
  "cars.team_delta",
  "cars.team_epsilon",
  "cars.team_zeta",
  "cars.team_eta",
  "cars.team_theta",
] as const;
