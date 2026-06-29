/**
 * Custom error class for Asset Manager errors.
 *
 * Thrown when AssetManager operations are attempted before initialization,
 * during invalid state transitions, or on invalid scene names.
 *
 * @example
 * ```typescript
 * throw new AssetError("Not initialized");
 * throw new AssetError("Invalid scene: 'invalid'. Expected 'menu' or 'race'");
 * ```
 */
export class AssetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetError";
    Object.setPrototypeOf(this, AssetError.prototype);
  }
}
