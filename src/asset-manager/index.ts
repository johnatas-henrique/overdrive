/**
 * Asset Manager — entry point.
 *
 * Barrel re-export for the Asset Manager module. Exempt from the project's
 * barrel-file ban per `.opencode/docs/technical-preferences.md`:
 * > Exception: entry points with runtime logic.
 *
 * @module asset-manager
 */

export { AssetError } from "./asset-error";
export { AssetManager } from "./asset-manager";
export type { TrackManifest } from "./types";
