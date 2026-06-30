/**
 * Asset manifest for a track or environment GLB.
 *
 * Defines the root URL and filename that `load()` uses to build the
 * full path for `LoadAssetContainerAsync`. The `rootUrl` is passed
 * in the options for correct relative texture resolution.
 *
 * @example
 * ```typescript
 * const manifest: TrackManifest = {
 *   glb: { rootUrl: "assets/tracks/spa/", filename: "spa.glb" },
 * };
 * ```
 */
export interface TrackManifest {
  /** GLB asset path components */
  glb: {
    /** Base URL for the GLB and its referenced textures */
    rootUrl: string;
    /** GLB filename (appended to rootUrl for the full source path) */
    filename: string;
  };
}
