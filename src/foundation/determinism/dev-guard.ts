/**
 * Dev-mode guard that replaces non-deterministic global APIs with throwing
 * wrappers during fixed update pipeline execution.
 *
 * Replaces:
 * - `Math.random` — throws DeterminismError
 * - `Date.now` — throws DeterminismError
 * - `performance.now` — throws DeterminismError
 *
 * The guard is tree-shaken in production builds via `import.meta.env.DEV`.
 * In production (`import.meta.env.DEV === false`), `install()` is a no-op
 * and the entire method body is eliminated by Vite's tree-shaking.
 *
 * **Lifecycle**:
 * - `install()` — saves originals, replaces with throwing wrappers
 * - `uninstall()` — restores originals
 * - `isActive` — query whether the guard is currently installed
 *
 * Safe to call multiple times — repeated install/uninstall is idempotent.
 *
 * @see ADR-0002 — Fixed Timestep & Determinism Pipeline
 * @see F15 — Date.now() / performance.now() forbidden inside slot update()
 * @see F37 — SeededRandom.random() replaces Math.random() inside pipeline update()
 * @see F-G2 — Pipeline overhead < 0.001ms per tick (guard is a no-op in production)
 */
import { DeterminismError } from "./errors";

export class DeterminismGuard {
  private _originalMathRandom: (() => number) | null = null;
  private _originalDateNow: (() => number) | null = null;
  private _originalPerfNow: (() => number) | null = null;
  private _guardActive = false;

  /**
   * Install the dev guard, replacing non-deterministic APIs with throwing wrappers.
   *
   * In production (`import.meta.env.DEV === false`), this is a no-op and the
   * entire method body is tree-shaken by Vite.
   *
   * Safe to call multiple times — second call is a no-op when guard is already active.
   *
   * @example
   * ```typescript
   * const guard = new DeterminismGuard();
   * guard.install();
   * // Math.random() now throws DeterminismError
   * guard.uninstall();
   * // Math.random() restored
   * ```
   */
  install(): void {
    if (!import.meta.env.DEV) return;
    if (this._guardActive) return;

    this._originalMathRandom = Math.random;
    this._originalDateNow = Date.now;
    this._originalPerfNow = performance.now;

    Math.random = this._createThrowFn("Math.random");
    Date.now = this._createThrowFn("Date.now") as typeof Date.now;
    performance.now = this._createThrowFn(
      "performance.now"
    ) as typeof performance.now;

    this._guardActive = true;
  }

  /**
   * Uninstall the dev guard, restoring the original non-deterministic APIs.
   *
   * Safe to call multiple times — subsequent calls are no-ops
   * when the guard is not active.
   *
   * @example
   * ```typescript
   * guard.uninstall();
   * // Math.random(), Date.now(), performance.now() restored
   * ```
   */
  uninstall(): void {
    if (!this._guardActive) return;

    // When _guardActive is true, all three originals are guaranteed non-null
    // (set atomically in install() before _guardActive becomes true).
    const origMathRandom: () => number = this
      ._originalMathRandom as () => number;
    const origDateNow: () => number = this._originalDateNow as () => number;
    const origPerfNow: () => number = this._originalPerfNow as () => number;

    this._originalMathRandom = null;
    this._originalDateNow = null;
    this._originalPerfNow = null;
    this._guardActive = false;

    Math.random = origMathRandom;
    Date.now = origDateNow;
    performance.now = origPerfNow;
  }

  /**
   * Check whether the guard is currently active (APIs are patched).
   *
   * @returns `true` if the guard is installed and throwing wrappers are active
   *
   * @example
   * ```typescript
   * const guard = new DeterminismGuard();
   * expect(guard.isActive).toBe(false);
   * guard.install();
   * expect(guard.isActive).toBe(true);
   * ```
   */
  get isActive(): boolean {
    return this._guardActive;
  }

  /**
   * Create a throwing function that raises DeterminismError with a
   * descriptive name.
   *
   * @param name - The API name to include in the error message
   * @returns A function that throws DeterminismError when called
   */
  private _createThrowFn(name: string): () => number {
    return () => {
      throw new DeterminismError(`${name} forbidden during fixed update`);
    };
  }
}
